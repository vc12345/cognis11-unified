import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Must use the Service Role Key to bypass RLS and delete from auth.users
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: 'Missing User ID' }, { status: 400 });

    // 1. Delete from public.profiles (if no cascade is set up)
    await supabaseAdmin.from('profiles').delete().eq('id', userId);

    // 2. Delete the root authentication record
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}