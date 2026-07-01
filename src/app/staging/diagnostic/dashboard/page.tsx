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
  ChevronRight, BookOpen, Layers, BarChart2, Loader2, Target, Trophy, XCircle
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

// --- HELPER WRAPPER: PREVENTS BLANK CHARTS BY RESOLVING JOIN SCHEMAS ---
const getAlClassification = (row: AttemptRow): string => {
  if (!row) return 'A1L1';
  
  // Check skeletons object or array
  if (row.skeletons) {
    if (Array.isArray(row.skeletons) && row.skeletons[0]) {
      return row.skeletons[0].al_classification || 'A1L1';
    }
    if (row.skeletons.al_classification) return row.skeletons.al_classification;
  }
  
  // Fallback check variants object or array
  if (row.variants) {
    if (Array.isArray(row.variants) && row.variants[0]) {
      return row.variants[0].al_classification || 'A1L1';
    }
    if (row.variants.al_classification) return row.variants.al_classification;
  }

  return 'A1L1';
};

// --- SIMPLIFIED PARENT-FRIENDLY LABELS FOR ALL 9 COMPREHENSIVE CATEGORIES ---
const COGNITIVE_CATEGORIES: Record<string, { title: string; desc: string }> = {
  W1: { title: 'Concept Tool Gaps', desc: 'Lacks the mathematical method or baseline tools to address this problem type entirely.' },
  W2: { title: 'Complexity Stretch Points', desc: 'Understands the baseline math rules but hits a boundary under deep abstraction or multi-layered questions.' },
  W3: { title: 'Missing Small Clues', desc: 'A reading oversight where your child misses or skips critical conditions in the text like "not" or "except".' },
  W4: { title: 'Rushing Familiar Patterns', desc: 'Jumps straight to a conclusion because the question looks superficially identical to an old problem type.' },
  W5: { title: 'Assumed Rule Biases', desc: 'Creates an internally logical solution step built upon a completely unstated, self-invented rule.' },
  W6: { title: 'Basic Arithmetic Slips', desc: 'Their core logical strategy is 100% sound, but a simple calculation addition or multiplication mistake occurred.' },
  W7: { title: 'Falling for Hidden Bait', desc: 'Surrenders to an attractive partial calculation output or visual trap planted by the question writer.' },
  W8: { title: 'Information Tracking Fatigue', desc: 'Can handle steps easily in isolation, but drops intermediate targets when juggling multiple tasks at once.' },
  W9: { title: 'Skipping Reality Checks', desc: 'Arrives at an answer that is contextually or physically impossible but accepts it anyway without verification.' }
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

    setTutorNarrative(summaryData?.tutor_narrative || 'Your comprehensive learning profile overview will render here once a full diagnostic session concludes.');

    const { data: attemptRows, error } = await supabase
      .from('user_attempts')
      .select(`
        id,
        created_at,
        is_correct,
        solve_time,
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
      
      // Filter for active default feedback element matching our new parameters
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

  // --- FILTERS & METRICS COMPILATION ---
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

  // --- REVERTED GROUNDED STANDING SELECTION PROFILE ---
  const selectivityProfile = useMemo(() => {
    const score = parentMetrics.accuracyRate;
    if (attempts.length === 0) {
      return {
        title: 'Awaiting Evaluation Data',
        desc: 'Complete initial diagnostic workflows to gauge focus areas.'
      };
    }
    if (score >= 82) {
      return {
        title: 'Top-Tier Competitive Track Clearances',
        desc: 'Your child current metrics mirror entry prerequisites for ultra-selective grammar tracks and independent academic boarding systems. Pacing mechanics and text filtering patterns track safely.'
      };
    }
    if (score >= 60) {
      return {
        title: 'Highly Selective Regional Competitive Band',
        desc: 'Concept mechanics are established cleanly. The core learning priorities should target avoiding unforced parsing slips and handling trap variants rather than rushing raw calculation loops.'
      };
    }
    return {
      title: 'Foundation Target & Core Skill Re-alignment Band',
      desc: 'Current capability outputs indicate specific structural concept tool gaps or logical overconfidence friction loops. Target systematic rule checks before introducing speed pressure elements.'
    };
  }, [attempts, parentMetrics]);

  // --- CHART BUILDERS (USING BULLETPROOF COMPILATION HOOKS) ---
  const pacingChartData = useMemo(() => {
    const difficulties = ['A1', 'A2', 'A3', 'A4'];
    return difficulties.map(diff => {
      const matched = filteredAttempts.filter(a => getAlClassification(a).startsWith(diff));
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
        name: diff === 'A1' ? 'Lvl 1: Core' : diff === 'A2' ? 'Lvl 2: Abstract' : diff === 'A3' ? 'Lvl 3: Layered' : 'Lvl 4: Advanced',
        'Reading Time': count > 0 ? Math.round(r / count) : 0,
        'Planning Strategy': count > 0 ? Math.round(p / count) : 0,
        'Calculations': count > 0 ? Math.round(c / count) : 0,
      };
    });
  }, [filteredAttempts]);

  const difficultyErrorChartData = useMemo(() => {
    const difficulties = ['A1', 'A2', 'A3', 'A4'];
    return difficulties.map(diff => {
      const items = filteredAttempts.filter(a => !a.is_correct && getAlClassification(a).startsWith(diff));
      
      let w1w2 = 0, w3w5 = 0, w4w7 = 0, w6 = 0, w8w9 = 0;
      items.forEach(i => {
        const reason = i.analysis?.error_reason;
        if (reason === 'W1' || reason === 'W2') w1w2++;
        else if (reason === 'W3' || reason === 'W5') w3w5++;
        else if (reason === 'W4' || reason === 'W7') w4w7++;
        else if (reason === 'W6') w6++;
        else if (reason === 'W8' || reason === 'W9') w8w9++;
      });

      return {
        name: diff === 'A1' ? 'Lvl 1' : diff === 'A2' ? 'Lvl 2' : diff === 'A3' ? 'Lvl 3' : 'Lvl 4',
        'Concept Gaps': w1w2,
        'Parsing Overlooked': w3w5,
        'Rushed Triggers': w4w7,
        'Arithmetic Slips': w6,
        'Working Memory Drops': w8w9
      };
    });
  }, [filteredAttempts]);

  const activeInterventionItem = useMemo(() => {
    return attempts.find(a => a.id === activeInterventionId) || null;
  }, [attempts, activeInterventionId]);

  return (
    <div className="min-h-screen bg-[#FAFAF6] text-[#1B3A5C] font-sans antialiased pb-32">
      
      {/* HEADER BAR */}
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
        
        {/* LEFT COMPONENT ROWS PANEL */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* NARRATIVE INSIGHT CARD */}
          <div className="bg-white rounded-3xl border border-[#E5E3DD] shadow-sm overflow-hidden">
            <div className="bg-[#1B3A5C] text-white p-5 flex justify-between items-center border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <Brain className="w-5 h-5 text-amber-400" />
                <div>
                  <h2 className="text-md font-serif font-bold tracking-tight">Tutor Insight Summary</h2>
                  <p className="text-[11px] text-slate-300">How your child manages thinking steps and unforced rule changes across multiple runs.</p>
                </div>
              </div>
            </div>
            <div className="p-6 md:p-8 bg-[#FAF9F5]/30 max-h-[380px] overflow-y-auto text-sm text-slate-700 leading-relaxed font-sans whitespace-pre-wrap selection:bg-amber-200 border-b border-slate-100">
              {tutorNarrative}
            </div>
          </div>

          {/* COUNTERS HUB */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-[#E5E3DD] shadow-xs flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-700 rounded-xl border border-blue-100">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Completed Diagnostics</span>
                <p className="text-2xl font-black text-[#1B3A5C] mt-0.5">{completedTestsCount} <span className="text-[10px] font-normal text-slate-400">sessions</span></p>
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
                <p className="text-2xl font-black text-emerald-700 mt-0.5">{parentMetrics.selfCorrectionCount} <span className="text-[10px] font-normal text-slate-400">catches</span></p>
              </div>
            </div>
          </div>

          {/* GROUNDED CAPABILITY PLACEMENT SUMMARY */}
          <div className="bg-amber-50/60 border border-amber-200 p-5 rounded-2xl flex items-start gap-4 shadow-xs">
            <div className="p-3 bg-white text-[#1B3A5C] rounded-xl border border-amber-300 shadow-xs flex-shrink-0">
              <Gauge className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-[10px] font-black uppercase tracking-wider text-amber-900">Current Selective Evaluation Standing</h3>
              <p className="text-sm font-serif font-bold text-[#1B3A5C]">{selectivityProfile.title}</p>
              <p className="text-xs text-slate-700 leading-relaxed pt-0.5">{selectivityProfile.desc}</p>
            </div>
          </div>

          {/* RECHARTS PLOTS GRID (FIXED LAYOUT WRAPPER OBJECT PROPERTY ASSIGNMENT EXCEPTIONS) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* PLOT 1: STEP-RELATIVE STOPWATCH VELOCITIES */}
            <div className="bg-white p-5 rounded-2xl border border-[#E5E3DD] shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold font-serif uppercase tracking-wider text-slate-400">Pacing Profile Balance</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Average seconds spent parsing problem instructions vs mapping conceptual blueprints.</p>
              </div>
              <div className="h-48 w-full mt-4 text-[10px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={pacingChartData} margin={{ left: -25, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip />
                    {/* Fixed 'pt' object compilation exception via generic styles mapping */}
                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                    <Line type="monotone" dataKey="Reading Time" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="Planning Strategy" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="Calculations" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* PLOT 2: ACCURATE STACKED ERROR OCCURRENCES BY EXERCISE ALTITUDE DIFFICULTY */}
            <div className="bg-white p-5 rounded-2xl border border-[#E5E3DD] shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold font-serif uppercase tracking-wider text-slate-400">Friction Metrics by Difficulty Step</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Tracks how cognitive friction shifts as complexity parameters scale from core to advanced tracks.</p>
              </div>
              <div className="h-48 w-full mt-4 text-[10px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={difficultyErrorChartData} margin={{ left: -25, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '9px', paddingTop: '10px' }} />
                    <Bar dataKey="Concept Gaps" stackId="a" fill="#3b82f6" />
                    <Bar dataKey="Parsing Overlooked" stackId="a" fill="#8b5cf6" />
                    <Bar dataKey="Rushed Triggers" stackId="a" fill="#ef4444" />
                    <Bar dataKey="Arithmetic Slips" stackId="a" fill="#10b981" />
                    <Bar dataKey="Working Memory Drops" stackId="a" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* DENSE HIGH-VALUE LEARNING FRICTION MATRIX HUB */}
          <div className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-3 gap-3">
              <div>
                <h3 className="text-sm font-bold font-serif text-[#1B3A5C] uppercase tracking-wider">Learning Friction Breakdown Matrix</h3>
                <p className="text-xs text-slate-400">Granular trends compiled over the filtered time matrix window below.</p>
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

            {/* Informational Dense Output Cards Layout */}
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

        {/* RIGHT HAND SIDE CURATED INTERVENTION SIDE-PANEL COLUMN */}
        <div className="space-y-4">
          
          <div className="bg-white p-4 rounded-2xl border border-[#E5E3DD] shadow-xs">
            <h3 className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#1B3A5C]" /> Targeted Practice Feed
            </h3>
            
            {/* Scrollable Feed Picker Filtered Exclusively for Incorrect Attempts */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {attempts
                .filter(a => !a.is_correct && a.analysis?.recommended_intervention)
                .map((item, idx, arr) => {
                  const active = item.id === activeInterventionId;
                  const itemClassification = getAlClassification(item);
                  
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
                            {itemClassification}
                          </span>
                          <span className={`text-[9px] font-medium ${active ? 'text-amber-200' : 'text-slate-400'}`}>
                            {new Date(item.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs font-serif font-medium truncate pr-2 opacity-95">
                          Practice Priority Insight #{arr.length - idx}
                        </p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 opacity-40 shrink-0" />
                    </button>
                  );
                })}
              {attempts.filter(a => !a.is_correct && a.analysis?.recommended_intervention).length === 0 && (
                <div className="text-center p-8 text-xs text-slate-400 font-serif">No corrective feedback items available in historical records yet.</div>
              )}
            </div>
          </div>

          {/* ACTIVE SELECTED FEEDBACK DISPLAY CARD (MOCKED TIERS/TRANSCRIPTS HIDDEN NATIVELY) */}
          {activeInterventionItem && activeInterventionItem.analysis?.recommended_intervention && (
            <div className="bg-slate-900 border border-slate-950 text-white rounded-2xl p-5 shadow-md space-y-4 animate-fade-in">
              <div className="border-b border-white/10 pb-3 flex justify-between items-center">
                <div className="flex items-center gap-2 text-amber-400">
                  <Target className="w-4 h-4" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">Targeted Practice Action</h4>
                </div>
                <span className="text-[8px] font-mono text-slate-400 uppercase tracking-widest">
                  Active Blueprint
                </span>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Coaching Strategy for Parents</span>
                <p className="text-sm font-serif leading-relaxed text-slate-100 font-medium">
                  {activeInterventionItem.analysis.recommended_intervention}
                </p>
              </div>

              {/* Masked Metadata elements protect inner trade secret variables */}
              <div className="pt-2 border-t border-white/5 flex justify-between items-center text-[10px] text-slate-400 font-medium">
                <span>Pacing Record: {activeInterventionItem.solve_time}s total spent</span>
                <span>Status: Focus Area</span>
              </div>
            </div>
          )}

        </div>

      </main>
    </div>
  );
}