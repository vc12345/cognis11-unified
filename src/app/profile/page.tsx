'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

export default function ProfileCalibrationPage() {
  const router = useRouter();
  
  // System State
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Diagnostic Parameters
  const [targetTier, setTargetTier] = useState('TIER_2_SELECTIVE');
  const [schoolYear, setSchoolYear] = useState('YEAR_5');
  const [perceivedBaseline, setPerceivedBaseline] = useState('SECURE');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function loadProfileState() {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        router.push('/login');
        return;
      }

      // Hydrate state from existing metadata if available
      const meta = user.user_metadata;
      if (meta?.target_tier) setTargetTier(meta.target_tier);
      if (meta?.school_year) setSchoolYear(meta.school_year);
      if (meta?.perceived_baseline) setPerceivedBaseline(meta.perceived_baseline);
      
      setLoading(false);
    }

    loadProfileState();
  }, [router, supabase.auth]);

  const executeSaveParameters = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage('');

    const { error } = await supabase.auth.updateUser({
      data: {
        target_tier: targetTier,
        school_year: schoolYear,
        perceived_baseline: perceivedBaseline
      }
    });

    if (error) {
      setMessage(`Calibration Error: ${error.message}`);
      setIsSaving(false);
    } else {
      setMessage('Target parameters cryptographically secured.');
      
      // Delay routing briefly so the user sees the success message
      setTimeout(() => {
        router.push('/test-initiate');
      }, 1500);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center font-mono text-xs tracking-widest uppercase text-zinc-400 animate-pulse">
        Fetching Calibration Profiles...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-white text-zinc-900 px-6 py-12 font-mono selection:bg-zinc-900 selection:text-white">
      
      {/* Infrastructure Header */}
      <header className="max-w-md w-full mx-auto flex items-center justify-between border-b border-zinc-200 pb-4">
        <span className="text-sm font-black tracking-[0.2em] text-zinc-900">COGNIS11</span>
        <span className="text-[10px] text-zinc-400 tracking-wider">TARGET_CALIBRATION</span>
      </header>

      {/* Main Configuration Panel */}
      <main className="max-w-md w-full mx-auto my-auto py-12 space-y-8">
        
        <div className="text-center space-y-2">
          <h1 className="text-xs font-bold uppercase tracking-widest text-zinc-900">Diagnostic Baseline Setup</h1>
          <p className="text-[9px] text-zinc-500 uppercase leading-relaxed max-w-sm mx-auto">
            Establish expected execution thresholds. These parameters govern the success lines drawn on your telemetry dashboard.
          </p>
        </div>

        <form onSubmit={executeSaveParameters} className="space-y-8 bg-zinc-50/50 border border-zinc-200 p-6 shadow-sm">
          
          {/* Target Selectivity Block */}
          <div className="space-y-3">
            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block border-b border-zinc-200 pb-2">
              1. Target School Selectivity
            </label>
            <div className="space-y-2">
              {[
                { id: 'TIER_1_ELITE', label: 'Tier 1 Elite', desc: 'Top 5% National (e.g. St Paul\'s, Westminster)' },
                { id: 'TIER_2_SELECTIVE', label: 'Tier 2 Selective', desc: 'Top 15% (Highly Selective Grammar/Indy)' },
                { id: 'TIER_3_GRAMMAR', label: 'Tier 3 Grammar', desc: 'Top 30% (Standard Local Grammar)' }
              ].map(tier => (
                <label key={tier.id} className={`flex flex-col p-3 border cursor-pointer transition-colors ${targetTier === tier.id ? 'bg-zinc-900 border-zinc-900 text-white' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-400'}`}>
                  <div className="flex items-center gap-3">
                    <input 
                      type="radio" name="targetTier" value={tier.id} 
                      checked={targetTier === tier.id} onChange={(e) => setTargetTier(e.target.value)}
                      className="sr-only" 
                    />
                    <span className="text-[10px] uppercase font-bold tracking-wider">{tier.label}</span>
                  </div>
                  <span className={`text-[9px] mt-1 ml-5 uppercase tracking-wide ${targetTier === tier.id ? 'text-zinc-400' : 'text-zinc-400'}`}>{tier.desc}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Chronological State Block */}
          <div className="space-y-3">
            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block border-b border-zinc-200 pb-2">
              2. Current Academic Year
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['YEAR_4', 'YEAR_5', 'YEAR_6'].map(year => (
                <label key={year} className={`text-center py-2 border cursor-pointer transition-colors ${schoolYear === year ? 'bg-zinc-900 border-zinc-900 text-white' : 'bg-white border-zinc-200 text-zinc-400 hover:text-zinc-900'}`}>
                  <input 
                    type="radio" name="schoolYear" value={year} 
                    checked={schoolYear === year} onChange={(e) => setSchoolYear(e.target.value)}
                    className="sr-only" 
                  />
                  <span className="text-[10px] uppercase font-bold tracking-widest">{year.replace('_', ' ')}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Perceived Baseline Block */}
          <div className="space-y-3">
            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block border-b border-zinc-200 pb-2">
              3. Perceived Current Math Ability
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'FOUNDATIONAL', label: 'Below Avg' },
                { id: 'SECURE', label: 'Expected' },
                { id: 'ACCELERATED', label: 'Advanced' }
              ].map(ability => (
                <label key={ability.id} className={`text-center py-2 border cursor-pointer transition-colors ${perceivedBaseline === ability.id ? 'bg-zinc-900 border-zinc-900 text-white' : 'bg-white border-zinc-200 text-zinc-400 hover:text-zinc-900'}`}>
                  <input 
                    type="radio" name="perceivedBaseline" value={ability.id} 
                    checked={perceivedBaseline === ability.id} onChange={(e) => setPerceivedBaseline(e.target.value)}
                    className="sr-only" 
                  />
                  <span className="text-[9px] uppercase font-bold tracking-widest">{ability.label}</span>
                </label>
              ))}
            </div>
          </div>

          {message && (
            <div className={`text-[10px] text-center uppercase tracking-wide font-bold p-2 border ${message.includes('Error') ? 'bg-red-50 border-red-200 text-red-600' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
              * {message}
            </div>
          )}

          <div className="pt-2">
            <button 
              type="submit" 
              disabled={isSaving}
              className="w-full bg-zinc-900 text-white py-4 font-bold text-xs uppercase tracking-widest hover:bg-zinc-800 transition disabled:opacity-50 rounded-none shadow-sm"
            >
              {isSaving ? 'Writing Parameters...' : 'Save & Proceed to Hub'}
            </button>
          </div>
        </form>

        <div className="text-center pt-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-[9px] font-mono tracking-widest uppercase text-zinc-400 hover:text-zinc-900 underline decoration-zinc-200 transition-colors"
          >
            Cancel & Return to Telemetry
          </button>
        </div>

      </main>

      {/* Footer Infrastructure */}
      <footer className="max-w-md w-full mx-auto text-center text-[9px] tracking-widest text-zinc-400 uppercase">
        Profiles drive predictive modeling // Cognis11 Diagnostic Engine
      </footer>
    </div>
  );
}