import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: 'Missing account context parameter' }, { status: 400 });

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('test_credits')
      .eq('id', userId)
      .single();

    if (!profile || (profile.test_credits || 0) <= 0) {
      return NextResponse.json({ error: 'Insufficient diagnostic tokens' }, { status: 400 });
    }

    const uniqueSessionId = crypto.randomUUID();

    // 1. Deduct Token
    await supabaseAdmin
      .from('profiles')
      .update({ test_credits: profile.test_credits - 1 })
      .eq('id', userId);

    // 2. Safely log the session anchor in the new dedicated table
    const { error: sessionErr } = await supabaseAdmin
      .from('diagnostic_sessions')
      .insert([{
        id: uniqueSessionId,
        user_id: userId,
        status: 'active'
      }]);

    if (sessionErr) throw sessionErr;

    return NextResponse.json({ success: true, sessionId: uniqueSessionId });

  } catch (err: any) {
    console.error("Session Generation Failure:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}