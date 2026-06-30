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
    const { session_id, variant_id, raw_answer, execution_velocity_seconds } = await req.json();

    if (!variant_id || !raw_answer || !session_id) {
      return NextResponse.json({ error: 'Missing mandatory payload variables.' }, { status: 400 });
    }

    const transcript = raw_answer;

    // 1. Ingest Variant & Target Metadata
    const { data: variantData, error: variantError } = await supabaseService
      .from('variants')
      .select('skeleton_id, generated_question, solution_trace, generated_options, correct_answer')
      .eq('id', variant_id)
      .single();

    if (variantError || !variantData) {
      throw new Error(`Variant metadata missing: ${variantError?.message}`);
    }

    const skeleton_id = variantData.skeleton_id;

    // 2. Extract Structural Skeleton Concept Mappings
    const { data: rawSkeletonData, error: skeletonError } = await supabaseService
      .from('skeletons') 
      .select(`
        failure_profile, 
        source_questions (concept)
      `) 
      .eq('id', skeleton_id)
      .single();

    const skeletonData = rawSkeletonData as unknown as JoinedSkeletonData;
    const sourceConcept = Array.isArray(skeletonData?.source_questions) 
        ? skeletonData.source_questions[0]?.concept 
        : (skeletonData?.source_questions as { concept: string })?.concept;
        
    const conceptName = sourceConcept || 'Mathematics';
    const availableWCategories = skeletonData?.failure_profile 
      ? Object.keys(skeletonData.failure_profile) 
      : ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'];

    // 3. Deep Cognitive & Linguistic Instruction Framework
    const systemInstruction = `
      You are the core UK 11+ Spoken Diagnostics Engine for Cognis11. Your purpose is to evaluate a student's spoken math transcript against an elite Junior Math Olympiad shell and output highly granular cognitive telemetry.

      You are evaluating a child up to the end of primary school competing in an educational arms race. Do not mask tracking flaws in vague academic generalities.

      CRITICAL LINGUISTIC ANALYSIS INSTRUCTIONS:
      - Examine raw speech markers in the transcript: repeated phrases, circular corrections, long pauses marked by '[pause]', heavy sighs, defensive tone triggers, and high density of speculative tokens ("maybe", "probably", "um", "uh").
      - Cross-reference the 'execution_velocity_seconds' value provided against problem complexity. High speed + wrong answer maps to schema substitution/rushing. Slow speed + fragmented sentences maps to working memory dropouts.

      STRICT SCHEMATIC ERROR CLASSIFICATION (You must select exactly ONE core parent_facing_error token):
      - "concept_unknown": Completely blind to the underlying rules; zero logical starting point.
      - "app_too_hard": Understands the baseline rule but collapses executing it under multi-layered parameters.
      - "wording_comprehension": Perfectly capable of the math, but fundamentally misread the conditions due to language density.
      - "misinterpreted_simpler": Fast, confident pattern-snapping that completely ignores custom constraints because the problem looked easy.
      - "unjustified_assumption": Flawless internal logic built upon an imaginary, unstated baseline rule not present in the text.
      - "calculation_error": Approach, setup, and concept tracking are 100% sound, but a direct arithmetic slip occurred.
      - "intentional_trap": Direct surrender to designed question misdirection or attractive bait options.
      - "sub_answer_stall": Successfully resolves a massive multi-step milestone but stops and outputs a partial value instead of continuing.
      - "blind_to_solution": Stares at the conditions but cannot see the logical shortcut or puzzle pivot required to solve cleanly.

      You must respond with a raw JSON object matching this schema exactly:
      {
        "teacher_scratchpad": "Step 1 (True Math): [Explicit formula mapping]. Step 2 (Transcript Translation): [Translate raw text to formulas]. Step 3 (Calculated Result): [...]. Step 4 (W-Category Diagnosis): [...].",
        "is_correct": boolean,
        "completion_percentage": number,
        "methodology_used": "EXPECTED_TRACE" | "ALTERNATIVE_VALID" | "ROTE_GUESSING" | "INCOMPLETE_CHAIN",
        "w_category_breakdown": {
          // Explicitly output 1 if demonstrated, 0 if not for every token in: ${JSON.stringify(availableWCategories)}
        },
        "parent_facing_error": "concept_unknown" | "app_too_hard" | "wording_comprehension" | "misinterpreted_simpler" | "unjustified_assumption" | "calculation_error" | "intentional_trap" | "sub_answer_stall" | "blind_to_solution" | null,
        "speech_telemetry": {
          "speech_density_score": number, // 0-100. High density = concise structural words. Low density = circular filler paths.
          "detected_frustration_tokens": boolean, // true if transcript flags heavy sighing, immediate self-defensiveness, or giving up words
          "time_pressure_derailment": boolean, // true if rapid pacing directly caused an unforced reading or processing failure
          "is_structural_flaw": boolean // true if this mistake is born from deep-set behavioral habits (rushing, assumption creation) rather than an isolated arithmetic slip
        },
        "recommended_intervention": "A strict 1-sentence plain-English coaching directive isolating exactly what concept or habit to patch next."
      }
    `;

    const userPrompt = `
      TOPIC FOCUS: ${conceptName}
      QUESTION TEXT: "${variantData.generated_question}"
      CORRECT EXPECTED VALUE: "${variantData.correct_answer || 'N/A'}"
      EXPECTED SOLUTION TRACE: "${variantData.solution_trace}"
      AVAILABLE COMPILING COHORTS: ${JSON.stringify(availableWCategories)}
      
      FRONTEND PACING TELEMETRY:
      - Execution Velocity: ${execution_velocity_seconds} seconds
      
      RAW SPOKEN STUDENT TRANSCRIPT TO PARSE:
      "${transcript}"
    `;

    // 4. Execute High-Fidelity Call to Anthropic
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
      throw new Error(`Anthropic API Exception: ${errText}`);
    }

    const anthropicData = await anthropicResponse.json();
    let rawText = anthropicData.content[0].text.trim();
    
    // Defensive parsing normalization
    const jsonMarker = "\x60\x60\x60json";
    const closingMarker = "\x60\x60\x60";
    if (rawText.startsWith(jsonMarker)) rawText = rawText.slice(7);
    else if (rawText.startsWith(closingMarker)) rawText = rawText.slice(3);
    if (rawText.endsWith(closingMarker)) rawText = rawText.slice(0, -3);
    
    const evaluation = JSON.parse(rawText.trim());

    // 5. Update Structural Aggregates
    const triggeredCategories = Object.entries(evaluation.w_category_breakdown || {})
      .filter(([_, value]) => value === 1)
      .map(([key, _]) => key);

    if (triggeredCategories.length > 0 && skeleton_id) {
      await supabaseService.rpc('increment_failure_map', {
        p_skeleton_id: skeleton_id,
        p_w_categories: triggeredCategories
      });
    }

    // 6. Verify User Identity Guardrail
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

    // 7. Log Comprehensive High-Fidelity Data Matrix
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
          analysis: evaluation // Stores the complete nested data payload cleanly in JSONB
      }]);

    if (insertError) throw insertError;

    return NextResponse.json({ success: true, evaluation });
  } catch (err) {
    console.error('Core Evaluation Engine Crash:', err);
    return NextResponse.json({ error: 'Internal grading architecture exception.' }, { status: 500 });
  }
}