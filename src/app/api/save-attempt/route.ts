import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Requires Service Role Key to bypass RLS for the RPC failure map increment function
const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
);

interface JoinedSkeletonData {
  failure_profile: Record<string, any> | null;
  source_questions: { concept: string } | { concept: string }[] | null;
}

export async function POST(req: Request) {
  try {
    // 1. Safely extract the frontend payload
    const { session_id, variant_id, raw_answer, execution_velocity_seconds } = await req.json();

    if (!variant_id || !raw_answer || !session_id) {
      return NextResponse.json({ error: 'Missing mandatory payload variables.' }, { status: 400 });
    }

    const transcript = raw_answer;

    // 2. Fetch Variant Context
    const { data: variantData, error: variantError } = await supabaseService
      .from('variants')
      .select('skeleton_id, generated_question, solution_trace, generated_options, correct_answer')
      .eq('id', variant_id)
      .single();

    if (variantError || !variantData) {
      throw new Error(`Variant metadata missing: ${variantError?.message}`);
    }

    const skeleton_id = variantData.skeleton_id;

    // 3. Fetch Skeleton Context for the Concept Name
    const { data: rawSkeletonData, error: skeletonError } = await supabaseService
      .from('skeletons') 
      .select(`
        failure_profile, 
        source_questions (concept)
      `) 
      .eq('id', skeleton_id)
      .single();

    if (skeletonError) {
      console.error("Warning: Skeleton metadata fetch issue.", skeletonError);
    }

    const skeletonData = rawSkeletonData as unknown as JoinedSkeletonData;

    const sourceConcept = Array.isArray(skeletonData?.source_questions) 
        ? skeletonData.source_questions[0]?.concept 
        : (skeletonData?.source_questions as { concept: string })?.concept;
        
    const conceptName = sourceConcept || 'Mathematics';
    
    const availableWCategories = skeletonData?.failure_profile 
      ? Object.keys(skeletonData.failure_profile) 
      : ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'];

    // 4. Enhanced System Prompt for Claude capturing late-stage parental metrics
    const systemInstruction = `
      You are an expert UK 11+ Cognitive Diagnostic Engine. Evaluate the student's transcript against the question and the Expected Solution Trace.
      
      You must classify failures using these STRICT behavioral failure modes (W-Categories):
      - W1 (Concept unknown): Child is silent, doesn't know where to start, or produces an answer with no logical route.
      - W2 (Application too hard): Identifies the right tool/concept but hits a wall executing it at this complexity.
      - W3 (Linguistic parsing failure): Solves something internally consistent but answers a completely different question due to misreading.
      - W4 (Schema substitution): Moves fast/confidently, stopping reading early because pattern recognition fired falsely ("oh this is like the ones where...").
      - W5 (Assumption error): Clean, logical narration but based on a flawed, unstated assumption.
      - W6 (Execution error): Reasoning, setup, and approach are 100% sound, but a basic arithmetic/computational slip occurred.
      - W7 (Trap sprung): Question has a designed misdirection/obvious wrong answer, and the child confidently takes the bait.
      - W8 (Working memory overflow): Fine early on, but loses the thread ("wait, what was I finding?") or forgets to use a sub-answer or rule they just stated.

      You must respond with a raw JSON object matching this schema exactly:
      {
        "teacher_scratchpad": "Step 1 (True Math): [...]. Step 2 (Transcript Translation): [...]. Step 3 (Calculated Result): [...]. Step 4 (W-Category Diagnosis): [...].",
        "is_correct": boolean,
        "completion_percentage": number, 
        "methodology_used": "EXPECTED_TRACE" | "ALTERNATIVE_VALID" | "ROTE_GUESSING" | "INCOMPLETE_CHAIN",
        "w_category_breakdown": {
           // Output 1 if demonstrated, 0 if not for every available category.
        },
        "error_reason": "concept_unknown" | "app_too_hard" | "wording_comprehension" | "misinterpreted_simpler" | "unjustified_assumption" | "calculation_error" | "intentional_trap" | "sub_answer_stall" | "blind_to_solution" | null,
        "analysis": {
           "thought_process_breakdown": "Detailed plain English evaluation of their logical steps.",
           "demonstrated_strengths": "What did they do well?",
           "demonstrated_weaknesses": "Where exactly did the cognitive chain break?",
           "student_confidence_marker": "HIGH" | "MEDIUM" | "LOW",
           "is_structural_flaw": boolean, // true if this is a recurring logical blind spot/habit pattern, false if it is a fluke mistake
           "time_pressure_derailment": boolean, // true if countdown pressure or timing directly caused their logic to scatter
           "parental_friction_detected": boolean // true if the script trace flags deep defensive pauses, heavy sighs, or frustration indicators when working together
        },
        "recommended_intervention": "A strict 1-sentence prompt for a tutor on exactly what concept to clarify next."
      }
    `;

    const userPrompt = `
      CONCEPT: ${conceptName}
      QUESTION SEEN BY CHILD: "${variantData.generated_question}"
      CORRECT ANSWER: "${variantData.correct_answer || 'N/A'}"
      EXPECTED SOLUTION TRACE: "${variantData.solution_trace}"
      AVAILABLE W-CATEGORIES: ${JSON.stringify(availableWCategories)}
      
      STUDENT TRANSCRIPT TO EVALUATE:
      "${transcript}"
    `;

    // 5. Fire to Anthropic 
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6', 
        max_tokens: 2000,
        temperature: 0.1,
        system: systemInstruction,
        messages: [
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      throw new Error(`Anthropic API failure: ${errText}`);
    }

    const anthropicData = await anthropicResponse.json();
    let rawText = anthropicData.content[0].text.trim();
    
    const tripleBacktickJson = "\x60\x60\x60json";
    const tripleBacktick = "\x60\x60\x60";

    if (rawText.startsWith(tripleBacktickJson)) rawText = rawText.slice(7);
    else if (rawText.startsWith(tripleBacktick)) rawText = rawText.slice(3);
    if (rawText.endsWith(tripleBacktick)) rawText = rawText.slice(0, -3);
    
    const evaluation = JSON.parse(rawText.trim());

    const triggeredCategories = Object.entries(evaluation.w_category_breakdown || {})
      .filter(([_, value]) => value === 1)
      .map(([key, _]) => key);

    // 6. Sync cumulative Skeleton metrics
    if (triggeredCategories.length > 0 && skeleton_id) {
      await supabaseService.rpc('increment_failure_map', {
        p_skeleton_id: skeleton_id,
        p_w_categories: triggeredCategories
      });
    }

    // 7. Verify Auth State
    const cookieStore = await cookies();
    const authSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set() {}, remove() {}
        },
      }
    );
    
    const { data: { user } } = await authSupabase.auth.getUser();

    // 8. Log comprehensive metrics row
    const { error: insertError } = await supabaseService
      .from('user_attempts')
      .insert([{
          user_id: user?.id || null, 
          session_id: session_id,
          skeleton_id: skeleton_id || null, 
          variant_id: variant_id, 
          transcript: transcript,
          is_correct: evaluation.is_correct,
          solve_time: execution_velocity_seconds, 
          analysis: evaluation 
      }]);

    if (insertError) throw insertError;

    return NextResponse.json({ success: true, evaluation });
  } catch (err) {
    console.error('Diagnostic Evaluation Failed:', err);
    return NextResponse.json({ error: 'Internal grading architecture exception.' }, { status: 500 });
  }
}