'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line
} from 'recharts';
import { 
  Brain, Gauge, Clock, CheckCircle2, AlertCircle, Sparkles, 
  ChevronRight, BookOpen, Layers, BarChart2, Loader2, Target, Trophy
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
  variant_id: string;
  step_velocities: { step1: number; step2: number; step3: number } | null;
  skeletons: any;
  variants: any;
  analysis: {
    teacher_scratchpad?: string;
    recommended_intervention?: string;
    w_category_breakdown?: Record<string, number>;
    error_reason?: string | null;
  } | null;
}

type TimeWindow = 'month' | 'quarter' | 'all';

// --- A/L LEVEL EXTRACTOR ---
// Classification is encoded in the last 4 characters of variant_id, e.g. "...A2L3"
const getAandLLevels = (row: AttemptRow) => {
  let aLevel = 1;
  let lLevel = 1;

  try {
    const classification = (row.variant_id || '').slice(-4).toUpperCase();

    const aMatch = classification.match(/A(\d)/);
    const lMatch = classification.match(/L(\d)/);

    if (aMatch) aLevel = parseInt(aMatch[1], 10);
    if (lMatch) lLevel = parseInt(lMatch[1], 10);
  } catch (e) {
    // Fail gracefully to Lvl 1 defaults
  }

  return { aLevel, lLevel };
};

// --- SIMPLIFIED PARENT COGNITIVE LABELS FOR ALL 9 CORE CATEGORIES ---
const COGNITIVE_CATEGORIES: Record<string, { title: string; desc: string }> = {
  W1: { title: 'Concept Tool Gaps', desc: 'Your child does not yet know the mathematical formulas or baseline methods needed to solve this specific question type.' },
  W2: { title: 'Complexity Stretch Points', desc: 'They understand the basic math rules perfectly, but get stuck when multiple layers or abstract variables are added.' },
  W3: { title: 'Missing Small Clues', desc: 'A reading oversight where your child accidentally skips past a tiny modifier word in the question text (like "not" or "except").' },
  W4: { title: 'Rushing Familiar Patterns', desc: 'They pick an operational route too quickly because the problem layout looks exactly like a puzzle they remember solving before.' },
  W5: { title: 'Assumed Rule Biases', desc: 'Your child creates an internally logical mathematical plan built upon a completely unstated, self-invented rule.' },
  W6: { title: 'Basic Arithmetic Slips', desc: 'Their core reasoning and operational plan are 100% sound, but a simple mechanical calculation error occurred.' },
  W7: { title: 'Falling for Hidden Bait', desc: 'They grab an attractive partial answer or misleading visual trap planted deliberately by the question designer.' },
  W8: { title: 'Information Tracking Fatigue', desc: 'They can handle each piece of the math easily in isolation, but lose track of sub-answers when juggling too many steps.' },
  W9: { title: 'Skipping Reality Checks', desc: 'They lock in a final value that is contextually impossible (like a speed or age calculation error) without checking if it makes sense.' }
};

// --- SELECTIVE TIER DEFINITIONS ---
const SELECTIVE_TIERS = [
  { level: 4, label: 'Elite Selective', desc: 'Super-selective grammar & top independent boarding benchmarks.' },
  { level: 3, label: 'Highly Selective', desc: 'Competitive regional selective grammar standards.' },
  { level: 2, label: 'Standard Selective', desc: 'Baseline single-layer grammar entry requirements.' },
  { level: 1, label: 'Non-Selective', desc: 'Foundational baseline and core logic tracks.' }
];

export default function PremiumDiagnosticDashboard() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isResumable, setIsResumable] = useState(false);
  const [tutorNarrative, setTutorNarrative] = useState<string>('');
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [completedTestsCount, setCompletedTestsCount] = useState(0);
  const [selectedWindow, setSelectedWindow] = useState<TimeWindow>('all');
  const [activeInterventionId, setActiveInterventionId] = useState<string | null>(null);

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

    const { data: sessions } = await supabase
      .from('diagnostic_sessions')
      .select('status');
    
    if (sessions) {
      setCompletedTestsCount(sessions.filter(s => s.status === 'completed').length);
      setIsResumable(sessions.some(s => s.status === 'active'));
    }

    const { data: summaryData } = await supabase
      .from('cognitive_summaries')
      .select('tutor_narrative')
      .eq('user_id', user.id)
      .maybeSingle();

    setTutorNarrative(summaryData?.tutor_narrative || 'Your learning profile overview will render here once a full diagnostic session concludes.');

    const { data: attemptRows, error } = await supabase
      .from('user_attempts')
      .select(`
        id,
        created_at,
        is_correct,
        solve_time,
        variant_id,
        step_velocities,
        analysis,
        variants (
          generated_question,
          correct_answer,
          al_classification
        ),
        skeletons (
          al_classification
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && attemptRows) {
      const normalizedAttempts = (attemptRows as any[]).map(row => {
        let cleanAnalysis = row.analysis;
        if (typeof cleanAnalysis === 'string') {
          try { cleanAnalysis = JSON.parse(cleanAnalysis); } catch { cleanAnalysis = {}; }
        }
        return { ...row, analysis: cleanAnalysis };
      });

      setAttempts(normalizedAttempts);
      
      const wrongInterventions = normalizedAttempts.filter(a => !a.is_correct && a.analysis?.recommended_intervention);
      if (wrongInterventions.length > 0) {
        setActiveInterventionId(wrongInterventions[0].id);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    if (isMounted) loadDashboardData();
  }, [isMounted]);

  const filteredAttempts = useMemo(() => {
    const now = new Date();
    return attempts.filter(a => {
      const createdAt = new Date(a.created_at);
      const diffDays = Math.ceil(Math.abs(now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      if (selectedWindow === 'month') return diffDays <= 30;
      if (selectedWindow === 'quarter') return diffDays <= 90;
      return true;
    });
  }, [attempts, selectedWindow]);

  const parentMetrics = useMemo(() => {
    const total = filteredAttempts.length;
    const correctCount = filteredAttempts.filter(a => a.is_correct).length;
    
    const errorsCount: Record<string, number> = {
      W1: 0, W2: 0, W3: 0, W4: 0, W5: 0, W6: 0, W7: 0, W8: 0, W9: 0
    };

    let totalSelfCorrections = 0;
    filteredAttempts.forEach(a => {
      const scratch = a.analysis?.teacher_scratchpad?.toLowerCase() || '';
      if (a.is_correct && (scratch.includes('self-correct') || scratch.includes('caught'))) {
        totalSelfCorrections++;
      }

      const breakdown = a.analysis?.w_category_breakdown;
      if (breakdown) {
        Object.keys(errorsCount).forEach(k => {
          if (breakdown[k] === 1 || a.analysis?.error_reason === k) {
            errorsCount[k]++;
          }
        });
      } else if (!a.is_correct && a.analysis?.error_reason) {
        const reason = a.analysis.error_reason;
        if (errorsCount[reason] !== undefined) errorsCount[reason]++;
      }
    });

    return {
      totalAnswers: total,
      accuracyRate: total > 0 ? Math.round((correctCount / total) * 100) : 0,
      selfCorrectionCount: totalSelfCorrections,
      errorMatrix: errorsCount
    };
  }, [filteredAttempts]);

  // Determine the child's active cleared level for the pill stack
  const activeSelectiveLevel = useMemo(() => {
    if (attempts.length === 0) return 1;
    let max = 1;
    attempts.forEach(a => {
      if (a.is_correct) {
        const { aLevel } = getAandLLevels(a);
        if (aLevel > max) max = aLevel;
      }
    });
    return max;
  }, [attempts]);

  // --- CHART DATA GENERATORS ---
  const mathPacingData = useMemo(() => {
    return [1, 2, 3, 4].map(lvl => {
      const matched = filteredAttempts.filter(a => getAandLLevels(a).aLevel === lvl);
      let r = 0, p = 0, c = 0, count = 0;

      matched.forEach(m => {
        if (m.step_velocities) {
          r += m.step_velocities.step1 || 0;
          p += m.step_velocities.step2 || 0;
          c += m.step_velocities.step3 || 0;
          count++;
        }
      });

      return {
        name: `Math Lvl ${lvl}`,
        'Reading Time': count > 0 ? Math.round(r / count) : 0,
        'Planning Strategy': count > 0 ? Math.round(p / count) : 0,
        'Calculations': count > 0 ? Math.round(c / count) : 0,
      };
    });
  }, [filteredAttempts]);

  const langPacingData = useMemo(() => {
    return [1, 2, 3, 4].map(lvl => {
      const matched = filteredAttempts.filter(a => getAandLLevels(a).lLevel === lvl);
      let r = 0, p = 0, c = 0, count = 0;

      matched.forEach(m => {
        if (m.step_velocities) {
          r += m.step_velocities.step1 || 0;
          p += m.step_velocities.step2 || 0;
          c += m.step_velocities.step3 || 0;
          count++;
        }
      });

      return {
        name: `Lang Lvl ${lvl}`,
        'Reading Time': count > 0 ? Math.round(r / count) : 0,
        'Planning Strategy': count > 0 ? Math.round(p / count) : 0,
        'Calculations': count > 0 ? Math.round(c / count) : 0,
      };
    });
  }, [filteredAttempts]);

  const mathErrorData = useMemo(() => {
    return [1, 2, 3, 4].map(lvl => {
      const items = filteredAttempts.filter(a => !a.is_correct && getAandLLevels(a).aLevel === lvl);
      let counts: Record<string, number> = { W1: 0, W2: 0, W3: 0, W4: 0, W5: 0, W6: 0, W7: 0, W8: 0, W9: 0 };

      items.forEach(i => {
        const r = i.analysis?.error_reason;
        if (r && counts[r] !== undefined) counts[r]++;
      });

      return {
        name: `Math L${lvl}`,
        'Concept Gaps': counts.W1,
        'Complexity Stretches': counts.W2,
        'Missing Clues': counts.W3,
        'Rushed Patterns': counts.W4,
        'Assumed Rules': counts.W5,
        'Arithmetic Slips': counts.W6,
        'Bait Traps': counts.W7,
        'Tracking Fatigue': counts.W8,
        'Reality Checks Missed': counts.W9
      };
    });
  }, [filteredAttempts]);

  const langErrorData = useMemo(() => {
    return [1, 2, 3, 4].map(lvl => {
      const items = filteredAttempts.filter(a => !a.is_correct && getAandLLevels(a).lLevel === lvl);
      let counts: Record<string, number> = { W1: 0, W2: 0, W3: 0, W4: 0, W5: 0, W6: 0, W7: 0, W8: 0, W9: 0 };

      items.forEach(i => {
        const r = i.analysis?.error_reason;
        if (r && counts[r] !== undefined) counts[r]++;
      });

      return {
        name: `Lang L${lvl}`,
        'Concept Gaps': counts.W1,
        'Complexity Stretches': counts.W2,
        'Missing Clues': counts.W3,
        'Rushed Patterns': counts.W4,
        'Assumed Rules': counts.W5,
        'Arithmetic Slips': counts.W6,
        'Bait Traps': counts.W7,
        'Tracking Fatigue': counts.W8,
        'Reality Checks Missed': counts.W9
      };
    });
  }, [filteredAttempts]);

  const activeInterventionItem = useMemo(() => {
    return attempts.find(a => a.id === activeInterventionId) || null;
  }, [attempts, activeInterventionId]);

  if (loading || !isMounted) {
    return (
      <div className="min-h-screen bg-[#FAFAF6] flex flex-col items-center justify-center font-serif text-sm text-[#1B3A5C] animate-pulse">
        <Loader2 className="w-6 h-6 animate-spin mb-2" />
        Syncing tutor insights... Preparing your child's roadmap...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF6] text-[#1B3A5C] font-sans antialiased pb-32">
      
      {/* FRAME MAIN HEADER */}
      <header className="border-b border-[#E5E3DD] bg-white px-6 py-5 shadow-xs">
        <div className="max-w-[1500px] mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[9px] font-bold uppercase tracking-widest border border-slate-200 mb-1.5">
              <Sparkles className="w-3 h-3 text-amber-500 fill-amber-400" /> Private Parent Portal
            </div>
            <h1 className="text-2xl font-black font-serif tracking-tight text-[#1B3A5C]">Your Child's Cognitive Learning Profile</h1>
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
        
        {/* MAIN PANEL CONTENT BODY */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* ASSESSMENTS HIGHLIGHT BLOCK */}
          <div className="bg-white rounded-3xl border border-[#E5E3DD] shadow-sm overflow-hidden">
            <div className="bg-[#1B3A5C] text-white p-5 flex justify-between items-center border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <Brain className="w-5 h-5 text-amber-400" />
                <div>
                  <h2 className="text-md font-serif font-bold tracking-tight">Tutor Insight Roadmap</h2>
                  <p className="text-[11px] text-slate-300">Observation of logic tracking patterns and strategy shifts over consecutive task cycles.</p>
                </div>
              </div>
            </div>
            <div className="p-6 md:p-8 bg-[#FAF9F5]/30 max-h-[380px] overflow-y-auto text-sm text-slate-700 leading-relaxed font-sans whitespace-pre-wrap border-b border-slate-100">
              {tutorNarrative}
            </div>
          </div>

          {/* SIMPLIFIED METRIC METERS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-[#E5E3DD] shadow-xs flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-700 rounded-xl border border-blue-100">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Completed Diagnostics</span>
                <p className="text-2xl font-black text-[#1B3A5C] mt-0.5">{completedTestsCount} <span className="text-[10px] font-normal text-slate-400">runs</span></p>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-[#E5E3DD] shadow-xs flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-700 rounded-xl border border-amber-100">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Observed Puzzle Steps</span>
                <p className="text-2xl font-black text-[#1B3A5C] mt-0.5">{parentMetrics.totalAnswers} <span className="text-[10px] font-normal text-slate-400">tracks</span></p>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-[#E5E3DD] shadow-xs flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Self-Correction Alerts</span>
                <p className="text-2xl font-black text-emerald-700 mt-0.5">{parentMetrics.selfCorrectionCount} <span className="text-[10px] font-normal text-slate-400 font-sans">catches</span></p>
              </div>
            </div>
          </div>

          {/* SELECTIVE STANDING PILL STACK UI */}
          <div className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                <Gauge className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold font-serif text-[#1B3A5C] uppercase tracking-wider">Selective Benchmark Standing</h3>
                <p className="text-xs text-slate-400 mt-0.5">Your child's highest cleanly cleared logical complexity band.</p>
              </div>
            </div>
            
            <div className="space-y-3">
              {[4, 3, 2, 1].map(lvl => {
                const tier = SELECTIVE_TIERS.find(t => t.level === lvl)!;
                const isActive = activeSelectiveLevel === lvl;
                const isUnlocked = activeSelectiveLevel >= lvl;

                return (
                  <div key={lvl} className={`p-4 rounded-xl border-2 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    isActive ? 'border-[#1B3A5C] bg-[#1B3A5C] text-white shadow-md' : 
                    isUnlocked ? 'border-emerald-100 bg-emerald-50/40' : 
                    'border-slate-100 bg-slate-50/50 opacity-60'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                        isActive ? 'bg-amber-400 text-[#1B3A5C]' :
                        isUnlocked ? 'bg-emerald-200 text-emerald-800' :
                        'bg-slate-200 text-slate-400'
                      }`}>
                        {lvl}
                      </div>
                      <div>
                        <h4 className={`text-xs font-black uppercase tracking-wide ${isActive ? 'text-white' : isUnlocked ? 'text-emerald-900' : 'text-slate-500'}`}>{tier.label}</h4>
                        <p className={`text-[10px] ${isActive ? 'text-slate-300' : isUnlocked ? 'text-emerald-700/70' : 'text-slate-400'}`}>{tier.desc}</p>
                      </div>
                    </div>
                    {isActive && (
                      <span className="text-[9px] uppercase font-bold tracking-widest bg-white/20 px-3 py-1.5 rounded-full flex-shrink-0">
                        Current Standing
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* MULTI-AXIS CHART SUITE */}
          <div className="space-y-6">
            
            {/* LINE CHARTS BLOCK: MATH VS LANG TIMING */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-5 rounded-2xl border border-[#E5E3DD] shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold font-serif uppercase tracking-wider text-slate-400">Pacing Profile: Math Challenges</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Average seconds spent per phase as problem complexity scales.</p>
                </div>
                <div className="h-48 w-full mt-4 text-[10px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={mathPacingData} margin={{ left: -25, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                      <Line type="monotone" dataKey="Reading Time" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="Planning Strategy" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="Calculations" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[#E5E3DD] shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold font-serif uppercase tracking-wider text-slate-400">Pacing Profile: Language Density</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Average seconds spent per phase as question layout text expands.</p>
                </div>
                <div className="h-48 w-full mt-4 text-[10px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={langPacingData} margin={{ left: -25, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                      <Line type="monotone" dataKey="Reading Time" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="Planning Strategy" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="Calculations" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* STACKED BAR PLOTS BREAKING DOWN INDIVIDUAL 9 CATEGORIES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-5 rounded-2xl border border-[#E5E3DD] shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold font-serif uppercase tracking-wider text-slate-400">Friction Metrics: Math Core Blocks</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Distribution of unforced mistake reasons as logic rules expand.</p>
                </div>
                <div className="h-56 w-full mt-4 text-[9px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mathErrorData} margin={{ left: -25, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: '9px', paddingTop: '12px' }} />
                      <Bar dataKey="Concept Gaps" stackId="x" fill="#3b82f6" />
                      <Bar dataKey="Complexity Stretches" stackId="x" fill="#60a5fa" />
                      <Bar dataKey="Missing Clues" stackId="x" fill="#f59e0b" />
                      <Bar dataKey="Rushed Patterns" stackId="x" fill="#fca5a5" />
                      <Bar dataKey="Assumed Rules" stackId="x" fill="#ef4444" />
                      <Bar dataKey="Arithmetic Slips" stackId="x" fill="#10b981" />
                      <Bar dataKey="Bait Traps" stackId="x" fill="#34d399" />
                      <Bar dataKey="Tracking Fatigue" stackId="x" fill="#8b5cf6" />
                      <Bar dataKey="Reality Checks Missed" stackId="x" fill="#a78bfa" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[#E5E3DD] shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold font-serif uppercase tracking-wider text-slate-400">Friction Metrics: Language Density</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Distribution of unforced mistake reasons across text reading levels.</p>
                </div>
                <div className="h-56 w-full mt-4 text-[9px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={langErrorData} margin={{ left: -25, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: '9px', paddingTop: '12px' }} />
                      <Bar dataKey="Concept Gaps" stackId="x" fill="#3b82f6" />
                      <Bar dataKey="Complexity Stretches" stackId="x" fill="#60a5fa" />
                      <Bar dataKey="Missing Clues" stackId="x" fill="#f59e0b" />
                      <Bar dataKey="Rushed Patterns" stackId="x" fill="#fca5a5" />
                      <Bar dataKey="Assumed Rules" stackId="x" fill="#ef4444" />
                      <Bar dataKey="Arithmetic Slips" stackId="x" fill="#10b981" />
                      <Bar dataKey="Bait Traps" stackId="x" fill="#34d399" />
                      <Bar dataKey="Tracking Fatigue" stackId="x" fill="#8b5cf6" />
                      <Bar dataKey="Reality Checks Missed" stackId="x" fill="#a78bfa" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

          </div>

          {/* DETAILED FRICTION MATRIX */}
          <div className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-3 gap-3">
              <div>
                <h3 className="text-sm font-bold font-serif text-[#1B3A5C] uppercase tracking-wider">Learning Friction Breakdown Matrix</h3>
                <p className="text-xs text-slate-400">Granular look at mistake indicators logged during active analytical runs.</p>
              </div>
              
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.entries(COGNITIVE_CATEGORIES).map(([wCode, copy]) => {
                const count = parentMetrics.errorMatrix[wCode] || 0;
                return (
                  <div key={wCode} className="p-4 rounded-xl border border-slate-100 bg-[#FAFAF6]/40 flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <span className="text-[11px] font-black uppercase text-slate-800 tracking-wide block">
                        {copy.title}
                      </span>
                      <p className="text-xs text-slate-500 leading-normal font-serif">
                        {copy.desc}
                      </p>
                    </div>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md shrink-0 ${count > 0 ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-300'}`}>
                      {count} flagged
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* RIGHT INTERVENTION SUB-COLUMN */}
        <div className="space-y-4">
          
          <div className="bg-white p-4 rounded-2xl border border-[#E5E3DD] shadow-xs">
            <h3 className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#1B3A5C]" /> Targeted Practice Feed
            </h3>
            
            {/* Filters strictly for incorrect records */}
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {attempts
                .filter(a => !a.is_correct && a.analysis?.recommended_intervention)
                .map((item, idx, arr) => {
                  const active = item.id === activeInterventionId;
                  const reasonCode = item.analysis?.error_reason || 'W6';
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveInterventionId(item.id)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all flex justify-between items-center gap-3 ${
                        active 
                          ? 'bg-[#1B3A5C] border-[#1B3A5C] text-white shadow-sm' 
                          : 'bg-[#FAFAF6]/60 border-slate-200 hover:bg-slate-100/50 text-[#1B3A5C]'
                      }`}
                    >
                      <div className="space-y-1 overflow-hidden">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase ${active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
                            {COGNITIVE_CATEGORIES[reasonCode]?.title || 'Practice Note'}
                          </span>
                          <span className={`text-[9px] font-medium ${active ? 'text-amber-200' : 'text-slate-400'}`}>
                            {new Date(item.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs font-serif font-medium truncate pr-2 opacity-95">
                          Correction Blueprint Guide #{arr.length - idx}
                        </p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 opacity-40 shrink-0" />
                    </button>
                  );
                })}
              {attempts.filter(a => !a.is_correct && a.analysis?.recommended_intervention).length === 0 && (
                <div className="text-center p-8 text-xs text-slate-400 font-serif">No core review paths flagged in recent tracking windows.</div>
              )}
            </div>
          </div>

          {/* ACTIVE COACHING DISPLAY CARD */}
          {activeInterventionItem && activeInterventionItem.analysis?.recommended_intervention && (
            <div className="bg-slate-900 border border-slate-950 text-white rounded-2xl p-5 shadow-md space-y-4 animate-fade-in">
              <div className="border-b border-white/10 pb-3 flex justify-between items-center">
                <div className="flex items-center gap-2 text-amber-400">
                  <Target className="w-4 h-4" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">Targeted Practice Action</h4>
                </div>
                <span className="text-[8px] font-mono text-slate-400 uppercase tracking-widest">
                  Active Strategy
                </span>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Coaching Strategy for Parents</span>
                <p className="text-sm font-serif leading-relaxed text-slate-100 font-medium">
                  {activeInterventionItem.analysis.recommended_intervention}
                </p>
              </div>

              <div className="pt-2 border-t border-white/5 flex justify-between items-center text-[10px] text-slate-400 font-medium">
                <span>Pacing Check: {activeInterventionItem.solve_time}s spent</span>
                <span>Status: Core Focus</span>
              </div>
            </div>
          )}

        </div>

      </main>
    </div>
  );
}
