import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { pin } = await req.json();
    
    // FIX: Await the cookies instance to prevent the type resolution failure
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            try {
              cookieStore.set({ name, value, ...options });
            } catch (err) {
              // Next.js sometimes throws if writing cookies in a pure read context; safe to suppress here
            }
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set({ name, value: '', ...options });
            } catch (err) {
              // Safe to suppress
            }
          },
        },
      }
    );
    
    // Fetch user details from the cryptographically verified session
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized Session' }, { status: 401 });
    }

    // Force pull metadata values out of the authenticated data block
    let storedPin = user.user_metadata?.parent_pin;

    // Fallback refresh check to make sure freshly registered accounts catch up instantly
    if (!storedPin) {
      const { data: refreshedUser } = await supabase.auth.refreshSession();
      storedPin = refreshedUser?.user?.user_metadata?.parent_pin;
    }

    // Check entry parameters against metadata profile record
    if (pin === String(storedPin)) {
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json({ error: 'Invalid security code' }, { status: 403 });
  } catch (err) {
    console.error('PIN verification framework exception:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}