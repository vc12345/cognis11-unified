'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { Brain, Activity, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react';

// ============================================================================
// 1. THE CALIBRATION MODAL COMPONENT (Injected from Step 3)
// ============================================================================
function DiagnosticCalibrationModal({ userId, onComplete }: { userId: string, onComplete: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [studentName, setStudentName] = useState('');
  
  // Initialize as empty strings to force explicit selection
  const [academicYear, setAcademicYear] = useState('');
  const [baselineConfidence, setBaselineConfidence] = useState('');
  const [targetTier, setTargetTier] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function checkCalibration() {
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', userId)
        .single();

      if (!profile?.onboarding_completed) setIsOpen(true);
    }
    checkCalibration();
  }, [supabase, userId]);

  const handleSave = async () => {
    // Strict validation check
    if (!studentName.trim() || !academicYear || !baselineConfidence || !targetTier) {
      return alert('Please complete all configuration fields to unlock your dashboard.');
    }
    
    setIsSaving(true);

    await supabase.from('profiles').update({
      student_name: studentName,
      target_tier: targetTier,
      academic_year: academicYear,
      baseline_confidence: baselineConfidence,
      onboarding_completed: true
    }).eq('id', userId);
    
    setIsOpen(false);
    onComplete(); 
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#0B1121]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#FAFAF6] border border-[#E5E3DD] rounded-xl max-w-md w-full p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
        <h2 className="text-2xl font-bold font-serif text-[#1B3A5C] mb-2">Welcome to the portal.</h2>
        <p className="text-slate-500 text-sm mb-6 leading-relaxed">
          Before we load your diagnostic tokens, please explicitly configure the tracking metrics for your child.
        </p>

        <div className="space-y-5">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Child's First Name</label>
            <input type="text" value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="e.g. Leo" className="w-full bg-white border border-[#E5E3DD] px-4 py-3 rounded-lg text-sm outline-none focus:border-[#1B3A5C]" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Academic Year</label>
              <select value={academicYear} onChange={e => setAcademicYear(e.target.value)} className="w-full bg-white border border-[#E5E3DD] px-4 py-3 rounded-lg text-sm outline-none focus:border-[#1B3A5C] text-slate-700">
                <option value="" disabled>Please select...</option>
                <option value="Year 4">Year 4</option>
                <option value="Year 5">Year 5</option>
                <option value="Year 6">Year 6</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Perceived Math Prowess</label>
              <select value={baselineConfidence} onChange={e => setBaselineConfidence(e.target.value)} className="w-full bg-white border border-[#E5E3DD] px-4 py-3 rounded-lg text-sm outline-none focus:border-[#1B3A5C] text-slate-700">
                <option value="" disabled>Please select...</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="extreme">Very High</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Target School Selectivity</label>
            <select value={targetTier} onChange={e => setTargetTier(e.target.value)} className="w-full bg-white border border-[#E5E3DD] px-4 py-3 rounded-lg text-sm outline-none focus:border-[#1B3A5C] text-slate-700">
              <option value="" disabled>Please select...</option>
              <option value="low">Mild (eg. Local Grammar / Independent)</option>
              <option value="medium">High (eg. Renowned Grammar / Independent)</option>
              <option value="high">Extreme (eg. Elite Grammar / Independent)</option>
            </select>
          </div>

          <button onClick={handleSave} disabled={isSaving} className="w-full bg-[#1B3A5C] hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider py-4 rounded-lg transition-all mt-4 shadow-sm">
            {isSaving ? 'Saving...' : 'Save & Unlock Dashboard'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 2. THE MAIN INITIATE PAGE (Modernized)
// ============================================================================
export default function TestInitiatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState<string>('Student');
  const [credits, setCredits] = useState(0);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const determineSessionState = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/register');
      return;
    }
    setUserId(user.id);

    // 1. Read Credits and Details from the NEW public.profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('test_credits, student_name')
      .eq('id', user.id)
      .single();

    if (profile) {
      setCredits(profile.test_credits || 0);
      if (profile.student_name) setStudentName(profile.student_name);
    }

    try {
      // 2. Scan the user_attempts table for unfinished tests
      const { data: recentAttempts } = await supabase
        .from('user_attempts')
        .select('session_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (recentAttempts && recentAttempts.length > 0) {
        const mostRecentSessionId = recentAttempts[0].session_id;
        const totalAnsweredInSession = recentAttempts.filter(
          (attempt) => attempt.session_id === mostRecentSessionId
        ).length;

        const TARGET_BLUEPRINT_LENGTH = 19; 

        if (totalAnsweredInSession < TARGET_BLUEPRINT_LENGTH && mostRecentSessionId) {
          setActiveSessionId(mostRecentSessionId);
          setCompletedCount(totalAnsweredInSession);
        }
      }
    } catch (err) {
      console.error('Session analysis failure:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    determineSessionState();
  }, [router, supabase]);

  const handleLaunchAssessment = async (mode: 'NEW' | 'RESUME') => {
    if (mode === 'RESUME' && activeSessionId) {
      router.push(`/test?session=${activeSessionId}`);
      return;
    }

    if (mode === 'NEW') {
      if (credits <= 0) return alert('Insufficient parameters: Purchase diagnostic credits.');

      // Deduct credit token safely from public.profiles
      const updatedCredits = credits - 1;
      const { error: creditError } = await supabase
        .from('profiles')
        .update({ test_credits: updatedCredits })
        .eq('id', userId);

      if (creditError) return alert(`Token Burn Failure: ${creditError.message}`);

      router.push('/test?session=new');
    }
  };

  const handlePurchase = async (plan: 'one-off' | '6-month', amount: string) => {
    setPurchasing(plan);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, intent: 'diagnostic', plan, amount }),
      });
      const { url } = await response.json();
      if (url) window.location.href = url;
    } catch (err) {
      alert('Payment routing error. Please try again.');
      setPurchasing(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF6] flex items-center justify-center font-serif text-[#1B3A5C] text-lg italic animate-pulse">
        Analyzing Evaluation Matrices...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAF6] text-[#1B3A5C] font-sans selection:bg-amber-200 relative">
      
      {/* 3. INJECT THE MODAL HERE (Renders over everything if onboarding is false) */}
      {userId && <DiagnosticCalibrationModal userId={userId} onComplete={determineSessionState} />}

      <div className="flex-1 max-w-xl w-full mx-auto px-6 py-12 md:py-20 flex flex-col">
        
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-white border border-[#E5E3DD] rounded-xl mb-4 shadow-sm">
            <Brain className="w-6 h-6 text-[#1B3A5C]" />
          </div>
          <h1 className="text-3xl font-bold font-serif mb-2">{studentName}'s Diagnostic Hub</h1>
          <p className="text-sm text-slate-500">Run clinical assessment sweeps for exam readiness.</p>
        </div>

        <main className="space-y-6">
          
          {/* Token Display Block */}
          <div className="bg-white border border-[#E5E3DD] rounded-xl p-8 text-center shadow-sm">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block mb-1">Available Diagnostic Tokens</span>
            <div className="text-5xl font-black font-serif text-[#1B3A5C] tracking-tight">{credits}</div>
          </div>

          <div className="bg-white border border-[#E5E3DD] rounded-xl p-6 shadow-sm space-y-4">
            {activeSessionId ? (
              <div className="space-y-4 border border-amber-200 p-4 bg-amber-50 rounded-lg">
                <div className="text-center space-y-1">
                  <span className="text-[10px] font-bold text-amber-700 tracking-widest uppercase flex items-center justify-center gap-2">
                    <Activity className="w-3 h-3" /> Sequence Interrupted
                  </span>
                  <p className="text-xs text-amber-800/80 leading-relaxed">
                    An unfinished evaluation session was recovered. Progress: {completedCount} units committed.
                  </p>
                </div>
                <button onClick={() => handleLaunchAssessment('RESUME')} className="w-full bg-[#1B3A5C] text-white py-3.5 rounded-md font-bold text-xs uppercase tracking-wider hover:bg-slate-800 transition shadow-sm">
                  Resume Active Sequence
                </button>
              </div>
            ) : (
              <button 
                onClick={() => handleLaunchAssessment('NEW')}
                disabled={credits <= 0}
                className="w-full flex items-center justify-center gap-2 bg-[#1B3A5C] text-white py-4 rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-slate-800 transition disabled:opacity-30 disabled:hover:bg-[#1B3A5C] shadow-sm"
              >
                Initialize New Sweep Sequence <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {/* Commerce Gateway (Shows if 0 credits and no active fragments) */}
            {credits <= 0 && !activeSessionId && (
              <div className="pt-4 border-t border-[#E5E3DD] space-y-3">
                <span className="text-[10px] text-center uppercase tracking-widest text-slate-400 block font-bold">Acquire Telemetry Tokens</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button onClick={() => handlePurchase('one-off', '29')} className="flex items-center justify-between border border-[#E5E3DD] bg-[#FAF9F6] hover:border-[#1B3A5C] px-4 py-3 rounded-lg transition">
                    <div className="text-left">
                      <span className="block text-[10px] font-bold uppercase tracking-wider">One-Off</span>
                      <span className="block text-sm font-bold text-[#1B3A5C]">£29</span>
                    </div>
                    {purchasing === 'one-off' ? <Loader2 className="w-4 h-4 text-slate-400 animate-spin" /> : <ShieldCheck className="w-4 h-4 text-slate-400" />}
                  </button>
                  
                  <button onClick={() => handlePurchase('6-month', '59')} className="flex items-center justify-between border border-blue-200 bg-blue-50 hover:border-blue-300 px-4 py-3 rounded-lg transition relative overflow-hidden">
                    <div className="text-left">
                      <span className="block text-[10px] font-bold text-blue-800 uppercase tracking-wider">6-Month Access</span>
                      <span className="block text-sm font-bold text-blue-900">£59</span>
                    </div>
                    {purchasing === '6-month' ? <Loader2 className="w-4 h-4 text-blue-500 animate-spin" /> : <ShieldCheck className="w-4 h-4 text-blue-500" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="text-center pt-2">
            <button onClick={() => router.push('/diagnostic/dashboard')} className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-[#1B3A5C] transition-colors">
              Access Telemetry Dashboard
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}