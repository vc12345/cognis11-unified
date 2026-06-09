'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import AuthBadge from '../../components/AuthBadge';

export default function TestInitiatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState(0);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [completedCount, setCompletedCount] = useState(0);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function determineSessionState() {
      // 1. Verify Authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push('/login');
        return;
      }

      // 2. Extract Token Balance from Profile Metadata
      const userCredits = user.user_metadata?.test_credits ?? 0;
      setCredits(userCredits);

      try {
        // 3. Scan the user_attempts table to see if an unfinished test exists
        // We look for their most recent session entry
        const { data: recentAttempts, error: dbError } = await supabase
          .from('user_attempts')
          .select('session_id, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (dbError) throw dbError;

        if (recentAttempts && recentAttempts.length > 0) {
          const mostRecentSessionId = recentAttempts[0].session_id;

          // Group items by this session ID to see how far they got
          const totalAnsweredInSession = recentAttempts.filter(
            (attempt) => attempt.session_id === mostRecentSessionId
          ).length;

          // Our fixed Blueprint length is 19 items (extendable to 28-30 in production)
          const TARGET_BLUEPRINT_LENGTH = 19; 

          if (totalAnsweredInSession < TARGET_BLUEPRINT_LENGTH && mostRecentSessionId) {
            // Found a fragmented, incomplete test session!
            setActiveSessionId(mostRecentSessionId);
            setCompletedCount(totalAnsweredInSession);
          }
        }
      } catch (err) {
        console.error('Session analysis failure:', err);
      } finally {
        setLoading(false);
      }
    }

    determineSessionState();
  }, [router, supabase]);

  const handleLaunchAssessment = async (mode: 'NEW' | 'RESUME') => {
    if (mode === 'RESUME' && activeSessionId) {
      router.push(`/test?session=${activeSessionId}`);
      return;
    }

    if (mode === 'NEW') {
      if (credits <= 0) {
        alert('Insufficient parameters: Purchase diagnostic credits to deploy a new sequence.');
        return;
      }

      // Deduct credit token over client metadata before deployment
      const updatedCredits = credits - 1;
      const { error: creditError } = await supabase.auth.updateUser({
        data: { test_credits: updatedCredits }
      });

      if (creditError) {
        alert(`Token Burn Failure: ${creditError.message}`);
        return;
      }

      // Send to runner with the 'new' command flag
      router.push('/test?session=new');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center font-mono text-xs tracking-widest uppercase text-zinc-400 animate-pulse">
        Analyzing Session Fragment Parameters...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-white text-zinc-900 px-6 py-12 font-mono selection:bg-zinc-900 selection:text-white">
      
      {/* Structural Header */}
      <header className="max-w-md w-full mx-auto flex flex-col gap-3 border-b border-zinc-200 pb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-black tracking-[0.2em] text-zinc-900">COGNIS11</span>
          <span className="text-[10px] text-zinc-400 tracking-wider">ROUTER_CORE_v2.0</span>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-zinc-100">
          <AuthBadge />
        </div>
      </header>

      {/* Main Command Console */}
      <main className="max-w-sm w-full mx-auto my-auto py-16 space-y-10">
        
        {/* State Display Block */}
        <div className="border border-zinc-200 bg-zinc-50 p-6 text-center space-y-2">
          <span className="text-[9px] uppercase tracking-widest text-zinc-400 block font-bold">Cryptographic Ledger Status</span>
          <div className="text-3xl font-black text-zinc-900 tracking-tight">{credits}</div>
          <span className="text-[9px] uppercase tracking-widest text-zinc-500 block">Available Diagnostic Tokens</span>
        </div>

        <div className="space-y-4">
          {activeSessionId ? (
            /* CASE 1: Fragment Detected -> Offer Resume Channel */
            <div className="space-y-4 border border-dashed border-zinc-300 p-4 bg-zinc-50/50">
              <div className="text-center space-y-1">
                <span className="text-[10px] font-bold text-amber-600 tracking-widest uppercase">[FRAGMENT_DETECTION_ALERT]</span>
                <p className="text-[9px] text-zinc-500 uppercase leading-relaxed">
                  An unfinished evaluation session was recovered.<br />Progress: {completedCount} units committed.
                </p>
              </div>
              <button 
                onClick={() => handleLaunchAssessment('RESUME')}
                className="w-full bg-zinc-900 text-white py-4 font-bold text-xs uppercase tracking-widest hover:bg-zinc-800 transition shadow-sm"
              >
                Resume Active Sequence
              </button>
            </div>
          ) : (
            /* CASE 2: Clean slate -> Deploy with credit check */
            <button 
              onClick={() => handleLaunchAssessment('NEW')}
              disabled={credits <= 0}
              className="w-full bg-zinc-900 text-white py-4 font-bold text-xs uppercase tracking-widest hover:bg-zinc-800 transition disabled:opacity-20 disabled:hover:bg-zinc-900 shadow-sm"
            >
              Initialize New Sweep Sequence
            </button>
          )}

          {/* Commerce Gateway Callouts (Stripe Triggers Hooked Here Later) */}
          {credits <= 0 && !activeSessionId && (
            <div className="pt-2 space-y-2">
              <span className="text-[8px] text-center uppercase tracking-widest text-zinc-400 block font-bold">Secure Commerce Channels</span>
              <div className="grid grid-cols-2 gap-2">
                <button className="border border-zinc-200 text-zinc-900 hover:border-zinc-900 py-3 text-[10px] uppercase font-bold tracking-wider transition">
                  Buy 1 Test (£29)
                </button>
                <button className="border border-zinc-200 text-zinc-900 hover:border-zinc-900 py-3 text-[10px] uppercase font-bold tracking-wider transition">
                  Buy 5 Bundle (£99)
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="text-center pt-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-[9px] font-mono tracking-widest uppercase text-zinc-400 hover:text-zinc-900 underline decoration-zinc-200 transition-colors"
          >
            Access Analyst Telemetry Dashboard
          </button>
        </div>

      </main>

      <footer className="max-w-md w-full mx-auto text-center text-[9px] tracking-widest text-zinc-400 uppercase">
        Execution requires explicit credit authorization or fragment matching.
      </footer>
    </div>
  );
}