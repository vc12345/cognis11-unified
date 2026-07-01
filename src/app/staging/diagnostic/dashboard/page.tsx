'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { 
  Brain, Gauge, Clock, Calendar, CheckCircle2, XCircle, 
  MessageSquare, TrendingUp, Sparkles, AlertCircle, ShieldAlert,
  HelpCircle, ChevronRight, BookOpen, Layers, BarChart2, Loader2
} from 'lucide-react';
import AuthBadge from '../../../../components/AuthBadge';

import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

// --- TYPE DEFINITIONS ---
interface AttemptRow {
  id: string;
  created_at: string;
  is_correct: boolean;
  solve_time: number;
  step_velocities: { step1: number; step2: number; step3: number } | null;
  transcript: string | { step1: string; step2: string; step3: string; confidence?: string };
  variants: {
    generated_question: string;
    correct_answer: string;
  } | null;
  skeletons: {
    al_classification: string;
  } | null;
  analysis: {
    teacher_scratchpad?: string;
    recommended_intervention?: string;
    w_category_breakdown?: Record<string, number>;
    error_reason?: string | null;
    methodology_used?: string;
    speech_telemetry?: {
      speech_density_score?: number;
      detected_frustration_tokens?: boolean;
      time_pressure_derailment?: boolean;
      is_structural_flaw?: boolean;
    };
  } | null;
}

type TimeWindow = 'month' | 'quarter' | 'all';

const W_NAMES: Record<string, string> = {
  W1: 'Concept Unknown',
  W2: 'Application Ceiling',
  W3: 'Passive Linguistic Parsing',
  W4: 'Proactive Schema Substitution',
  W5: 'Implicit Assumption Bias',
  W6: 'Operational / Calculation Slip',
  W7: 'Reactive Seduction (Trap Sprung)',
  W8: 'Horizontal Working Memory Overflow',
  W9: 'Metacognitive Absurdity Tolerance'
};

const W_DESCRIPTIONS: Record<string, string> = {
  W1: 'Lacks the mathematical framework or baseline tool to address the problem entirely.',
  W2: 'Recognizes the concept but breaks down when deep abstraction or multi-layered variables are introduced.',
  W3: 'Reading mechanics failure—passes over or skips written conditions (e.g., negative modifiers).',
  W4: 'Rushed pattern matching; forces an old layout onto a question because of superficial surface similarities.',
  W5: 'Builds an internally logical strategy upon a completely unstated, self-invented premise.',
  W7: 'Falls directly for a designed distractor element or an attractive partial calculation output.',
  W6: 'Conceptual tracking is perfect, but a basic, isolated mental arithmetic slip occurred.',
  W8: 'Can execute steps in isolation, but drops intermediate coordinates or loses track mid-calculation.',
  W9: 'Arrives at a contextually impossible output but accepts the result without validating against reality.'
};

const renderLatexString = (text: string) => {
  if (!text) return null;
  const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);
  return parts.map((part, index) => {
    if (part.startsWith('$$') && part.endsWith('$$')) {
      return <BlockMath key={index} math={part.slice(2, -2)} />;
    } else if (part.startsWith('$') && part.endsWith('$')) {
      return <InlineMath key={index} math={part.slice(1, -1)} />;
    }
    return <span key={index}>{part}</span>;
  });
};

export default function PremiumDiagnosticDashboard() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isResumable, setIsResumable] = useState(false);
  const [tutorNarrative, setTutorNarrative] = useState<string>('');
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [completedTestsCount, setCompletedTestsCount] = useState(0);
  const [selectedWindow, setSelectedWindow] = useState<TimeWindow>('all');
  const [activeLogId, setActiveLogId] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  async function loadDashboardData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    // 1. Session state compilation
    const { data: sessions } = await supabase
      .from('diagnostic_sessions')
      .select('status');
    
    if (sessions) {
      setCompletedTestsCount(sessions.filter(s => s.status === 'completed').length);
      setIsResumable(sessions.some(s => s.status === 'active'));
    }

    // 2. Extract narrative insights
    const { data: summaryData } = await supabase
      .from('cognitive_summaries')
      .select('tutor_narrative')
      .eq('user_id', user.id)
      .maybeSingle();

    setTutorNarrative(summaryData?.tutor_narrative || 'Holistic roadmap analysis maps here upon completion of a full diagnostic run.');

    // 3. Extract deep scaffolding attempts with corrected multi-table relationship structures
    const { data: attemptRows, error } = await supabase
      .from('user_attempts')
      .select(`
        id,
        created_at,
        is_correct,
        solve_time,
        step_velocities,
        transcript,
        analysis,
        variants (
          generated_question,
          correct_answer
        ),
        skeletons (
          al_classification
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && attemptRows) {
      // Defensive parsing layer: transforms stringified JSON payloads back into target objects safely
      const normalizedAttempts = (attemptRows as any[]).map(row => {
        let cleanAnalysis = row.analysis;
        if (typeof cleanAnalysis === 'string') {
          try {
            cleanAnalysis = JSON.parse(cleanAnalysis);
          } catch (e) {
            console.error("Malformed database JSON element normalized to blank state container:", e);
            cleanAnalysis = {};
          }
        }
        return { ...row, analysis: cleanAnalysis };
      });

      setAttempts(normalizedAttempts);
      if (normalizedAttempts.length > 0) {
        setActiveLogId(normalizedAttempts[0].id);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    if (isMounted) loadDashboardData();
  }, [isMounted]);

  // --- FILTERS AND METRICS COMPILATION ENGINE ---
  const filteredAttempts = useMemo(() => {
    const now = new Date();
    return attempts.filter(a => {
      const createdAt = new Date(a.created_at);
      const diffTime = Math.abs(now.getTime() - createdAt.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (selectedWindow === 'month') return diffDays <= 30;
      if (selectedWindow === 'quarter') return diffDays <= 90;
      return true;
    });
  }, [attempts, selectedWindow]);

  const metrics = useMemo(() => {
    const total = filteredAttempts.length;
    const correctCount = filteredAttempts.filter(a => a.is_correct).length;
    
    let totalSelfCorrections = 0;
    const errorsCount: Record<string, number> = {
      W1: 0, W2: 0, W3: 0, W4: 0, W5: 0, W6: 0, W7: 0, W8: 0, W9: 0
    };

    filteredAttempts.forEach(a => {
      const isCorrect = a.is_correct;
      const scratch = a.analysis?.teacher_scratchpad?.toLowerCase() || '';
      if (isCorrect && (scratch.includes('self-correct') || scratch.includes('caught'))) {
        totalSelfCorrections++;
      }

      const breakdown = a.analysis?.w_category_breakdown;
      if (breakdown) {
        Object.keys(errorsCount).forEach(k => {
          if (breakdown[k] === 1 || a.analysis?.error_reason === k) {
            errorsCount[k]++;
          }
        });
      } else if (!isCorrect && a.analysis?.error_reason) {
        const reason = a.analysis.error_reason;
        if (errorsCount[reason] !== undefined) errorsCount[reason]++;
      }
    });

    return {
      totalAnswers: total,
      accuracyRate: total > 0 ? Math.round((correctCount / total) * 100) : 0,
      selfCorrectionRate: total > 0 ? Math.round((totalSelfCorrections / total) * 100) : 0,
      errorMatrix: errorsCount
    };
  }, [filteredAttempts]);

  // --- REGIONAL COMPETITIVE SELECTIVITY INDEX GAUGE ---
  const selectivityIndex = useMemo(() => {
    if (attempts.length === 0) return { tier: 'Baseline Audit Needed', description: 'Complete initial diagnostic sequences to calibrate capability ranges.', styling: 'text-slate-400 bg-slate-50 border-slate-200' };
    
    const overallAccuracy = Math.round((attempts.filter(a => a.is_correct).length / attempts.length) * 100);
    const complexFailures = (metrics.errorMatrix.W1 || 0) + (metrics.errorMatrix.W2 || 0) + (metrics.errorMatrix.W5 || 0);

    if (overallAccuracy >= 82 && complexFailures <= 1) {
      return {
        tier: 'Tier 1: Ultra-Selective Profile',
        description: 'Demonstrates optimal working memory capacity and linguistic filters. Fully competitive for top-tier highly selective London Grammars and independent boarding shells.',
        styling: 'text-emerald-800 bg-emerald-50 border-emerald-200'
      };
    }
    if (overallAccuracy >= 60 && complexFailures <= 4) {
      return {
        tier: 'Tier 2: Highly Selective Profile',
        description: 'Solid conceptual foundations present. Cognitive breakdowns occur primarily under speed-induced pressure blocks or intentional traps. Competitive for regional selective systems.',
        styling: 'text-amber-800 bg-amber-50 border-amber-200'
      };
    }
    return {
      tier: 'Tier 3: Standard Local Stream',
      description: 'Foundational tool gaps or structural substitution tendencies are currently impacting application stamina. Focus on systematic constraint tracking rather than pacing drills.',
      styling: 'text-blue-800 bg-blue-50 border-blue-200'
    };
  }, [attempts, metrics]);

  const activeLogItem = useMemo(() => {
    return attempts.find(a => a.id === activeLogId) || null;
  }, [attempts, activeLogId]);

  const activeTranscriptParsed = useMemo(() => {
    if (!activeLogItem) return null;
    const t = activeLogItem.transcript;
    if (typeof t === 'string') {
      try { return JSON.parse(t); } catch { return { step3: t }; }
    }
    return t;
  }, [activeLogItem]);

  if (loading || !isMounted) {
    return (
      <div className="min-h-screen bg-[#FAFAF6] flex flex-col items-center justify-center font-serif text-sm text-[#1B3A5C] animate-pulse">
        <Loader2 className="w-6 h-6 animate-spin mb-2" />
        Compiling tracking matrices... Synchronizing historical cognitive runs...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF6] text-[#1B3A5C] font-sans antialiased selection:bg-amber-100 pb-32">
      
      {/* ACTIVE RESUMABLE SESSION PROMPT BANNER */}
      {isResumable && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3.5 shadow-sm">
          <div className="max-w-[1500px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex gap-2.5 items-center">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-900 font-medium">
                <strong>Diagnostic Incomplete:</strong> Your child has an active testing window currently open. Evaluation trackers are logging active runtime parameters, but the global narrative synthesis below is frozen until the session closes.
              </p>
            </div>
            <button 
              onClick={() => router.push('/staging/diagnostic/test?session=resume')} 
              className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold uppercase tracking-wider px-4 py-2 rounded-xl transition-all shadow-sm"
            >
              Resume Open Session
            </button>
          </div>
        </div>
      )}

      {/* CORE FRAME HEADER */}
      <header className="border-b border-[#E5E3DD] bg-white px-6 py-5 shadow-xs">
        <div className="max-w-[1500px] mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[9px] font-bold uppercase tracking-widest border border-slate-200 mb-1.5">
              <Sparkles className="w-3 h-3 text-amber-500 fill-amber-400" /> Pedagogical Command Terminal
            </div>
            <h1 className="text-2xl font-black font-serif tracking-tight text-[#1B3A5C]">The Cognitive Architecture Dashboard</h1>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <AuthBadge />
            <button 
              onClick={() => router.push('/profile')} 
              className="bg-[#1B3A5C] text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-800 transition shadow-xs"
            >
              Return to Hub
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto px-4 md:px-6 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COL: NARRATIVE SYNTHESIS & HISTORICAL TIMELINE METRICS */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* NARRATIVE REPORT VIEW */}
          <div className="bg-white rounded-3xl border border-[#E5E3DD] shadow-sm overflow-hidden">
            <div className="bg-[#1B3A5C] text-white p-5 flex justify-between items-center border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <Brain className="w-5 h-5 text-amber-400" />
                <div>
                  <h2 className="text-md font-serif font-bold tracking-tight">1-on-1 Expert Summary Report</h2>
                  <p className="text-[11px] text-slate-300">Cross-diagnostic trace evaluating child baseline behavioral shifts over time.</p>
                </div>
              </div>
              <span className="text-[9px] font-mono font-bold bg-white/10 px-2.5 py-1 rounded-full uppercase tracking-widest text-slate-200">
                Active Matrix Synthesis
              </span>
            </div>
            <div className="p-6 md:p-8 bg-[#FAF9F5]/30 max-h-[420px] overflow-y-auto text-sm text-slate-700 leading-relaxed font-sans whitespace-pre-wrap selection:bg-amber-200 border-b border-slate-100">
              {tutorNarrative}
            </div>
            <div className="bg-slate-50 p-3.5 px-6 text-[11px] text-slate-500 italic flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
              Claude is trained to focus explicitly on systemic methodology trends rather than numerical accuracy benchmarks across historical sessions.
            </div>
          </div>

          {/* COUNTERS BLOCK */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-[#E5E3DD] shadow-xs flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-700 rounded-xl border border-blue-100">
                <BarChart2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Completed Diagnostics</span>
                <p className="text-2xl font-black text-[#1B3A5C] mt-0.5">{completedTestsCount} <span className="text-[10px] font-normal text-slate-400">Sessions</span></p>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-[#E5E3DD] shadow-xs flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-700 rounded-xl border border-amber-100">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Total Traces Submitted</span>
                <p className="text-2xl font-black text-[#1B3A5C] mt-0.5">{metrics.totalAnswers} <span className="text-[10px] font-normal text-slate-400">Spoken Steps</span></p>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-[#E5E3DD] shadow-xs flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Self-Correction Rate</span>
                <p className="text-2xl font-black text-emerald-700 mt-0.5">{metrics.selfCorrectionRate}% <span className="text-[10px] font-normal text-slate-400 font-sans">Metacognition</span></p>
              </div>
            </div>
          </div>

          {/* SELECTIVITY ASSESSMENT PROFILE */}
          <div className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-start gap-4 transition-all ${selectivityIndex.styling}`}>
            <div className="p-3 bg-white/80 rounded-xl border border-inherit shadow-xs flex-shrink-0">
              <Gauge className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs uppercase font-black tracking-wider">Selective Benchmark Positioning Map</h3>
              <p className="text-sm font-serif font-bold">{selectivityIndex.tier}</p>
              <p className="text-xs opacity-90 leading-relaxed text-balance pt-0.5">{selectivityIndex.description}</p>
            </div>
          </div>

          {/* FAILURE MODE PROFILE VIEW */}
          <div className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-3 gap-3">
              <div>
                <h3 className="text-sm font-bold font-serif text-[#1B3A5C] uppercase tracking-wider">Cognitive Breakdown Metrics Matrix</h3>
                <p className="text-xs text-slate-400">Isolates operational friction trends across chronological filter limits.</p>
              </div>
              
              {/* Window Selector Tabs */}
              <div className="flex bg-slate-100 border border-slate-200 p-1 rounded-xl w-full sm:w-auto">
                {(['month', 'quarter', 'all'] as const).map((w) => (
                  <button
                    key={w}
                    onClick={() => setSelectedWindow(w)}
                    className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all text-center flex-1 sm:flex-initial ${
                      selectedWindow === w 
                        ? 'bg-white text-[#1B3A5C] shadow-xs' 
                        : 'text-slate-400 hover:text-[#1B3A5C]'
                    }`}
                  >
                    {w === 'month' ? 'Last Month' : w === 'quarter' ? 'Last 3 Months' : 'All Time'}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Data Metrics Meter Renders */}
            <div className="space-y-3.5 pt-1">
              {Object.entries(metrics.errorMatrix).map(([code, count]) => {
                const totalErrors = Object.values(metrics.errorMatrix).reduce((acc, v) => acc + v, 0);
                const percentWidth = totalErrors > 0 ? Math.max(4, Math.round((count / totalErrors) * 100)) : 0;
                
                return (
                  <div key={code} className="group border border-slate-100/70 p-3 rounded-xl hover:bg-slate-50/50 transition-all">
                    <div className="flex justify-between items-start text-xs font-medium mb-1">
                      <div className="space-y-0.5">
                        <p className="font-bold text-slate-800 flex items-center gap-1.5">
                          <span className="text-[10px] font-mono font-bold bg-[#1B3A5C]/10 text-[#1B3A5C] px-1.5 py-0.2 rounded">
                            {code}
                          </span>
                          {W_NAMES[code]}
                        </p>
                        <p className="text-[10px] text-slate-400 font-normal group-hover:text-slate-500 leading-normal">
                          {W_DESCRIPTIONS[code]}
                        </p>
                      </div>
                      <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${count > 0 ? 'bg-amber-100 text-amber-900' : 'bg-slate-50 text-slate-300'}`}>
                        {count} hits
                      </span>
                    </div>
                    {count > 0 && (
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
                        <div 
                          className="h-full bg-amber-500 rounded-full transition-all duration-500" 
                          style={{ width: `${percentWidth}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* RIGHT COL: QUESTION FEED & DETAILED SCAFFOLDING COGNITIVE PATHS */}
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-[#E5E3DD] shadow-xs">
            <h3 className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#1B3A5C]" /> Question-Answer Streams
            </h3>
            
            {/* Scrollable Feed List */}
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {filteredAttempts.map((item, idx) => {
                const active = item.id === activeLogId;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveLogId(item.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex justify-between items-center gap-3 ${
                      active 
                        ? 'bg-[#1B3A5C] border-[#1B3A5C] text-white shadow-sm' 
                        : 'bg-[#FAFAF6]/60 border-slate-200 hover:bg-slate-100/50 text-[#1B3A5C]'
                    }`}
                  >
                    <div className="space-y-1 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase ${active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
                          {item.skeletons?.al_classification || 'A1L1'}
                        </span>
                        <span className={`text-[9px] font-bold ${active ? 'text-amber-200' : 'text-slate-400'}`}>
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs font-serif font-medium truncate pr-2 opacity-90">
                        {item.variants?.generated_question ? item.variants.generated_question.replace(/\$/g, '') : `Problem Log #${idx + 1}`}
                      </p>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-1.5">
                      {item.is_correct ? (
                        <CheckCircle2 className={`w-4 h-4 ${active ? 'text-emerald-300' : 'text-emerald-600'}`} />
                      ) : (
                        <XCircle className={`w-4 h-4 ${active ? 'text-rose-300' : 'text-rose-600'}`} />
                      )}
                      <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                    </div>
                  </button>
                );
              })}
              {filteredAttempts.length === 0 && (
                <div className="text-center p-8 text-xs text-slate-400 font-serif">No historical problem logs found inside this window.</div>
              )}
            </div>
          </div>

          {/* SPECIFIC ITEM LEVEL INTERVENTION DATA BOX */}
          {activeLogItem && (
            <div className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm space-y-4 animate-fade-in">
              <div className="border-b border-slate-100 pb-3 flex justify-between items-start gap-2">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Specific Question Feedback</h4>
                  <p className="text-[10px] font-mono font-bold text-[#1B3A5C] mt-0.5">ID Ref: {activeLogItem.id.substring(0,8)}</p>
                </div>
                {activeLogItem.analysis?.error_reason && (
                  <span className="text-[9px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {activeLogItem.analysis.error_reason} Detected
                  </span>
                )}
              </div>

              {/* Pinned active problem context query text */}
              <div className="p-4 bg-[#FAFAF6]/60 border border-[#E5E3DD] rounded-xl text-xs text-slate-700 leading-relaxed font-serif max-h-36 overflow-y-auto">
                {renderLatexString(activeLogItem.variants?.generated_question || '')}
              </div>

              {/* Structured 3-Stage Transcripts Stack */}
              <div className="space-y-2.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Extracted Voice Channels</span>
                
                {activeTranscriptParsed?.step1 && (
                  <div className="p-3 rounded-xl bg-blue-50/40 border border-blue-100/80 space-y-1">
                    <span className="text-[9px] font-bold text-blue-700 uppercase tracking-widest block">Stage 1: Read & Parse</span>
                    <p className="text-xs text-slate-600 leading-normal italic">"{activeTranscriptParsed.step1}"</p>
                    {activeLogItem.step_velocities?.step1 && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-mono text-blue-500 font-bold pt-0.5">
                        <Clock className="w-2.5 h-2.5" /> Velocity delta: {activeLogItem.step_velocities.step1}s
                      </span>
                    )}
                  </div>
                )}

                {activeTranscriptParsed?.step2 && (
                  <div className="p-3 rounded-xl bg-amber-50/40 border border-amber-100/80 space-y-1">
                    <span className="text-[9px] font-bold text-amber-700 uppercase tracking-widest block">Stage 2: Strategy Plan</span>
                    <p className="text-xs text-slate-600 leading-normal italic">"{activeTranscriptParsed.step2}"</p>
                    {activeLogItem.step_velocities?.step2 && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-mono text-amber-600 font-bold pt-0.5">
                        <Clock className="w-2.5 h-2.5" /> Velocity delta: {activeLogItem.step_velocities.step2}s
                      </span>
                    )}
                  </div>
                )}

                {activeTranscriptParsed?.step3 && (
                  <div className="p-3 rounded-xl bg-purple-50/40 border border-purple-100/80 space-y-1">
                    <span className="text-[9px] font-bold text-purple-700 uppercase tracking-widest block">Stage 3: Solving Loop</span>
                    <p className="text-xs text-slate-600 timeframe leading-normal italic">"{activeTranscriptParsed.step3}"</p>
                    <div className="flex justify-between items-center pt-0.5">
                      {activeLogItem.step_velocities?.step3 && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-mono text-purple-500 font-bold">
                          <Clock className="w-2.5 h-2.5" /> Velocity delta: {activeLogItem.step_velocities.step3}s
                        </span>
                      )}
                      {activeTranscriptParsed?.confidence && (
                        <span className="text-[9px] font-bold capitalize text-purple-800 bg-purple-100 px-1.5 py-0.2 rounded">
                          Confidence: {activeTranscriptParsed.confidence}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* TARGET INTERVENTION REMEDY FOOTER */}
              {activeLogItem.analysis?.recommended_intervention && (
                <div className="p-4 bg-slate-900 text-white rounded-xl space-y-1.5 border border-slate-950 shadow-xs">
                  <span className="text-[9px] uppercase font-mono font-bold text-amber-400 tracking-widest flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> Custom Clinical Intervention Directive
                  </span>
                  <p className="text-xs text-slate-200 font-medium leading-relaxed">
                    {activeLogItem.analysis.recommended_intervention}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}