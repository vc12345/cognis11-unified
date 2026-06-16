import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js'; // Import this to query public.profiles

export async function POST(req: Request) {
  try {
    const { pin } = await req.json();
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set(name: string, value: string, options: any) {
            try { cookieStore.set({ name, value, ...options }); } catch (err) {}
          },
          remove(name: string, options: any) {
            try { cookieStore.set({ name, value: '', ...options }); } catch (err) {}
          },
        },
      }
    );
    
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized Session' }, { status: 401 });
    }

    // FIX: Instead of looking in metadata, query the public.profiles table
    // We use a regular anon client here; as long as the user is logged in, 
    // your RLS policies should allow them to select their own profile row.
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_pin')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile data unreadable' }, { status: 404 });
    }

    // Compare the incoming PIN with the one from the database
    if (pin === profile.user_pin) {
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json({ error: 'Invalid security code' }, { status: 403 });
  } catch (err) {
    console.error('PIN verification framework exception:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}