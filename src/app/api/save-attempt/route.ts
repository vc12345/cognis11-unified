import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Service role bypass for cumulative skeleton analytics sync
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
    // 1. Authenticate Parent Context Immediately
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
    if (!user) {
      return NextResponse.json({ error: 'Unverified parent session profile context.' }, { status: 401 });
    }

    // 2. Extract Frontend Payload Arguments (including new step velocities)
    const { 
      session_id, 
      variant_id, 
      raw_answer, 
      step_velocities, 
      total_velocity_seconds 
    } = await req.json();

    if (!variant_id || !raw_answer || !session_id) {
      return NextResponse.json({ error: 'Missing mandatory payload variables.' }, { status: 400 });
    }

    // Unpack the 3 structural scaffolding steps from the client-side JSON bundle
    const parsedScaffold = typeof raw_answer === 'string' ? JSON.parse(raw_answer) : raw_answer;
    const { step1, step2, step3, confidence } = parsedScaffold;

    // 3. Ingest Variant & Target Metadata
    const { data: variantData, error: variantError } = await supabaseService
      .from('variants')
      .select('skeleton_id, generated_question, solution_trace, generated_options, correct_answer')
      .eq('id', variant_id)
      .single();

    if (variantError || !variantData) {
      throw new Error(`Variant metadata missing: ${variantError?.message}`);
    }

    const skeleton_id = variantData.skeleton_id;

    // 4. Extract Structural Skeleton Concept Mappings
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
    
    // Explicitly seed the breakdown metrics arrays, adding W9 into the calculation context dynamically
    const availableWCategories = skeletonData?.failure_profile 
      ? [...Object.keys(skeletonData.failure_profile), 'W9'].filter((v, i, a) => a.indexOf(v) === i)
      : ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9'];

    // 5. Deep Cognitive & Linguistic Instruction Framework (Calibrated for 3-Stage Scaffolding)
    const systemInstruction = `
      You are the core UK 11+ Spoken Diagnostics Engine for Cognis11. Your purpose is to evaluate a student's multi-stage spoken math transcripts against an elite Junior Math Olympiad shell and output highly granular cognitive telemetry.

      You are evaluating a child up to the end of primary school competing in an educational arms race. Do not mask tracking flaws in vague academic generalities.

      CRITICAL SCENARIO HANDLING PROMPT DIRECTIVE:
      - If the child's final calculation path is correct, mark "is_correct": true. If they initially fell into a trap or made a strategy error but caught it independently and fixed it, you should track that initial behavioral error token as the "error_reason" and primary flag, noting their exceptional self-monitoring loop in your text logs.

      STRICT PHASIC ANALYSIS CONSTRAINTS:
      - Evaluate Step 1 Transcript solely for Input & Perception errors (W1, W3, W4).
      - Evaluate Step 2 Transcript solely for Planning & Strategy errors (W2, W5, W7).
      - Evaluate Step 3 Transcript solely for Execution & Review errors (W6, W8, W9).

      STRICT CHRONOLOGICAL ERROR CLASSIFICATION (You must select exactly ONE core error reason token from the list below if any structural friction or slip happened):
      - "W1": Concept Unknown (Completely blind to underlying rules; zero logical starting point in Step 1).
      - "W3": Passive Linguistic Parsing Failure (Child skips or misreads explicit words like "not", "except", or conditions).
      - "W4": Proactive Schema Substitution (Rushed pattern-snapping; confidently forces an old layout onto this question).
      - "W2": Application Ceiling (Understands the base rule but collapses under deep abstraction or complex variables in Step 2).
      - "W5": Implicit Assumption Bias (Flawless internal logic built entirely on an imaginary, unstated premise or rule).
      - "W7": Reactive Seduction / Trap Sprung (Direct surrender to a designed distractor element or an attractive partial answer).
      - "W6": Operational / Calculation Slip (Reading and logic tracking are 100% sound, but an arithmetic calculation error happened in Step 3).
      - "W8": Horizontal Working Memory Overflow (Can do steps in isolation, but drops intermediate coordinates or loses track mid-calculation).
      - "W9": Metacognitive Absurdity Tolerance (Arrives at a contextually impossible output like a bus moving at 900mph, but accepts it anyway).

      You must respond with a raw JSON object matching this schema exactly. Do not wrap in markdown or block annotations:
      {
        "teacher_scratchpad": "Step 1 (True Math): [Formula tracking]. Step 2 (Transcript Translation): [Translate scaffold text keys]. Step 3 (Calculated Result): [...]. Step 4 (W-Category Diagnosis): [...].",
        "is_correct": boolean,
        "completion_percentage": number,
        "methodology_used": "EXPECTED_TRACE" | "ALTERNATIVE_VALID" | "ROTE_GUESSING" | "INCOMPLETE_CHAIN",
        "w_category_breakdown": {
          "W1": 0 or 1, "W2": 0 or 1, "W3": 0 or 1, "W4": 0 or 1, "W5": 0 or 1, "W6": 0 or 1, "W7": 0 or 1, "W8": 0 or 1, "W9": 0 or 1
        },
        "parent_facing_error": "W1" | "W2" | "W3" | "W4" | "W5" | "W6" | "W7" | "W8" | "W9" | null,
        "error_reason": "W1" | "W2" | "W3" | "W4" | "W5" | "W6" | "W7" | "W8" | "W9" | null,
        "speech_telemetry": {
          "speech_density_score": number, // 0-100. High density = concise structural logic.
          "detected_frustration_tokens": boolean,
          "time_pressure_derailment": boolean,
          "is_structural_flaw": boolean
        },
        "recommended_intervention": "A strict 1-sentence plain-English coaching directive isolating exactly what habit or logic slot to patch next."
      }
    `;

    const userPrompt = `
      TOPIC FOCUS: ${conceptName}
      QUESTION TEXT: "${variantData.generated_question}"
      CORRECT EXPECTED VALUE: "${variantData.correct_answer || 'N/A'}"
      EXPECTED SOLUTION TRACE: "${variantData.solution_trace}"
      AVAILABLE COMPILING COHORTS: ${JSON.stringify(availableWCategories)}
      
      SCAFFOLDED TIMING TELEMETRY (SECONDS):
      - Step 1 (Read Aloud): ${step_velocities?.step1 || 0}s
      - Step 2 (Game Plan): ${step_velocities?.step2 || 0}s
      - Step 3 (Calculations): ${step_velocities?.step3 || 0}s
      - Total Combined Time: ${total_velocity_seconds || execution_velocity_seconds}s
      
      CHILD'S EXTRACTED PERFORMANCE TRANSCRIPTS:
      - Step 1 Target Isolation text: "${step1 || ''}"
      - Step 2 Strategy blueprint text: "${step2 || ''}"
      - Step 3 Solution execution track: "${step3 || ''}"
      - Child's Self-Reported Confidence Marker: "${confidence || 'N/A'}"
    `;

    // 6. Execute High-Fidelity Call to Anthropic Native Wrapper
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022', // Standard production string anchor 
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
      throw new Error(`Anthropic API Exception: ${errText}`);
    }

    const anthropicData = await anthropicResponse.json();
    let rawText = anthropicData.content[0].text.trim();
    
    // Defensive parsing normalization structures
    const jsonMarker = "```json";
    const closingMarker = "```";
    if (rawText.startsWith(jsonMarker)) rawText = rawText.slice(7);
    else if (rawText.startsWith(closingMarker)) rawText = rawText.slice(3);
    if (rawText.endsWith(closingMarker)) rawText = rawText.slice(0, -3);
    
    const evaluation = JSON.parse(rawText.trim());

    // 7. Update Structural Skeleton Aggregates via your original RPC link
    const triggeredCategories = Object.entries(evaluation.w_category_breakdown || {})
      .filter(([_, value]) => value === 1)
      .map(([key, _]) => key);

    if (triggeredCategories.length > 0 && skeleton_id) {
      await supabaseService.rpc('increment_failure_map', {
        p_skeleton_id: skeleton_id,
        p_w_categories: triggeredCategories
      });
    }

    // 8. Log Comprehensive High-Fidelity Data Matrix Row (Preserving your exact storage metrics)
    const { error: insertError } = await supabaseService
      .from('user_attempts')
      .insert([{
          user_id: user.id, 
          session_id: session_id,
          skeleton_id: skeleton_id || null, 
          variant_id: variant_id, 
          transcript: raw_answer, // Keeps whole raw scaffold JSON structure intact inside database text logs
          step_velocities: step_velocities, // Saves multi-step time keys smoothly
          is_correct: evaluation.is_correct,
          solve_time: total_velocity_seconds || execution_velocity_seconds, 
          analysis: evaluation 
      }]);

    if (insertError) throw insertError;

    return NextResponse.json({ success: true, evaluation });
  } catch (err: any) {
    console.error('Core Evaluation Engine Crash:', err);
    return NextResponse.json({ error: 'Internal grading architecture exception.', details: err.message }, { status: 500 });
  }
}