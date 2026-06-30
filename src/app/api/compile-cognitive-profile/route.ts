import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // 1. Authenticate the Parent Context
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
      return NextResponse.json({ error: 'Unverified parent session.' }, { status: 401 });
    }

    // 2. Pull ALL historical verbal attempts across every diagnostic taken by this child
    const { data: allAttempts, error: fetchError } = await supabaseService
      .from('user_attempts')
      .select(`created_at, session_id, is_correct, solve_time, analysis, variants ( al_classification )`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (fetchError || !allAttempts || allAttempts.length === 0) {
      return NextResponse.json({ error: 'No baseline evaluation data located for this user profile.' }, { status: 404 });
    }

    const rawHistory = allAttempts as any[];

    // 3. Process structural numbers across the entire timeline
    let grandTotal = rawHistory.length;
    let grandCorrect = rawHistory.filter(a => a.is_correct).length;
    
    // Group analysis outputs by session to construct an evolution map for Claude
    const sessionGroups: Record<string, any[]> = {};
    rawHistory.forEach(a => {
      const sid = a.session_id || 'initial_diagnostic';
      if (!sessionGroups[sid]) sessionGroups[sid] = [];
      sessionGroups[sid].push(a);
    });

    // Build a streamlined, low-token chronology summary for Claude to evaluate
    const chronologicalSummary = Object.entries(sessionGroups).map(([sid, attempts], index) => {
      const right = attempts.filter(a => a.is_correct).length;
      const total = attempts.length;
      const sampleAnalysis = attempts.filter(a => !a.is_correct).map(a => {
        const parsed = typeof a.analysis === 'string' ? JSON.parse(a.analysis) : a.analysis;
        return {
          coordinate: parsed?.parent_facing_error || 'unknown_leak',
          structural_flaw: parsed?.speech_telemetry?.is_structural_flaw || false,
          friction: parsed?.speech_telemetry?.parental_friction_detected || false
        };
      });

      return {
        sequence: `Diagnostic Cycle ${index + 1} (Session: ${sid})`,
        metrics: `${right}/${total} Solved Flawlessly`,
        error_samples: sampleAnalysis.slice(0, 8) // Keep context concise and highly focused
      };
    });

    // 4. Instruct Claude to run a global evolutionary audit
    const systemInstruction = `
      You are the Master Cognitive Synthesis Engine for Cognis11. Your task is to review a child's entire chronological testing history across multiple diagnostics and issue a definitive, high-stakes progress verdict.

      You are speaking directly to parents invested in a high-pressure educational arms race. You must evaluate the raw truth: is the child improving, stalling, or panicking under prolonged exposure to elite test parameters?

      You must evaluate these precise operational matrices:
      - Evolution Tracking: Compare older diagnostic cycles against recent ones. Are structural errors converting into minor computational flukes, or is the logic ceiling frozen?
      - Behavioral Trends: Look across the historical timeline to confirm if parental friction markers or time-crunch panics are decaying or escalating.

      You must return a raw JSON object matching this schema exactly:
      {
        "evolution_verdict": "A concise text summary explaining if the child is genuinely progressing across cycles or hitting an unyielding ceiling.",
        "coaching_triage_focus": "The single highest return focus area for the upcoming weeks based on cumulative historical gaps.",
        "parental_delusion_check": "A direct, unvarnished statement telling the parents if their current school choices track with long-term historical performance maps.",
        "tutor_handover_directive": "A single sentence explaining exactly what habit or error pattern a private tutor needs to break immediately."
      }
    `;

    const userPrompt = `
      CUMULATIVE TEST COUNT: ${grandTotal} Total Question Shells Encountered
      HISTORICAL ACCURACY OVERALL: ${grandCorrect} / ${grandTotal} Solved Correctly
      
      CHRONOLOGICAL TESTING LOGS:
      ${JSON.stringify(chronologicalSummary, null, 2)}
    `;

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6', 
        max_tokens: 1500,
        temperature: 0.1,
        system: systemInstruction,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      throw new Error(`Anthropic global synthesis failed: ${errText}`);
    }

    const anthropicData = await anthropicResponse.json();
    let rawText = anthropicData.content[0].text.trim();
    
    // Normalize JSON formatting
    const marker = "\x60\x60\x60json";
    if (rawText.startsWith(marker)) rawText = rawText.slice(7);
    if (rawText.endsWith("\x60\x60\x60")) rawText = rawText.slice(0, -3);
    
    const globalVerdict = JSON.parse(rawText.trim());

    // 5. Cache the compiled result directly into a session_summaries table for the dashboard to read
    const { error: upsertError } = await supabaseService
      .from('session_summaries')
      .upsert({
        user_id: user.id,
        updated_at: new Date().toISOString(),
        global_stats: { grandTotal, grandCorrect },
        ai_synthesis: globalVerdict
      }, { onConflict: 'user_id' });

    if (upsertError) throw upsertError;

    return NextResponse.json({ success: true, globalVerdict });
  } catch (err) {
    console.error('Global Synthesis Engine Failure:', err);
    return NextResponse.json({ error: 'Internal global processing exception.' }, { status: 500 });
  }
}