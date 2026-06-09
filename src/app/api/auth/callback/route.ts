import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/update-pin';

  if (code) {
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

    // Exchange the raw URL single-use code for real cryptographic session cookies
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    // PASSTHROUGH DIAGNOSTIC: Send the physical Supabase failure up to the login page error banner
    console.error('PKCE Handshake Failure:', error);
    return NextResponse.redirect(`${origin}/login?message=${encodeURIComponent('Handshake Error: ' + error.message)}`);
  }

  return NextResponse.redirect(`${origin}/login?message=No validation code found in URL payload.`);
}