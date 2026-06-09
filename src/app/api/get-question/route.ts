import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetId = searchParams.get('id');
    const userId = searchParams.get('user_id');

    // --- MODE A: SPECIFIC QUESTION (Direct Link) ---
    if (targetId) {
      const { data, error } = await supabase
        .from('variants')
        .select('*') // Includes variant_image_url
        .eq('id', targetId)
        .single();
      
      if (error || !data) return NextResponse.json({ error: "Question not found" }, { status: 404 });
      return NextResponse.json(data);
    }

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }

    // --- MODE B: ANTI-PRIMING LOGIC ---
    // We find all shells the user has already touched to ensure we don't serve a variant of the same logic
    const { data: attempts } = await supabase
      .from('user_attempts')
      .select('shell_id')
      .eq('user_id', userId);

    const attemptedShellIds = attempts?.map(a => a.shell_id) || [];

    // Find available shells that the user hasn't seen yet
    let shellQuery = supabase.from('conceptual_shells').select('id');
    if (attemptedShellIds.length > 0) {
      shellQuery = shellQuery.not('id', 'in', `(${attemptedShellIds.join(',')})`);
    }

    const { data: availableShells } = await shellQuery;

    // DEBUG LOGS
    console.log('--- ANTI-PRIMING DEBUG ---');
    console.log('User ID:', userId);
    console.log('Attempted Shells:', attemptedShellIds);
    console.log('Available Shells Remaining:', availableShells?.map(s => s.id));
    console.log('---------------------------');

    // 1. Check if the user has exhausted the bank
    if (!availableShells || availableShells.length === 0) {
      return NextResponse.json({ status: 'complete' });
    }

    // 2. Pick a random shell from the available pool
    const randomShell = availableShells[Math.floor(Math.random() * availableShells.length)];

    // 3. Get variants for that specific shell
    let questionQuery = supabase
      .from('questions')
      .select('*') // This captures variant_image_url
      .eq('shell_id', randomShell.id);

    // --- VERIFICATION GATE (Commented out for now) ---
    // questionQuery = questionQuery.eq('is_verified', true);

    const { data: questions, error: qError } = await questionQuery;

    if (qError || !questions || questions.length === 0) {
        // This handles the "Ghost Shell" (Shell exists but has no verified questions)
        console.error(`ERROR: Shell ${randomShell.id} has no valid questions!`);
        return NextResponse.json({ error: "No questions found for selected shell" }, { status: 500 });
    }

    // 4. Pick a random variant from the shell
    const finalQuestion = questions[Math.floor(Math.random() * questions.length)];

    // 5. Return the question + metadata
    return NextResponse.json({
        ...finalQuestion, 
        debug_available_count: availableShells.length 
    });

  } catch (error: any) {
    console.error('CRITICAL API ERROR:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}