'use client';

import { useState, useEffect, Suspense } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter, useSearchParams } from 'next/navigation';
import { BookOpen, Activity, ArrowRight, Lock, ShieldCheck, Loader2, Play, BarChart2, AlertCircle, Heart } from 'lucide-react';
import Link from 'next/link';

// ============================================================================
// GLOBAL SUPABASE CLIENT
// ============================================================================
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface UserProfile {
  id: string;
  course_type: 'foundational' | 'supplemental' | null;
  course_subscription: boolean;
  test_credits: number;
  diagnostic_subscription_end_date: string | null;
  onboarding_completed: boolean;
  student_name: string | null;
  user_pin: string | null;
}

interface SuspendedSession {
  session_id: string;
  created_at: string;
  completedCount: number;
}

function ProfileHubCore() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  // State: Course Controls
  const [selectedApproach, setSelectedApproach] = useState<'foundational' | 'supplemental' | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  
  // State: Diagnostic Controls
  const [suspendedSessions, setSuspendedSessions] = useState<SuspendedSession[]>([]);
  const [isLaunching, setIsLaunching] = useState(false);

  // State: Dashboard Security Gate
  const [showDashboardLock, setShowDashboardLock] = useState(false);
  const [dashPinInput, setDashPinInput] = useState('');
  const [dashPinError, setDashPinError] = useState('');
  const [dashPinChecking, setDashPinChecking] = useState(false);

  // State: Onboarding Modal
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [academicYear, setAcademicYear] = useState('Year 4');
  const [baselineConfidence, setBaselineConfidence] = useState('on_track');
  const [targetTier, setTargetTier] = useState('standard_11plus');

  // --- CORE DATA HYDRATION ---
  async function loadHubData(showLoader: boolean = true) {
    if (showLoader) setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    setUserEmail(user.email ?? null);

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profileData) {
      setProfile(profileData as UserProfile);
      if (profileData.course_type) setSelectedApproach(profileData.course_type);
      
      // ISSUE 3 FIX: Show modal if not completed, or if trigger is active
      if (!profileData.onboarding_completed || searchParams.get('triggerOnboarding') === 'true') {
        setShowOnboardingModal(true);
      } else {
        setShowOnboardingModal(false); // Force close if coming back from BFCache
      }
    }

    // Capture Multiple Suspended Tests via diagnostic_sessions table
    const { data: activeSessions } = await supabase
      .from('diagnostic_sessions')
      .select('id, created_at')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (activeSessions && activeSessions.length > 0) {
      const parsedSessions: SuspendedSession[] = [];
      
      for (const session of activeSessions) {
        const { count } = await supabase
          .from('user_attempts')
          .select('id', { count: 'exact', head: true })
          .eq('session_id', session.id);

        if ((count || 0) < 19) {
          parsedSessions.push({
            session_id: session.id,
            created_at: session.created_at,
            completedCount: count || 0
          });
        }
      }
      setSuspendedSessions(parsedSessions);
    } else {
      setSuspendedSessions([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadHubData(true); 
    
    // BFCache Unfreeze Protocol
    const handleVisibilityOrBack = (e: PageTransitionEvent | Event) => {
      const isBFCache = ('persisted' in e && e.persisted) || 
                        (window.performance && window.performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming)?.type === "back_forward";
      
      if (isBFCache) {
        setIsProcessingAction(false); 
        setIsLaunching(false);
        loadHubData(false); 
      }
    };
    
    window.addEventListener('pageshow', handleVisibilityOrBack);
    return () => window.removeEventListener('pageshow', handleVisibilityOrBack);
  }, [searchParams, router]);
 

  // --- COURSE MODULE ACTIONS ---
  const handleStripeCheckout = async (intent: 'course' | 'diagnostic', plan: string, amount: number) => {
    if (!profile) return;
    setIsProcessingAction(true);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent, plan, amount, userId: profile.id, email: userEmail })
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert('Checkout Session Initialization Error.');
        setIsProcessingAction(false);
      }
    } catch (err) {
      console.error(err);
      setIsProcessingAction(false);
    }
  };

  const executeCourseLaunch = async () => {
    if (!profile) return;
    setIsProcessingAction(true);
    
    const safeApproach = selectedApproach || 'foundational';

    if (profile.course_type !== safeApproach) {
      await supabase.from('profiles')
        .update({ course_type: safeApproach, course_subscription: false })
        .eq('id', profile.id);
    }
    
    setTimeout(() => {
      setIsProcessingAction(false);
      window.location.href = '/course/members/dashboard.html';
    }, 150);
  };

  const saveOnboarding = async () => {
    if (!profile || !studentName.trim()) return alert('Please enter your child\'s name.');
    
    const { error } = await supabase.from('profiles').update({
      student_name: studentName, academic_year: academicYear,
      baseline_confidence: baselineConfidence, target_tier: targetTier, onboarding_completed: true
    }).eq('id', profile.id);

    // Trap RLS errors so it doesn't fail silently
    if (error) {
      console.error("Database Save Error:", error.message);
      alert("Failed to save profile. Please ensure you have update permissions (RLS).");
      return;
    }

    setProfile({ ...profile, student_name: studentName, onboarding_completed: true });
    setShowOnboardingModal(false);
  };

  // --- DIAGNOSTIC INITIATION ACTIONS ---
  const handleLaunchNewDiagnostic = () => {
    if (!profile || profile.test_credits <= 0) return;
    executeNewSessionGeneration(); 
  };

  const executeNewSessionGeneration = async () => {
    if (!profile) return;
    setIsLaunching(true);
    try {
      const response = await fetch('/api/diagnostic/initialize-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id })
      });
      const data = await response.json();
      if (data.success && data.sessionId) {
        router.push(`/test?session=${data.sessionId}`);
      } else {
        alert(data.error || 'Token processing architecture error.');
        setIsLaunching(false);
      }
    } catch (err) {
      console.error(err);
      setIsLaunching(false);
    }
  };

  // --- DASHBOARD ACCESS LOGIC ---
  const handleDashboardAccess = () => {
    const isUnlocked = sessionStorage.getItem('dashboard_unlocked') === 'true';
    
    if (!profile?.user_pin || profile.user_pin === '000' || isUnlocked) {
      router.push('/diagnostic/dashboard');
    } else {
      setShowDashboardLock(true);
    }
  };

  const verifyDashboardPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (dashPinInput.length !== 3) return;
    setDashPinChecking(true);
    setDashPinError('');
    
    try {
      const res = await fetch('/api/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: dashPinInput, userId: profile?.id })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        sessionStorage.setItem('dashboard_unlocked', 'true');
        router.push('/diagnostic/dashboard');
      } else {
        setDashPinError('Incorrect PIN. Access Denied.');
      }
    } catch (err) {
      setDashPinError('Security endpoint transmission failure.');
    } finally {
      setDashPinChecking(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#FAFAF6] flex items-center justify-center font-mono text-xs tracking-widest text-slate-400 animate-pulse">COMPILING_HUB_RESOURCES...</div>;
  }

  const isCourseEnrolled = profile?.course_type !== null;
  const isCoursePaying = profile?.course_subscription === true;
  const hasCredits = (profile?.test_credits ?? 0) > 0;
  const creditExpiry = profile?.diagnostic_subscription_end_date 
    ? new Date(profile.diagnostic_subscription_end_date).toLocaleDateString('en-GB') 
    : null;

  return (
    <div className="min-h-screen bg-[#FAFAF6] text-[#1B3A5C] font-sans px-6 py-12 relative selection:bg-amber-200">
      
      {/* 1. ONBOARDING DIALOG WINDOW */}
      {showOnboardingModal && (
        <div className="fixed inset-0 bg-[#0B1121]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#FAFAF6] border border-[#E5E3DD] rounded-2xl max-w-md w-full p-8 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div>
              <h2 className="text-xl font-bold font-serif">Calibrate Metrics</h2>
              <p className="text-xs text-slate-400 mt-1">Configure performance anchors for targeted baseline loading.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Child's Name</label>
                <input type="text" value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="e.g. Leo" className="w-full bg-white border border-[#E5E3DD] px-4 py-2.5 rounded-lg text-sm text-[#1B3A5C] outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Academic Year</label>
                  <select value={academicYear} onChange={e => setAcademicYear(e.target.value)} className="w-full bg-white border border-[#E5E3DD] px-3 py-2.5 rounded-lg text-sm text-[#1B3A5C] outline-none">
                    <option value="Year 3">Year 3</option><option value="Year 4">Year 4</option><option value="Year 5">Year 5</option><option value="Year 6">Year 6</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Math Prowess</label>
                  <select value={baselineConfidence} onChange={e => setBaselineConfidence(e.target.value)} className="w-full bg-white border border-[#E5E3DD] px-3 py-2.5 rounded-lg text-sm text-[#1B3A5C] outline-none">
                    <option value="remedial">Below Expected</option><option value="on_track">On Track</option><option value="advanced">Advanced Overviews</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Target School Selectivity</label>
                <select value={targetTier} onChange={e => setTargetTier(e.target.value)} className="w-full bg-white border border-[#E5E3DD] px-3 py-2.5 rounded-lg text-sm text-[#1B3A5C] outline-none">
                  <option value="standard_11plus">Standard 11+ / Local Grammar</option><option value="highly_selective">Highly Selective (e.g. St Paul's)</option>
                </select>
              </div>
              <button onClick={saveOnboarding} className="w-full bg-[#1B3A5C] text-white py-3.5 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-slate-800 transition-all mt-2">Lock Metrics & Open Hub</button>
            </div>
          </div>
        </div>
      )}

      {/* 2. PARENTAL DASHBOARD LOCK MODAL */}
      {showDashboardLock && (
        <div className="fixed inset-0 bg-[#0B1121]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={verifyDashboardPin} className="bg-white border border-[#E5E3DD] rounded-xl max-w-sm w-full p-8 shadow-2xl space-y-4 relative">
            <button type="button" onClick={() => setShowDashboardLock(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">✕</button>
            <div className="flex items-center gap-2 text-amber-600">
              <Lock className="w-5 h-5" />
              <h3 className="font-bold font-serif text-lg text-[#1B3A5C]">Unlock Telemetry</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Enter your parental verification code to view analytical metrics.
            </p>
            <div className="space-y-1">
              <input 
                type="password" maxLength={3} placeholder="000" value={dashPinInput}
                onChange={e => setDashPinInput(e.target.value.replace(/\D/g, ''))}
                disabled={dashPinChecking}
                className="w-full bg-[#FAF9F6] border border-[#E5E3DD] py-3 rounded-xl text-center text-xl font-bold tracking-[0.5em] text-[#1B3A5C] outline-none focus:border-[#1B3A5C]"
              />
              {dashPinError && <p className="text-[11px] font-bold text-rose-600 text-center">{dashPinError}</p>}
            </div>
            <button type="submit" disabled={dashPinChecking || dashPinInput.length !== 3} className="w-full bg-[#1B3A5C] hover:bg-slate-800 text-white py-3.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2">
              {dashPinChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Decrypt Telemetry Matrix'}
            </button>
          </form>
        </div>
      )}

      {/* CORE HUB LAYOUT */}
      <div className="max-w-4xl mx-auto space-y-10">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[#E5E3DD] pb-6 gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-0.5">Central Control Matrix</span>
            <h1 className="text-xl font-bold font-serif">Welcome, {profile?.student_name ? `${profile.student_name}'s Guardian` : userEmail}</h1>
          </div>
          <Link href="/account" className="text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-[#1B3A5C] border border-[#E5E3DD] px-4 py-2 rounded-lg bg-white shadow-sm transition-all">Billing & Settings</Link>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* PRODUCT CARD A: COURSE CURRICULUM */}
          <div className="bg-white border border-[#E5E3DD] rounded-2xl p-8 shadow-sm flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 bg-slate-50 border border-[#E5E3DD] rounded-xl flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-[#1B3A5C]" />
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${
                  !isCourseEnrolled ? 'bg-amber-50 text-amber-800 border border-amber-200 animate-pulse' :
                  isCoursePaying ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-50 text-slate-500 border border-slate-200'
                }`}>
                  {!isCourseEnrolled ? 'Unenrolled' : isCoursePaying ? 'Supporter Active' : 'Free Core Access'}
                </span>
              </div>

              <div>
                <h2 className="text-xl font-bold font-serif mb-1">Curriculum Learning Lattice</h2>
                <p className="text-xs text-slate-400 leading-relaxed">Engage core visual reasoning pipelines across all 11 foundational syllabus tracks.</p>
              </div>

              <div className="bg-[#FAF9F6] border border-[#E5E3DD] rounded-xl p-4 space-y-3">
                <span className="block text-[9px] font-bold uppercase tracking-widest text-slate-400">
                  {isCourseEnrolled ? 'Current Delivery Format (Click to Switch)' : 'Choose Delivery Format'}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {(['foundational', 'supplemental'] as const).map(approachType => (
                    <button 
                      key={approachType} 
                      disabled={isProcessingAction} 
                      onClick={async () => {
                        setSelectedApproach(approachType);
                        if (isCourseEnrolled && profile) {
                          setIsProcessingAction(true);
                          const { error } = await supabase
                            .from('profiles')
                            .update({ course_type: approachType })
                            .eq('id', profile.id);
                          if (!error) setProfile({ ...profile, course_type: approachType });
                          setIsProcessingAction(false);
                        }
                      }} 
                      className={`py-2 text-xs font-bold uppercase tracking-wider rounded border transition-all ${
                        selectedApproach === approachType 
                          ? 'bg-[#1B3A5C] text-white border-[#1B3A5C] shadow-sm' 
                          : 'bg-white border-[#E5E3DD] text-slate-400 hover:text-[#1B3A5C]'
                      }`}
                    >
                      {approachType}
                    </button>
                  ))}
                </div>
                
                <div className="pt-2 text-[11px] text-slate-500 border-t border-[#E5E3DD]/60 leading-relaxed space-y-1">
                  {selectedApproach === 'foundational' && <p>• <span className="font-bold">Foundational (Years 2-4):</span> Sensory layouts, base logic frameworking, and visual decoding paths.</p>}
                  {selectedApproach === 'supplemental' && <p>• <span className="font-bold">Supplemental (Years 4-6):</span> Unlocks advanced mock-exam isolation layers and high-velocity pacing metrics.</p>}
                  {!selectedApproach && <p className="italic text-slate-400">Select an approach to view curriculum parameters.</p>}
                </div>
              </div>

              {(!isCoursePaying && isCourseEnrolled) && (
                <div className="bg-amber-50/60 border border-amber-200/70 p-3.5 rounded-xl text-[11px] text-amber-900 leading-relaxed flex gap-2">
                  <Heart className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 fill-amber-500" />
                  <div>
                    <span className="font-bold">Why support?</span> Help keep our platform completely independent and free of advertising blocks.
                  </div>
                </div>
              )}
            </div>

            <div className="pt-6 mt-8 border-t border-[#E5E3DD]">
              <div className={!isCoursePaying && isCourseEnrolled ? "space-y-3" : ""}>
                <button 
                  onClick={executeCourseLaunch} 
                  disabled={isProcessingAction}
                  className="w-full bg-[#1B3A5C] hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider py-4 rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  {isProcessingAction ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      {isCourseEnrolled ? 'Continue Course' : 'Activate & Launch Course'} <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
                
                {isCourseEnrolled && !isCoursePaying && (
                  <button 
                    onClick={() => handleStripeCheckout('course', 'voluntary', 5)} 
                    disabled={isProcessingAction} 
                    className="w-full bg-white border border-[#E5E3DD] hover:border-amber-500 text-amber-800 text-[10px] font-bold uppercase tracking-wider py-2.5 rounded-lg transition-all text-center"
                  >
                    Help us help more parents and kids (£5/mo)
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* PRODUCT CARD B: THE CONSOLIDATED DIAGNOSTIC HUB */}
          <div className="bg-white border border-[#E5E3DD] rounded-2xl p-8 shadow-sm flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 bg-slate-50 border border-[#E5E3DD] rounded-xl flex items-center justify-center">
                  <Activity className="w-5 h-5 text-[#1B3A5C]" />
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${hasCredits ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}>
                  {profile?.test_credits ?? 0} Active Tokens
                </span>
              </div>

              <div>
                <h2 className="text-xl font-bold font-serif mb-1">Adaptive Audio Diagnostic Room</h2>
                <p className="text-xs text-slate-400 leading-relaxed">Runs cognitive speech analysis models to isolate mental structural gaps during active exam pacing parameters.</p>
              </div>

              <div className="bg-[#FAF9F6] border border-[#E5E3DD] rounded-xl p-4 text-xs space-y-2">
                <div className="flex justify-between items-center"><span className="text-slate-400">Unused Tokens Available:</span> <span className="font-bold text-amber-700">{profile?.test_credits ?? 0}</span></div>
                <div className="flex justify-between items-center"><span className="text-slate-400">Token Expiry Window:</span> <span className="font-bold text-[#1B3A5C]">{creditExpiry ? `${creditExpiry} (6-Month Frame)` : 'No Active Expiry Frame'}</span></div>
              </div>

              {/* DYNAMIC PAUSED SESSION RENDER BLOCK */}
              {suspendedSessions.length > 0 && (
                <div className="space-y-3 pt-2">
                  <span className="block text-[9px] font-bold uppercase tracking-widest text-amber-600 flex items-center gap-1.5"><AlertCircle className="w-3 h-3" /> Paused diagnostics ({suspendedSessions.length})</span>
                  {suspendedSessions.map((session, index) => (
                    <div key={session.session_id} className="bg-amber-50/50 border border-amber-200 p-3 rounded-xl flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-amber-900 block">Session Tracker 00{index + 1}</span>
                        <span className="text-[10px] text-amber-800/80 block">Logged: {new Date(session.created_at).toLocaleDateString()} | Saved: {session.completedCount} questions</span>
                      </div>
                      <Link href={`/test?session=${session.session_id}`} className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[9px] uppercase tracking-wider py-2 px-3 rounded shadow-sm transition-all flex items-center gap-1">
                        Resume <Play className="w-3 h-3 fill-white" />
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-6 mt-8 border-t border-[#E5E3DD] space-y-3">
              {hasCredits ? (
                <div className="space-y-3">
                  <button 
                    onClick={handleLaunchNewDiagnostic} 
                    disabled={isLaunching}
                    className="w-full bg-[#1B3A5C] hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider py-4 rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-40"
                  >
                    {isLaunching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />} 
                    Start a diagnostic
                  </button>
                  <button onClick={handleDashboardAccess} className="w-full bg-white border border-[#E5E3DD] text-[#1B3A5C] hover:bg-slate-50 font-bold text-[10px] uppercase tracking-widest py-3 rounded-lg text-center transition-all flex items-center justify-center gap-1.5 shadow-sm">
                    <BarChart2 className="w-3.5 h-3.5" /> View dashboard
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button onClick={() => handleStripeCheckout('diagnostic', 'one-off', 29)} disabled={isProcessingAction} className="bg-white border border-[#E5E3DD] text-[#1B3A5C] hover:border-[#1B3A5C] font-bold text-[10px] uppercase tracking-wider p-3 rounded-lg text-center transition-all">
                    1 Token (£29)
                  </button>
                  <button onClick={() => handleStripeCheckout('diagnostic', '6-month', 89)} disabled={isProcessingAction} className="bg-gradient-to-br from-amber-50 to-white border-2 border-amber-500 text-[#1B3A5C] font-bold text-[10px] uppercase tracking-wider p-3 rounded-lg text-center transition-all relative shadow-sm hover:shadow">
                    5 Tokens (£89)
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function ProfileHubPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAFAF6] flex items-center justify-center font-mono text-xs tracking-widest text-slate-400 animate-pulse">COMPILING_HUB_RESOURCES...</div>}>
      <ProfileHubCore />
    </Suspense>
  );
}