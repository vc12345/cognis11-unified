'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Brain, User, LogIn } from 'lucide-react';
import Link from 'next/link';

export default function GlobalHeader() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setEmail(user.email ?? null);
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
      
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const match = url.match(/https:\/\/(.*?)\.supabase\.co/);
      const projectId = match ? match[1] : null;

      if (projectId) {
        if (session) {
          localStorage.setItem(`sb-${projectId}-auth-token`, JSON.stringify(session));
        } else {
          localStorage.removeItem(`sb-${projectId}-auth-token`);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <header className="w-full bg-white border-b border-[#E5E3DD] px-6 py-3 flex items-center justify-between z-50 relative">
      <Link href="/" className="flex items-center gap-2">
        <Brain className="w-5 h-5 text-[#1B3A5C]" />
        <span className="text-sm font-black tracking-[0.2em] font-mono text-slate-800">COGNIS11</span>
      </Link>
      
      {email ? (
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider bg-[#FAF9F6] border border-[#E5E3DD] px-3 py-1.5 rounded-full">
            <User className="w-3 h-3" />
            {email}
          </div>
          <Link href="/profile" className="text-xs font-bold text-[#1B3A5C] uppercase tracking-wider hover:underline">
            Profile
          </Link>
          <Link href="/account" className="text-xs font-bold text-[#1B3A5C] uppercase tracking-wider hover:underline">
            Account
          </Link>
        </div>
      ) : (
        /* Show Sign In Link if guest user */
        <Link href="/register" className="flex items-center gap-1.5 text-xs font-bold text-[#1B3A5C] uppercase tracking-wider hover:text-slate-700 transition-colors">
          <LogIn className="w-3.5 h-3.5" />
          Sign In
        </Link>
      )}
    </header>
  );
}