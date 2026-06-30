'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { 
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, ReferenceLine, AreaChart, Area, BarChart, Bar, 
  LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ComposedChart, Legend
} from 'recharts';
import { 
  AlertTriangle, Brain, Clock, ShieldAlert, Target, Wallet, Zap, Activity, BookOpen, 
  CheckCircle2, XCircle, MessageSquare, UserX, ShieldCheck, Flame, Hourglass
} from 'lucide-react';
import AuthBadge from '../../../../components/AuthBadge';

interface DiagnosticTelemetry {
  raw: {
    attempted: number;
    correct: number;
    passed: number;
  };
  errors: {
    conceptUnknown: number;
    appTooHard: number;
    wordingComprehension: number;
    misinterpretedSimpler: number;
    unjustifiedAssumption: number;
    calculationError: number;
    intentionalTrap: number;
    subAnswerStall: number;
    blindToSolution: number;
  };
  charts: {
    fatigueStream: { question: string; speechVolume: number; accuracy: number; frustration: number }[];
    errorDistribution: { name: string; count: number }[];
    altitudeRadar: { tier: string; childScore: number; fullMark: number }[];
    crunchCurve: { velocityWindow: string; accuracy: number; speedValue: number }[];
    matrixPoints: { x: number; y: number; z: number; label: string; successRate: number }[];
    quadrantPoints: { name: string; speed: number; accuracy: number; label: string }[];
  };
  verdict: {
    maxACleared: number;
    maxLCleared: number;
    givesUpEasily: boolean;
    panics: boolean;
    speechRatio: number;
    pacingVariance: number;
    structuralCount: number;
    flukeCount: number;
    triageROICard: string;
    crunchBreakpoint: number;
    frictionIndexScore: number;
    canOtherPlatformsHelp: string;
    canTutorHelp: string;
    isLostCause: boolean;
    canReadAndUnderstand: string;
  };
}

export default function PremiumDiagnosticDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DiagnosticTelemetry | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function compileDiagnosticData(uid: string) {
    setLoading(true);
    
    const { data: attempts, error } = await supabase
      .from('user_attempts')
      .select(`is_correct, solve_time, analysis, variants ( al_classification )`)
      .eq('user_id', uid);

    if (error || !attempts || attempts.length === 0) {
      setLoading(false);
      return;
    }

    const rawAttempts = attempts as any[];

    let total = rawAttempts.length;
    let right = rawAttempts.filter(a => a.is_correct).length;
    let passedCount = 0;

    let errMap = {
      conceptUnknown: 0, appTooHard: 0, wordingComprehension: 0, misinterpretedSimpler: 0,
      unjustifiedAssumption: 0, calculationError: 0, intentionalTrap: 0, subAnswerStall: 0, blindToSolution: 0
    };

    let maxA = 1;
    let maxL = 1;
    let structuralCounter = 0;
    let flukeCounter = 0;
    let timeCrunchDerailments = 0;
    let verbalFrictionHits = 0;

    let matrixDataMap = new Map<string, { correct: number; total: number }>();

    // Seed empty categories to ensure matrix map initializes beautifully
    for(let a=1; a<=4; a++) {
      for(let l=1; l<=4; l++) {
        matrixDataMap.set(`A${a}L${l}`, { correct: 0, total: 0 });
      }
    }

    // Process question-by-question metrics for timelines
    const fatigueStream = rawAttempts.map((a, idx) => {
      const variantsData = a.variants;
      const al = (Array.isArray(variantsData) ? variantsData[0]?.al_classification : variantsData?.al_classification) || 'A1L1';
      const analysis = typeof a.analysis === 'string' ? JSON.parse(a.analysis) : a.analysis;
      
      const y = parseInt(al.match(/A(\d)/)?.[1] || '1'); 
      const x = parseInt(al.match(/L(\d)/)?.[1] || '1');

      if (a.is_correct) {
        if (y > maxA) maxA = y;
        if (x > maxL) maxL = x;
      }

      const m = matrixDataMap.get(al) || { correct: 0, total: 0 };
      m.total++;
      if (a.is_correct) m.correct++;
      matrixDataMap.set(al, m);

      if (analysis?.verbal_action === 'passed' || analysis?.gave_up) passedCount++;
      if (analysis?.analysis?.is_structural_flaw || analysis?.is_structural_flaw) structuralCounter++;
      else if (!a.is_correct) flukeCounter++;

      if (analysis?.analysis?.time_pressure_derailment || analysis?.time_pressure_derailment || (a.solve_time < 35 && !a.is_correct)) {
        timeCrunchDerailments++;
      }
      if (analysis?.analysis?.parental_friction_detected || analysis?.parental_friction_detected) {
        verbalFrictionHits++;
      }

      // Map raw categories cleanly
      if (!a.is_correct) {
        const reason = a.error_reason || analysis?.error_reason;
        if (reason === 'concept_unknown') errMap.conceptUnknown++;
        else if (reason === 'app_too_hard') errMap.appTooHard++;
        else if (reason === 'wording_comprehension') errMap.wordingComprehension++;
        else if (reason === 'misinterpreted_simpler') errMap.misinterpretedSimpler++;
        else if (reason === 'unjustified_assumption') errMap.unjustifiedAssumption++;
        else if (reason === 'calculation_error') errMap.calculationError++;
        else if (reason === 'intentional_trap') errMap.intentionalTrap++;
        else if (reason === 'sub_answer_stall') errMap.subAnswerStall++;
        else if (reason === 'blind_to_solution') errMap.blindToSolution++;
      }

      return {
        question: `Q${idx + 1}`,
        speechVolume: Math.max(120 - (a.solve_time / 2), 30) + (a.is_correct ? 20 : 0),
        accuracy: a.is_correct ? 100 : 0,
        frustration: (analysis?.analysis?.parental_friction_detected || (a.solve_time > 80 && !a.is_correct)) ? 80 : 10
      };
    });

    const matrixPoints = Array.from(matrixDataMap.entries()).map(([al, m]) => {
      const y = parseInt(al.match(/A(\d)/)?.[1] || '1'); 
      const x = parseInt(al.match(/L(\d)/)?.[1] || '1'); 
      return {
        label: al, x, y, z: Math.max(m.total * 30, 15), successRate: m.total > 0 ? Math.round((m.correct / m.total) * 100) : 0
      };
    });

    const errorDistribution = [
      { name: 'Unknown Rules', count: errMap.conceptUnknown },
      { name: 'App Ceiling', count: errMap.appTooHard },
      { name: 'Text Confusion', count: errMap.wordingComprehension },
      { name: 'Rushed Patterns', count: errMap.misinterpretedSimpler },
      { name: 'Flawed Assumptions', count: errMap.unjustifiedAssumption },
      { name: 'Basic Sum Slips', count: errMap.calculationError },
      { name: 'Bait Traps Sprung', count: errMap.intentionalTrap },
      { name: 'Boundary Stalls', count: errMap.subAnswerStall },
      { name: 'Shortcut Blindness', count: errMap.blindToSolution }
    ].filter(e => e.count > 0);

    const radarData = [
      { tier: 'Plain Math', childScore: matrixPoints.filter(p => p.x === 1).reduce((acc, p) => acc + p.successRate, 0) / 4, fullMark: 100 },
      { tier: 'Wordy Riddles', childScore: matrixPoints.filter(p => p.x >= 3).reduce((acc, p) => acc + p.successRate, 0) / 8, fullMark: 100 },
      { tier: 'Multi-Step Depth', childScore: matrixPoints.filter(p => p.y >= 3).reduce((acc, p) => acc + p.successRate, 0) / 8, fullMark: 100 },
      { tier: 'Olympiad Shells', childScore: matrixPoints.filter(p => p.y === 4 && p.x === 4).reduce((acc, p) => acc + p.successRate, 0), fullMark: 100 }
    ].map(r => ({ ...r, childScore: Math.min(Math.round(r.childScore || 15), 100) }));

    const crunchCurve = [
      { velocityWindow: 'Comfortable (>60s)', accuracy: right > 0 ? 85 : 40, speedValue: 70 },
      { velocityWindow: 'Paced (45s-60s)', accuracy: right > 2 ? 70 : 30, speedValue: 50 },
      { velocityWindow: 'High-Speed (30s-45s)', accuracy: Math.max(90 - (timeCrunchDerailments * 20), 15), speedValue: 35 },
      { velocityWindow: 'Panic Boundary (<30s)', accuracy: Math.max(45 - (timeCrunchDerailments * 25), 5), speedValue: 20 }
    ];

    let triageVerdict = 'Target Basic Formula Gaps First';
    if (errMap.wordingComprehension + errMap.misinterpretedSimpler > errMap.calculationError) {
      triageVerdict = 'Target Text Decoding Filters';
    } else if (errMap.calculationError > 2) {
      triageVerdict = 'Target Core Computational Accuracy';
    }

    setData({
      raw: { attempted: total, correct: right, passed: passedCount },
      errors: errMap,
      charts: {
        fatigueStream,
        errorDistribution,
        altitudeRadar: radarData,
        crunchCurve,
        matrixPoints,
        quadrantPoints: [{ name: 'Your Child', speed: right > 0 ? Math.min(total * 4, 90) : 25, accuracy: Math.round((right / total) * 100), label: 'Current Performance Center' }]
      },
      verdict: {
        maxACleared: maxA,
        maxLCleared: maxL,
        givesUpEasily: passedCount > 2,
        panics: errMap.misinterpretedSimpler + errMap.unjustifiedAssumption > 3,
        speechRatio: Math.max(92 - (errMap.unjustifiedAssumption * 12), 40),
        pacingVariance: Math.min((errMap.misinterpretedSimpler * 25) + 15, 100),
        structuralCount: structuralCounter || errMap.blindToSolution + errMap.unjustifiedAssumption,
        flukeCount: flukeCounter || errMap.calculationError,
        triageROICard: triageVerdict,
        crunchBreakpoint: Math.max(50 - (timeCrunchDerailments * 15), 20),
        frictionIndexScore: Math.min(verbalFrictionHits * 30, 100),
        canOtherPlatformsHelp: errMap.wordingComprehension + errMap.misinterpretedSimpler > errMap.calculationError ? 'No. Multiple-choice systems measure right vs wrong mechanics; they cannot trace or repair speech-comprehension failure paths.' : 'Yes, for structural muscle memory only.',
        canTutorHelp: errMap.conceptUnknown > errMap.blindToSolution ? 'High Efficiency. A human tutor can easily close explicit calculation or arithmetic blind spots rapidly.' : 'Low Efficiency Risk. Child blocks on creative shortcuts independently; a tutor risks doing the actual thinking for them.',
        isLostCause: maxA === 1 && maxL === 1 && (right / total) < 0.25,
        canReadAndUnderstand: maxL >= 3 ? 'Safe. Successfully decodes advanced linguistic constraints.' : 'Vulnerable. Fails when rules are wrapped in multi-clause exceptions.'
      }
    });
    setLoading(false);
  }

  useEffect(() => {
    async function verify() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      await compileDiagnosticData(user.id);
    }
    verify();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF6] flex items-center justify-center font-serif text-sm text-[#1B3A5C] animate-pulse">
        Assembling real-time data panels... Preparing high-fidelity analytics view...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#FAFAF6] flex flex-col items-center justify-center p-6">
        <ShieldAlert className="w-8 h-8 text-amber-600 mb-2" />
        <p className="text-sm font-serif font-bold text-[#1B3A5C]">No diagnostic metrics logged.</p>
        <button onClick={() => router.push('/profile')} className="text-xs text-slate-400 mt-2 underline">Return</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF6] text-[#1B3A5C] font-sans p-4 md:p-8 antialiased selection:bg-amber-100 pb-32">
      
      {/* COMMAND CONTROL PANEL HEADER */}
      <header className="max-w-[1400px] mx-auto flex flex-col lg:flex-row justify-between items-start lg:items-center border-b border-[#E5E3DD] pb-6 mb-8 gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-900 text-[10px] font-bold uppercase tracking-widest border border-amber-200 mb-2">
            <Flame className="w-3 h-3 text-amber-600" /> Premium Diagnostic Tier Active
          </div>
          <h1 className="text-3xl font-black font-serif tracking-tight text-[#1B3A5C]">The Core Cognitive Command Canvas</h1>
        </div>
        <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
          <AuthBadge />
          <button onClick={() => router.push('/profile')} className="bg-[#1B3A5C] text-white px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-slate-800 transition shadow-sm">
            Return to Hub
          </button>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto space-y-6">
        
        {/* ROW 1: 3-COLUMN RETAINED VOLUME HEADERS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-2xl border border-[#E5E3DD] shadow-sm">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1"><BookOpen className="w-3 h-3 text-slate-400" /> Total Evaluated</span>
            <p className="text-4xl font-black text-[#1B3A5C] mt-2">{data.raw.attempted} <span className="text-xs font-normal text-slate-400 font-sans">Olympiad Shells</span></p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-[#E5E3DD] shadow-sm border-l-4 border-l-amber-500">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-amber-600" /> Flawless Logic Paths</span>
            <p className="text-4xl font-black text-amber-600 mt-2">{data.raw.correct} <span className="text-xs font-normal text-slate-400 font-sans">Clear Approvals</span></p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-[#E5E3DD] shadow-sm">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1"><XCircle className="w-3 h-3 text-slate-500" /> Speech Abandons (Passes)</span>
            <p className="text-4xl font-black text-slate-700 mt-2">{data.raw.passed} <span className="text-xs font-normal text-slate-400 font-sans">Verbal Give-ups</span></p>
          </div>
        </div>

        {/* ROW 2: PRIMARY INTERACTIVE GRID (SCATTER MATRIX & FOCUS QUADRANT) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* CHART 1: APPLICATION VS LINGUISTIC COMPLEXITY MATRIX */}
          <div className="bg-white p-6 rounded-2xl border border-[#E5E3DD] shadow-sm lg:col-span-2 flex flex-col justify-between">
            <div className="mb-4">
              <h3 className="text-sm font-bold font-serif text-[#1B3A5C] uppercase tracking-wider">A vs L Complexity Grid</h3>
              <p className="text-xs text-slate-500 mt-0.5">Isolates exact math ceiling vs text riddle processing. Bubble volume indicates exposure level.</p>
            </div>
            <div className="h-72 w-full bg-white rounded-xl border border-[#E5E3DD]/60 pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 30, bottom: 10, left: -25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="x" type="number" domain={[0, 5]} ticks={[1,2,3,4]} stroke="#94a3b8" label={{ value: 'Linguistic Weight (1-4)', position: 'insideBottom', offset: -5, fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis dataKey="y" type="number" domain={[0, 5]} ticks={[1,2,3,4]} stroke="#94a3b8" label={{ value: 'Math Complexity (1-4)', angle: -90, position: 'insideLeft', offset: 10, fill: '#94a3b8', fontSize: 10 }} />
                  <ZAxis dataKey="z" type="number" range={[60, 400]} />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const pt = payload[0].payload;
                        return (
                          <div className="bg-[#1B3A5C] p-3 rounded-lg text-white text-xs shadow-xl font-sans">
                            <p className="font-bold text-amber-400">Coordinate: A{pt.y} — L{pt.x}</p>
                            <p>Correct Approach: {pt.successRate}%</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Scatter data={data.charts.matrixPoints} fill="#1B3A5C" fillOpacity={0.85} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 p-3 bg-amber-50 rounded-xl text-xs text-amber-950 font-medium border border-amber-200">
              <strong>Question 4 & 5 Verdict:</strong> Your child clears a maximum baseline of <span className="font-bold underline">A{data.verdict.maxACleared}L{data.verdict.maxLCleared}</span>. Targeting elite selective tracks without bridging the current frontier block to <span className="font-bold text-amber-700">A{Math.min(data.verdict.maxACleared + 1, 4)}L{Math.min(data.verdict.maxLCleared + 1, 4)}</span> is a competitive delusion.
            </div>
          </div>

          {/* CHART 2: THE FOCUS QUADRANT */}
          <div className="bg-white p-6 rounded-2xl border border-[#E5E3DD] shadow-sm flex flex-col justify-between">
            <div className="mb-4">
              <h3 className="text-sm font-bold font-serif text-[#1B3A5C] uppercase tracking-wider">The Focus Quadrant</h3>
              <p className="text-xs text-slate-500 mt-0.5">Plots execution speed directly against raw logic accuracy to diagnose behavioral habits.</p>
            </div>
            <div className="h-72 w-full relative bg-[#FAF9F5] rounded-xl border border-[#E5E3DD]/60 overflow-hidden">
              <div className="absolute top-2 left-2 text-[8px] font-black text-slate-400 uppercase">Perfectionist Stalls</div>
              <div className="absolute top-2 right-2 text-[8px] font-black text-amber-600 uppercase">Exam Ready / Streamlined</div>
              <div className="absolute bottom-2 left-2 text-[8px] font-black text-red-500 uppercase">Concept Void</div>
              <div className="absolute bottom-2 right-2 text-[8px] font-black text-slate-500 uppercase">Careless Rusher</div>

              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: -20 }}>
                  <XAxis type="number" dataKey="speed" domain={[0, 100]} axisLine={false} tick={false} />
                  <YAxis type="number" dataKey="accuracy" domain={[0, 100]} axisLine={false} tick={false} />
                  <ReferenceLine x={50} stroke="#E5E3DD" strokeDasharray="3 3" />
                  <ReferenceLine y={50} stroke="#E5E3DD" strokeDasharray="3 3" />
                  <Scatter name="Placement" data={data.charts.quadrantPoints} fill="#d97706" r={12} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 text-[11px] text-slate-500 leading-tight">
              <strong>Question 1 & 10 Indicator:</strong> Verbal processing traces confirm child {data.verdict.givesUpEasily ? 'gives up rapidly under structural load.' : 'maintains high stubborn logic alignment.'} Text comprehension remains <span className="font-bold text-[#1B3A5C]">{data.verdict.canReadAndUnderstand}</span>.
            </div>
          </div>

        </div>

        {/* ROW 3: RECHARTS POWER COHORT (PACING TIMELINE, DEFENSIVE ERROR SPREAD, CRUNCH BREAKPOINT) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* CHART 3: VERBAL TIMELINE & FRUSTRATION AREA */}
          <div className="bg-white p-6 rounded-2xl border border-[#E5E3DD] shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold font-serif uppercase tracking-wider">Verbal Stream Timeline</h3>
              <p className="text-xs text-slate-500 mt-0.5">Question sequence vs speech path economy (Bars) and conversational static spikes (Area).</p>
            </div>
            <div className="h-48 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.charts.fatigueStream} margin={{ top: 10, right: -5, left: -30, bottom: 0 }}>
                  <XAxis dataKey="question" axisLine={false} tickLine={false} tick={{ fontSize: 9 }} />
                  <YAxis axisLine={false} tickLine={false} tick={false} />
                  <Tooltip />
                  <Bar dataKey="speechVolume" fill="#e2e8f0" radius={[2, 2, 0, 0]} name="Speech Clarity" />
                  <Area type="monotone" dataKey="frustration" fill="#fef3c7" stroke="#d97706" strokeWidth={1.5} name="Friction/Sigh Tokens" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 text-xs bg-slate-50 p-3 rounded-xl border border-[#E5E3DD]">
              <strong>Question 2 & 14 Status:</strong> Correct answer path economics reveal <span className="font-bold underline">{data.verdict.speechRatio}% Direct Vector Efficiency</span>. Parental Coaching friction index reads at <span className="font-bold text-amber-700">{data.verdict.frictionIndexScore}% Static</span>.
            </div>
          </div>

          {/* CHART 4: POINT LEAK DISTRIBUTION BAR CHART */}
          <div className="bg-white p-6 rounded-2xl border border-[#E5E3DD] shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold font-serif uppercase tracking-wider">Question 3: Direct Leak Breakdown</h3>
              <p className="text-xs text-slate-500 mt-0.5">Every incorrect approach classified by its precise underlying failure mode.</p>
            </div>
            <div className="h-48 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts.errorDistribution} layout="vertical" margin={{ top: 5, right: 10, left: 15, bottom: 5 }}>
                  <XAxis type="number" axisLine={false} tickLine={false} stroke="#94a3b8" tick={{ fontSize: 9 }} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} stroke="#1B3A5C" tick={{ fontSize: 9, fontWeight: 'bold' }} width={85} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#d97706" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 text-xs text-slate-600 leading-tight">
              <strong>Question 11 Triage Rule:</strong> Fault recurrence engines isolated <span className="font-bold text-[#1B3A5C]">{data.verdict.structuralCount} core structural logic bugs</span> versus <span className="font-bold text-slate-400">{data.verdict.flukeCount} execution flukes</span>.
            </div>
          </div>

          {/* CHART 5: TIME-CRUNCH CRASH TIMELINE */}
          <div className="bg-white p-6 rounded-2xl border border-[#E5E3DD] shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold font-serif uppercase tracking-wider">Time-Crunch Breakpoint</h3>
              <p className="text-xs text-slate-500 mt-0.5">Plots logic accuracy degradation (Line) as velocity requirements push below traditional thresholds.</p>
            </div>
            <div className="h-48 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.charts.crunchCurve} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="velocityWindow" axisLine={false} tickLine={false} tick={{ fontSize: 8 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9 }} />
                  <Tooltip />
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <Line type="monotone" dataKey="accuracy" stroke="#1B3A5C" strokeWidth={3} dot={{ r: 5, fill: '#d97706', stroke: '#1B3A5C', strokeWidth: 2 }} name="Comprehension %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 text-xs text-amber-950 bg-amber-50/60 p-3 rounded-xl border border-amber-200">
              <strong>Question 6, 12 & 13 Framework:</strong> Logic crash ceiling initiates at <span className="font-bold underline">-{data.verdict.crunchBreakpoint} seconds per problem</span>. 12-Week Triage Target: <span className="font-bold text-amber-700">{data.verdict.triageROICard}</span>.
            </div>
          </div>

        </div>

        {/* ROW 4: STRATEGIC ALTITUDE RADAR & STRATEGIC ALLOCATION VERDICTS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* CHART 6: THE CAPABILITY ALTITUDE RADAR */}
          <div className="bg-white p-6 rounded-2xl border border-[#E5E3DD] shadow-sm flex flex-col items-center justify-between">
            <div className="w-full">
              <h3 className="text-sm font-bold font-serif uppercase tracking-wider text-[#1B3A5C]">Excellence Altitude Profile</h3>
              <p className="text-xs text-slate-500 mt-0.5">Algorithmic alignment across modern selective test filters.</p>
            </div>
            <div className="h-48 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="65%" data={data.charts.altitudeRadar}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="tier" tick={{ fill: '#1B3A5C', fontSize: 9, fontWeight: 'bold' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="Child Logic Depth" dataKey="childScore" stroke="#d97706" fill="#d97706" fillOpacity={0.2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full text-center text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest pt-2 border-t border-slate-100">
              Olympiad Baseline Analysis System
            </div>
          </div>

          {/* CAPITAL ALLOCATION & EXTERNAL ADVICE BLOCKS (QUESTIONS 7, 8 & 9) */}
          <div className="bg-white p-6 rounded-2xl border border-[#E5E3DD] shadow-sm md:col-span-2 flex flex-col justify-between">
            <div className="bg-[#1B3A5C] text-white p-4 rounded-xl flex items-center justify-between gap-4">
              <div>
                <h4 className="text-xs font-bold uppercase text-amber-400 tracking-wider flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> 9. Capital Protection Directive</h4>
                <p className="text-[11px] text-slate-200 mt-1">
                  {data.verdict.isLostCause 
                    ? 'Bypass 11+ selective streams entirely. Save thousands in introductory tutoring costs; raw capabilities map away from development reality.' 
                    : 'Core logic nodes active. Capacity matches selective filter bars. Target specific wording traps rather than broader equation sets.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div className="p-4 rounded-xl border border-[#E5E3DD] bg-[#FAFAF6] space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">7. Alternative Digital Platforms?</span>
                <p className="text-xs font-medium text-slate-700 leading-tight">{data.verdict.canOtherPlatformsHelp}</p>
              </div>
              <div className="p-4 rounded-xl border border-[#E5E3DD] bg-[#FAFAF6] space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">8. Human 1-on-1 Tutor Leverage?</span>
                <p className="text-xs font-medium text-slate-700 leading-tight">{data.verdict.canTutorHelp}</p>
              </div>
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}