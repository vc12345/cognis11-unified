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
  ChevronRight, BookOpen, Layers, BarChart2, Loader2, Target, Trophy, HelpCircle
} from 'lucide-react';
import AuthBadge from '../../../../components/AuthBadge';

// --- TYPE DEFINITIONS ---
interface AttemptRow {
  id: string;
  created_at: string;
  is_correct: boolean;
  solve_time: number;
  step_velocities: { step1: number; step2: number; step3: number } | null;
  skeletons: {
    al_classification: string;
  } | null;
  analysis: {
    teacher_scratchpad?: string;
    recommended_intervention?: string;
    error_reason?: string | null;
  } | null;
}

type TimeWindow = 'month' | 'quarter' | 'all';

// --- PARENT-FRIENDLY CATEGORY MAPPINGS (PROTECTS TRADE SECRETS) ---
const PARENT_CATEGORY_NAMES: Record<string, string> = {
  ReadingSlips: 'Missing Hidden Clues',
  PatternRushing: 'Rushing Familiar Patterns',
  StrategyWall: 'Concept Stretch points',
  CalculationSlips: 'Arithmetic Slips',
  MentalOverload: 'Losing the Thread Mid-Way'
};

const PARENT_CATEGORY_DESCRIPTIONS: Record<string, string> = {
  ReadingSlips: 'The math is perfectly sound, but your child skipped past a tiny word constraint in the text (like "not" or "except").',
  PatternRushing: 'Your child recognizes a pattern quickly and jumps straight to conclusions before reading the full rule.',
  StrategyWall: 'Your child understands the core rule beautifully, but hits a boundary when forced into deep abstraction.',
  CalculationSlips: 'Their thinking track and logical strategy are 100% correct, but a simple computational addition or multiplication slip occurred.',
  MentalOverload: 'They can handle each piece of the puzzle perfectly in isolation, but the brain drops elements when tracking too many tasks at once.'
};

// Map raw backend W-codes silently into parent-facing categories
const mapToParentCategory = (wCode: string | null | undefined): string => {
  if (!wCode) return 'CalculationSlips';
  if (wCode === 'W3') return 'ReadingSlips';
  if (wCode === 'W4' || wCode === 'W7') return 'PatternRushing';
  if (wCode === 'W1' || wCode === 'W2' || wCode === 'W5') return 'StrategyWall';
  if (wCode === 'W6') return 'CalculationSlips';
  if (wCode === 'W8' || wCode === 'W9') return 'MentalOverload';
  return 'CalculationSlips';
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

    setTutorNarrative(summaryData?.tutor_narrative || 'Your custom roadmap analysis highlights will render here once a full diagnostic run completes.');

    const { data: attemptRows, error } = await supabase
      .from('user_attempts')
      .select(`
        id,
        created_at,
        is_correct,
        solve_time,
        step_velocities,
        analysis,
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
      
      const fluidInterventions = normalizedAttempts.filter(a => a.analysis?.recommended_intervention);
      if (fluidInterventions.length > 0) {
        setActiveInterventionId(fluidInterventions[0].id);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    if (isMounted) loadDashboardData();
  }, [isMounted]);

  // --- FILTERS & COMPILATION ENGINES ---
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
    
    const categoryCounts: Record<string, number> = {
      ReadingSlips: 0, PatternRushing: 0, StrategyWall: 0, CalculationSlips: 0, MentalOverload: 0
    };

    let totalSelfCorrections = 0;
    filteredAttempts.forEach(a => {
      const scratch = a.analysis?.teacher_scratchpad?.toLowerCase() || '';
      if (a.is_correct && (scratch.includes('self-correct') || scratch.includes('caught'))) {
        totalSelfCorrections++;
      }

      if (!a.is_correct) {
        const cat = mapToParentCategory(a.analysis?.error_reason);
        if (categoryCounts[cat] !== undefined) categoryCounts[cat]++;
      }
    });

    return {
      totalAnswers: total,
      accuracyRate: total > 0 ? Math.round((correctCount / total) * 100) : 0,
      selfCorrectionCount: totalSelfCorrections,
      categories: categoryCounts
    };
  }, [filteredAttempts]);

  // --- SCHOOL SELECTIVITY PROGRESSION LEADERBOARD STACK ---
  const schoolSelectivityStack = useMemo(() => {
    const score = parentMetrics.accuracyRate;
    
    const tiers = [
      {
        id: 'tier1',
        title: 'Super-Selective Grammar Tracks & Elite Academic Boarding Schools',
        criterion: 'Requires steady accuracy above 80% on advanced puzzles under strict constraints.',
        status: score >= 82 ? 'unlocked' : 'locked',
        note: 'Excellent target focus area to aim for next.'
      },
      {
        id: 'tier2',
        title: 'Highly Selective Grammar & Competitive Regional Streams',
        criterion: 'Requires steady accuracy above 60% with high concept processing stability.',
        status: score >= 60 ? 'unlocked' : 'locked',
        note: 'Child tracks firmly within this competitive band.'
      },
      {
        id: 'tier3',
        title: 'Standard Regional Selection & Foundation Competency Tracks',
        criterion: 'Initial baseline tracking checkpoint for structural tool accuracy.',
        status: score > 0 ? 'unlocked' : 'locked',
        note: 'Baseline milestones successfully cleared.'
      }
    ];

    let activeTierId = 'tier3';
    if (score >= 82) activeTierId = 'tier1';
    else if (score >= 60) activeTierId = 'tier2';

    return { tiers, activeTierId };
  }, [parentMetrics]);

  // --- CHART DATA GENERATORS ---
  const pacingChartData = useMemo(() => {
    // Computes average seconds spent reading vs planning vs calculating across difficulty steps
    const difficulties = ['A1', 'A2', 'A3', 'A4'];
    return difficulties.map(diff => {
      const matched = filteredAttempts.filter(a => a.skeletons?.al_classification?.startsWith(diff));
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
        name: diff === 'A1' ? 'Level 1: Core Base' : diff === 'A2' ? 'Level 2: Abstract' : diff === 'A3' ? 'Level 3: Layered' : 'Level 4: Advanced Olympiad',
        'Reading Time': count > 0 ? Math.round(r / count) : 0,
        'Planning Strategy': count > 0 ? Math.round(p / count) : 0,
        'Working Calculations': count > 0 ? Math.round(c / count) : 0,
      };
    });
  }, [filteredAttempts]);

  const difficultyErrorChartData = useMemo(() => {
    // Computes error occurrences mapping against question structure difficulty steps
    const difficulties = ['A1', 'A2', 'A3', 'A4'];
    return difficulties.map(diff => {
      const items = filteredAttempts.filter(a => !a.is_correct && a.skeletons?.al_classification?.startsWith(diff));
      
      let reading = 0, rushing = 0, strategy = 0, arithmetic = 0, overload = 0;
      items.forEach(i => {
        const cat = mapToParentCategory(i.analysis?.error_reason);
        if (cat === 'ReadingSlips') reading++;
        if (cat === 'PatternRushing') rushing++;
        if (cat === 'StrategyWall') strategy++;
        if (cat === 'CalculationSlips') arithmetic++;
        if (cat === 'MentalOverload') overload++;
      });

      return {
        name: diff === 'A1' ? 'Lvl 1' : diff === 'A2' ? 'Lvl 2' : diff === 'A3' ? 'Lvl 3' : 'Lvl 4',
        'Missing Clues': reading,
        'Rushing Patterns': rushing,
        'Concept Stretches': strategy,
        'Arithmetic Slips': arithmetic,
        'Dropped Threads': overload
      };
    });
  }, [filteredAttempts]);

  const activeInterventionItem = useMemo(() => {
    return attempts.find(a => a.id === activeInterventionId) || null;
  }, [attempts, activeInterventionId]);

  if (loading || !isMounted) {
    return (
      <div className="min-h-screen bg-[#FAFAF6] flex flex-col items-center justify-center font-serif text-sm text-[#1B3A5C] animate-pulse">
        <Loader2 className="w-5 h-5 animate-spin mb-2" />
        Syncing tutor insights... Preparing your child's roadmap...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF6] text-[#1B3A5C] font-sans antialiased selection:bg-amber-100 pb-32">
      
      {/* GLOBAL PARENT FRAME HEADER */}
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
        
        {/* LEFT TWO-THIRDS PANEL BLOCK */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* THE HOLISTIC TUTOR ASSESSMENT NARRATIVE CARD */}
          <div className="bg-white rounded-3xl border border-[#E5E3DD] shadow-sm overflow-hidden">
            <div className="bg-[#1B3A5C] text-white p-5 flex justify-between items-center border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <Brain className="w-5 h-5 text-amber-400" />
                <div>
                  <h2 className="text-md font-serif font-bold tracking-tight">Tutor Insight Roadmap</h2>
                  <p className="text-[11px] text-slate-300">How your child naturally approaches complex logic strings over consecutive runs.</p>
                </div>
              </div>
            </div>
            <div className="p-6 md:p-8 bg-[#FAF9F5]/30 max-h-[400px] overflow-y-auto text-sm text-slate-700 leading-relaxed font-sans whitespace-pre-wrap selection:bg-amber-200 border-b border-slate-100">
              {tutorNarrative}
            </div>
            <div className="bg-slate-50 p-3.5 px-6 text-[11px] text-slate-500 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
              Our system ignores raw numerical percentages to capture changes in strategy balance and unforced error adjustments.
            </div>
          </div>

          {/* SIMPLIFIED ACCESSIBLE CORE MILESTONE COUNTERS BAR */}
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

          {/* EXTENDED SCHOOL SELECTIVITY PIPELINE (SHOWS HIGHER TIERS ENCOURAGING CONVERSIONS) */}
          <div className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold font-serif text-[#1B3A5C] uppercase tracking-wider">Selective Schools Alignment Pathway</h3>
              <p className="text-xs text-slate-400 mt-0.5">Where your child balances today against competitive local and national selection guidelines.</p>
            </div>
            
            <div className="space-y-3">
              {schoolSelectivityStack.tiers.map((tier) => {
                const isActive = schoolSelectivityStack.activeTierId === tier.id;
                return (
                  <div 
                    key={tier.id} 
                    className={`p-4 rounded-xl border-2 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                      isActive 
                        ? 'border-[#1B3A5C] bg-slate-50/50 shadow-xs' 
                        : 'border-slate-100 bg-white opacity-60'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-amber-500 animate-ping' : 'bg-slate-300'}`} />
                        <h4 className="text-xs font-black uppercase tracking-wide text-slate-800">{tier.title}</h4>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed font-serif">{tier.criterion}</p>
                    </div>
                    
                    <div className="flex-shrink-0">
                      {isActive ? (
                        <span className="text-[10px] font-black bg-[#1B3A5C] text-white px-3 py-1.5 rounded-lg uppercase tracking-wider block">
                          Current Standing
                        </span>
                      ) : tier.status === 'unlocked' ? (
                        <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-100 uppercase tracking-wider block">
                          Milestone Cleared
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-400 px-3 py-1.5 rounded-lg border border-slate-200 uppercase tracking-wider block">
                          Next Roadmap Goal
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* GRAPHICAL COGNITIVE VISUALIZATIONS ROW */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* CHART 1: TIME BALANCING METRIC */}
            <div className="bg-white p-5 rounded-2xl border border-[#E5E3DD] shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold font-serif uppercase tracking-wider text-slate-400">Pacing Profile Balance</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Average time spent (seconds) reading text rules vs planning strategy tracks.</p>
              </div>
              <div className="h-48 w-full mt-4 text-[10px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={pacingChartData} margin={{ left: -25, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '10px', pt: '10px' }} />
                    <Line type="monotone" dataKey="Reading Time" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="Planning Strategy" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="Working Calculations" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* CHART 2: DIFFICULTY ERROR MIX BREAKDOWN */}
            <div className="bg-white p-5 rounded-2xl border border-[#E5E3DD] shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold font-serif uppercase tracking-wider text-slate-400">Bumps Triggered by Difficulty Level</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Tracks how mistake patterns shift as puzzle complexity scales up.</p>
              </div>
              <div className="h-48 w-full mt-4 text-[10px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={difficultyErrorChartData} margin={{ left: -25, right: 10 }} stackOffset="sign">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '9px', pt: '10px' }} />
                    <Bar dataKey="Missing Clues" stackId="a" fill="#3b82f6" />
                    <Bar dataKey="Rushing Patterns" stackId="a" fill="#ef4444" />
                    <Bar dataKey="Concept Stretches" stackId="a" fill="#f59e0b" />
                    <Bar dataKey="Arithmetic Slips" stackId="a" fill="#10b981" />
                    <Bar dataKey="Dropped Threads" stackId="a" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* ANONYMOUS MASKED LEARNING BUMPS INDEX CARDS */}
          <div className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold font-serif text-[#1B3A5C] uppercase tracking-wider">Identified Learning Friction Trends</h3>
              <p className="text-xs text-slate-400 mt-0.5">Aggregated look at unforced error vectors gathered across active testing loops.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.entries(parentMetrics.categories).map(([categoryKey, count]) => (
                <div key={categoryKey} className="p-4 rounded-xl border border-slate-100 bg-[#FAFAF6]/40 flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <span className="text-[11px] font-black uppercase text-slate-800 tracking-wide block">
                      {PARENT_CATEGORY_NAMES[categoryKey]}
                    </span>
                    <p className="text-xs text-slate-500 leading-normal font-serif">
                      {PARENT_CATEGORY_DESCRIPTIONS[categoryKey]}
                    </p>
                  </div>
                  <span className={`text-[10px] font-mono font-bold px-2 py-1 rounded-md shrink-0 whitespace-nowrap ${count > 0 ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-300'}`}>
                    {count} logged
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* RIGHT ONE-THIRD SUB-COLUMN PANEL BLOCK */}
        <div className="space-y-4">
          
          {/* CURATED INTERVENTION DIRECTIVE FEED PICKER */}
          <div className="bg-white p-4 rounded-2xl border border-[#E5E3DD] shadow-xs">
            <h3 className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#1B3A5C]" /> Specialized Focus Feed
            </h3>
            
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {attempts.filter(a => a.analysis?.recommended_intervention).map((item, idx) => {
                const active = item.id === activeInterventionId;
                const parentMappedCategory = mapToParentCategory(item.analysis?.error_reason);
                
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
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
                          {PARENT_CATEGORY_NAMES[parentMappedCategory]}
                        </span>
                        <span className={`text-[9px] font-medium ${active ? 'text-amber-200' : 'text-slate-400'}`}>
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs font-serif font-medium truncate pr-2 opacity-95">
                        Focus Area Recommendation #{attempts.length - idx}
                      </p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 opacity-40 shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* PERSONALIZED REMEDY PRESENTATION CONTAINER BOX */}
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

              <div className="pt-2 border-t border-white/5 flex justify-between items-center text-[10px] text-slate-400 font-medium">
                <span>Pacing Check: {activeInterventionItem.solve_time}s total spent</span>
                <span className="capitalize">Stamina Level: {activeInterventionItem.skeletons?.al_classification || 'A1'}</span>
              </div>
            </div>
          )}

        </div>

      </main>
    </div>
  );
}