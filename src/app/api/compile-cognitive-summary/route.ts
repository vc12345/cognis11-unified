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
    // 1. Authenticate Parent Context Contextually
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
      return NextResponse.json({ error: 'Unverified parent session profile.' }, { status: 401 });
    }

    // Parse the targeting session ID out of the incoming payload body
    const { session_id } = await req.json().catch(() => ({ session_id: null }));

    // 2. Lock down the diagnostic session status via the Service Role bypass client
    if (session_id) {
      const { error: patchError } = await supabaseService
        .from('diagnostic_sessions')
        .update({ status: 'completed' })
        .eq('id', session_id);
        
      if (patchError) {
        console.error("Critical Session Status Update Error:", patchError);
      }
    }

    // 3. Extract Complete Historical Spoken Traces Across All Sessions
    const { data: allAttempts, error: fetchError } = await supabaseService
      .from('user_attempts')
      .select(`created_at, session_id, is_correct, solve_time, analysis`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (fetchError || !allAttempts || allAttempts.length === 0) {
      return NextResponse.json({ error: 'No raw question telemetry located to run synthesis against.' }, { status: 404 });
    }

    const rawHistory = allAttempts as any[];
    
    const sessionGroups: Record<string, any[]> = {};
    rawHistory.forEach(a => {
      const sid = a.session_id || 'historical_migration';
      if (!sessionGroups[sid]) sessionGroups[sid] = [];
      sessionGroups[sid].push(a);
    });

    const chronologicalLedger = Object.entries(sessionGroups).map(([sid, attempts], index) => {
      const right = attempts.filter(a => a.is_correct).length;
      const total = attempts.length;
      
      const itemizedBreakdown = attempts.map(a => {
        const parsed = typeof a.analysis === 'string' ? JSON.parse(a.analysis) : a.analysis;
        return {
          is_correct: a.is_correct,
          speed_seconds: a.solve_time,
          error_node: parsed?.parent_facing_error || parsed?.error_reason || 'none',
          is_habitual: parsed?.speech_telemetry?.is_structural_flaw || false,
          friction_triggered: parsed?.speech_telemetry?.parental_friction_detected || false
        };
      });

      return {
        sequence: `Diagnostic Boundary Cycle ${index + 1} (Session: ${sid})`,
        scorecard: `${right} / ${total} Correctly Isolated`,
        question_telemetry: itemizedBreakdown
      };
    });

    // 4. Construct the Elite 1-on-1 Tutor System Prompt
    const systemInstruction = `
      You are an elite, highly critical 1-on-1 UK 11+ Master Tutor who has worked extensively with this child. Your task is to review their chronological math testing footprint and generate a brutally honest, deeply perceptive narrative synthesis of where they stand.

      You are speaking directly to highly invested parents who are financing a high-stakes educational journey. You must drop generic educational boilerplate. Speak with authority, empathy, and absolute clarity.

      YOUR NARRATIVE REPORT MUST DIRECTLY ADDRESS THESE FIVE PILLARS:
      1. PREPARATION ALTITUDE: Exactly where the child stands right now in relation to clearing elite selective or grammar filters.
      2. LOGICAL BLIND SPOTS: What their specific cognitive weaknesses are when analyzing hidden textual constraints.
      3. THINKING PROCESS: How their brain actually processes data under load (e.g., do they drop constraints, guess defensively, or stall at intermediate calculations?).
      4. SHORT-HORIZON TRIAGE: What can realistically be rewired and patched in a final 12-week crunch window.
      5. UNYIELDING CEILINGS: What cannot realistically be changed or fixed on a short timeline (e.g., core text comprehension habits or deep-set tracking panic).

      OUTPUT REQUIREMENT:
      You must respond with a raw JSON object containing a single key "tutor_narrative". The string value must be a beautifully formatted, highly detailed analysis utilizing clean Markdown formatting (headers, bold text, bullet items) for clear scannability.
      
      Your response schema must match this layout exactly:
      {
        "tutor_narrative": "### 1. Current Preparation Altitude\\n[Your deep analysis here...]\\n\\n### 2. Core Cognitive Failures & Weaknesses\\n[Your deep analysis here...]"
      }
    `;

    const userPrompt = `
      CUMULATIVE METRICS PROFILE:
      - Total Question Shells Encountered: ${rawHistory.length}
      - Total Flawless Logical Paths: ${rawHistory.filter(a => a.is_correct).length}
      
      COMPLETE CHRONOLOGICAL ERROR & VELOCITY HISTORY LOGS:
      ${JSON.stringify(chronologicalLedger, null, 2)}
    `;

    // 5. Fire Request to Anthropic Core
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6', 
        max_tokens: 2500,
        temperature: 0.2,
        system: systemInstruction,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      throw new Error(`Anthropic global synthesis architecture failed: ${errText}`);
    }

    const anthropicData = await anthropicResponse.json();
    let rawText = anthropicData.content[0].text.trim();
    
    const marker = "\x60\x60\x60json";
    if (rawText.startsWith(marker)) rawText = rawText.slice(7);
    if (rawText.endsWith("\x60\x60\x60")) rawText = rawText.slice(0, -3);
    
    const parsedPayload = JSON.parse(rawText.trim());
    const finalNarrativeString = parsedPayload.tutor_narrative;

    if (!finalNarrativeString) {
      throw new Error('Claude response missing mandatory tutor_narrative payload property.');
    }

    // 6. Upsert the Aggregated Tutor Summary Directly into cache
    const { error: upsertError } = await supabaseService
      .from('cognitive_summaries')
      .upsert({
        user_id: user.id,
        updated_at: new Date().toISOString(),
        tutor_narrative: finalNarrativeString
      }, { onConflict: 'user_id' });

    if (upsertError) throw upsertError;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Global Synthesis Engine Failure:', err);
    return NextResponse.json({ error: err.message || 'Internal compilation error.' }, { status: 500 });
  }
}