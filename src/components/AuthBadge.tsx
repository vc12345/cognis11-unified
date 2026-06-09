'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { LogOut, User } from 'lucide-react';

export default function AuthBadge() {
  const [email, setEmail] = useState<string | null>(null);
  const router = useRouter();
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setEmail(user.email ?? null);
    });
  }, [supabase]);

  const handleLogout = async () => {
    // 1. Terminate Supabase Session
    await supabase.auth.signOut();
    // 2. Clear local PIN bypass cache
    sessionStorage.removeItem('cognis_unlocked');
    // 3. Eject to login
    router.push('/login');
  };

  // Skeleton state while fetching to prevent layout shifts
  if (!email) {
    return <div className="h-3 w-32 bg-slate-100 animate-pulse rounded-full"></div>;
  }

  return (
    <div className="flex items-center gap-4 text-[10px] font-mono tracking-widest uppercase text-slate-400">
      <div className="flex items-center gap-1.5 text-slate-500">
        <User className="w-3 h-3" />
        <span className="truncate max-w-[150px]" title={email}>{email}</span>
      </div>
      <button 
        onClick={handleLogout} 
        className="flex items-center gap-1 hover:text-red-500 transition-colors"
        title="Terminate Secure Session"
      >
        <LogOut className="w-3 h-3" />
        <span>[ Exit ]</span>
      </button>
    </div>
  );
}