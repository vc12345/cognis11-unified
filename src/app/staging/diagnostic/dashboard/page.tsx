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

// --- ROBUST CASE-INSENSITIVE REGEX PARSER FOR STABLE EXTRACTIONS ---
const getAandLLevels = (row: AttemptRow) => {
  let matchedStr = 'A1L1';
  
  if (row.skeletons) {
    if (Array.isArray(row.skeletons) && row.skeletons[0]) {
      matchedStr = row.skeletons[0].al_classification || 'A1L1';
    } else if (row.skeletons.al_classification) {
      matchedStr = row.skeletons.al_classification;
    }
  } else if (row.variants) {
    if (Array.isArray(row.variants) && row.variants[0]) {
      matchedStr = row.variants[0].al_classification || 'A1L1';
    } else if (row.variants.al_classification) {
      matchedStr = row.variants.al_classification;
    }
  }

  const aMatch = matchedStr.match(/A(\d)/i);
  const lMatch = matchedStr.match(/L(\d)/i);

  return {
    aLevel: aMatch ? parseInt(aMatch[1]) : 1,
    lLevel: lMatch ? parseInt(lMatch[1]) : 1
  };
};

// --- ORIGINAL COMPREHENSIVE 9 CATEGORIES (SIMPLIFIED PARENT WORDING) ---
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

    setTutorNarrative(summaryData?.tutor_narrative || 'Your learning profile overview will render here once a full diagnostic session concludes.');

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

  // --- FILTERS & METRICS ENGINE ---
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

  // --- HONEST COMPETITIVE BENCHMARKS EVALUATION VIEW ---
  const selectivityProfile = useMemo(() => {
    if (attempts.length === 0) {
      return {
        title: 'Awaiting Diagnostic Data',
        desc: 'Complete your active workflows to establish an initial learning trace baseline.'
      };
    }

    // Determine highest successfully cleared application block level
    let maxACleared = 0;
    attempts.forEach(a => {
      if (a.is_correct) {
        const { aLevel } = getAandLLevels(a);
        if (aLevel > maxACleared) maxACleared = aLevel;
      }
    });

    if (maxACleared === 4) {
      return {
        title: 'Level A4: Super-Selective Capable Profile',
        desc: 'Your child successfully handles highly complex, multi-layered Olympiad-style frames. Their working memory and logical tracking show the depth required for ultra-competitive selective schools.'
      };
    }
    if (maxACleared === 3) {
      return {
        title: 'Level A3: Competitive Grammar & Selective Independent Profile',
        desc: 'Your child clears complex, multi-step problem paths safely. They are competitive for highly selective regional schools, provided they manage pacing limits and avoid unforced reading slips.'
      };
    }
    if (maxACleared === 2) {
      return {
        title: 'Level A2: Standard Grammar School Capability',
        desc: 'Your child handles traditional, single-layer grammar school questions well. However, they encounter friction and strategy gaps when rules are masked or abstract variables are added.'
      };
    }
    return {
      title: 'Level A1: Foundational Skill Baseline',
      desc: 'Your child is currently missing core concepts or rushing basic steps. Any student preparing for selective exams needs to clear this baseline cleanly. Focus on accuracy before adding time pressure.'
    };
  }, [attempts]);

  // --- CHART BUILDERS: SEPARATED BY MATH (A) AND LANGUAGE (L) ---
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
        name: `Math L${lvl}`,
        'Concept Gaps': w1w2,
        'Parsing Overlooked': w3w5,
        'Rushed Triggers': w4w7,
        'Arithmetic Slips': w6,
        'Memory Drops': w8w9
      };
    });
  }, [filteredAttempts]);

  const langErrorData = useMemo(() => {
    return [1, 2, 3, 4].map(lvl => {
      const items = filteredAttempts.filter(a => !a.is_correct && getAandLLevels(a).lLevel === lvl);
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
        name: `Lang L${lvl}`,
        'Concept Gaps': w1w2,
        'Parsing Overlooked': w3w5,
        'Rushed Triggers': w4w7,
        'Arithmetic Slips': w6,
        'Memory Drops': w8w9
      };
    });
  }, [filteredAttempts]);

  const activeInterventionItem = useMemo(() => {
    return attempts.find(a => a.id === activeInterventionId) || null;
  }, [attempts, activeInterventionId]);

  return (
    <div className="min-h-screen bg-[#FAFAF6] text-[#1B3A5C] font-sans antialiased pb-32">
      
      {/* HEADER ROW */}
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
        
        {/* LEFT PRIMARY PANEL STREAM */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* HOLISTIC SUMMARY TRACE */}
          <div className="bg-white rounded-3xl border border-[#E5E3DD] shadow-sm overflow-hidden">
            <div className="bg-[#1B3A5C] text-white p-5 flex justify-between items-center border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <Brain className="w-5 h-5 text-amber-400" />
                <div>
                  <h2 className="text-md font-serif font-bold tracking-tight">Tutor Insight Roadmap</h2>
                  <p className="text-[11px] text-slate-300">Analysis of behavioral adjustments and step-by-step thinking strategies over consecutive runs.</p>
                </div>
              </div>
            </div>
            <div className="p-6 md:p-8 bg-[#FAF9F5]/30 max-h-[380px] overflow-y-auto text-sm text-slate-700 leading-relaxed font-sans whitespace-pre-wrap selection:bg-amber-200 border-b border-slate-100">
              {tutorNarrative}
            </div>
          </div>

          {/* METRIC CARD BAR */}
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
                <p className="text-2xl font-black text-emerald-700 mt-0.5">{parentMetrics.selfCorrectionCount} <span className="text-[10px] font-normal text-slate-400 font-sans">catches</span></p>
              </div>
            </div>
          </div>

          {/* GROUNDED AND HONEST EVALUATION BLOCK */}
          <div className="bg-amber-50/60 border border-amber-200 p-5 rounded-2xl flex items-start gap-4 shadow-xs">
            <div className="p-3 bg-white text-[#1B3A5C] rounded-xl border border-amber-300 shadow-xs flex-shrink-0">
              <Gauge className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-[10px] font-black uppercase tracking-wider text-amber-900">Selective Benchmark Alignment Standing</h3>
              <p className="text-sm font-serif font-bold text-[#1B3A5C]">{selectivityProfile.title}</p>
              <p className="text-xs text-slate-700 leading-relaxed pt-0.5">{selectivityProfile.desc}</p>
            </div>
          </div>

          {/* side-by-side PROGRESSIVE DATA CHARTS COHORT */}
          <div className="space-y-6">
            
            {/* DUAL PACING PROFILE BAR SECTIONS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-5 rounded-2xl border border-[#E5E3DD] shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold font-serif uppercase tracking-wider text-slate-400">Pacing Profile: Math Level (A1–A4)</h3>
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
                  <h3 className="text-xs font-bold font-serif uppercase tracking-wider text-slate-400">Pacing Profile: Language Density (L1–L4)</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Average seconds spent as question vocabulary density grows.</p>
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

            {/* DUAL STRUCTURAL MISTAKE TRIGGER BAR SECTIONS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-5 rounded-2xl border border-[#E5E3DD] shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold font-serif uppercase tracking-wider text-slate-400">Friction Metrics: Math Level (A1–A4)</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Distribution of mistake points across math abstraction challenges.</p>
                </div>
                <div className="h-48 w-full mt-4 text-[10px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mathErrorData} margin={{ left: -25, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: '9px', paddingTop: '10px' }} />
                      <Bar dataKey="Concept Gaps" stackId="a" fill="#3b82f6" />
                      <Bar dataKey="Parsing Overlooked" stackId="a" fill="#8b5cf6" />
                      <Bar dataKey="Rushed Triggers" stackId="a" fill="#ef4444" />
                      <Bar dataKey="Arithmetic Slips" stackId="a" fill="#10b981" />
                      <Bar dataKey="Memory Drops" stackId="a" fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[#E5E3DD] shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold font-serif uppercase tracking-wider text-slate-400">Friction Metrics: Language Density (L1–L4)</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Distribution of mistake points across reading trap levels.</p>
                </div>
                <div className="h-48 w-full mt-4 text-[10px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={langErrorData} margin={{ left: -25, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: '9px', paddingTop: '10px' }} />
                      <Bar dataKey="Concept Gaps" stackId="a" fill="#3b82f6" />
                      <Bar dataKey="Parsing Overlooked" stackId="a" fill="#8b5cf6" />
                      <Bar dataKey="Rushed Triggers" stackId="a" fill="#ef4444" />
                      <Bar dataKey="Arithmetic Slips" stackId="a" fill="#10b981" />
                      <Bar dataKey="Memory Drops" stackId="a" fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

          </div>

          {/* DETAILED FRICTION MATRIX GRID */}
          <div className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-3 gap-3">
              <div>
                <h3 className="text-sm font-bold font-serif text-[#1B3A5C] uppercase tracking-wider">Learning Friction Breakdown Matrix</h3>
                <p className="text-xs text-slate-400">Unforced mistake vectors compiled across the window matrix below.</p>
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

        {/* RIGHT SIDEBAR PANEL COLUMN */}
        <div className="space-y-4">
          
          <div className="bg-white p-4 rounded-2xl border border-[#E5E3DD] shadow-xs">
            <h3 className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#1B3A5C]" /> Targeted Practice Feed
            </h3>
            
            {/* Filtered strictly for items where is_correct === false */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
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
                          Correction Directive Blueprint #{arr.length - idx}
                        </p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 opacity-40 shrink-0" />
                    </button>
                  );
                })}
              {attempts.filter(a => !a.is_correct && a.analysis?.recommended_intervention).length === 0 && (
                <div className="text-center p-8 text-xs text-slate-400 font-serif">No corrective feedback items available in historical records.</div>
              )}
            </div>
          </div>

          {/* REMEDIAL BLUEPRINT PRESENTATION COMPONENT (ABSTRACT STAMINA LABELS REMOVED) */}
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
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Coaching Directive for Parents</span>
                <p className="text-sm font-serif leading-relaxed text-slate-100 font-medium">
                  {activeInterventionItem.analysis.recommended_intervention}
                </p>
              </div>

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