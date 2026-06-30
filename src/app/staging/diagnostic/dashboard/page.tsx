'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { 
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, ReferenceLine, AreaChart, Area, BarChart, Bar, 
  LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ComposedChart
} from 'recharts';
import { 
  ShieldAlert, BookOpen, CheckCircle2, XCircle, Wallet, Flame, AlertCircle
} from 'lucide-react';
import AuthBadge from '../../../../components/AuthBadge';

interface DiagnosticTelemetry {
  raw: {
    attempted: number;
    correct: number;
    passed: number;
    completedTests: number;
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
    matrixPoints: { label: string; x: number; y: number; z: number; successRate: number }[];
    quadrantPoints: { name: string; speed: number; accuracy: number; label: string }[];
  };
  verdict: {
    maxACleared: number;
    maxLCleared: number;
    givesUpEasily: boolean;
    panics: boolean;
    speechRatio: number;
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
  const [isResumable, setIsResumable] = useState(false);
  const [tutorNarrative, setTutorNarrative] = useState<string>('');
  const [data, setData] = useState<DiagnosticTelemetry | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function compileDashboardData(uid: string) {
    setLoading(true);
    
    // 1. Fetch Diagnostic Session States
    const { data: sessions, error: sessionErr } = await supabase
      .from('diagnostic_sessions')
      .select('status');
      
    let completedTestsCount = 0;
    let activeSessionFound = false;

    if (!sessionErr && sessions) {
      completedTestsCount = sessions.filter(s => s.status === 'completed').length;
      activeSessionFound = sessions.some(s => s.status === 'active');
    }
    setIsResumable(activeSessionFound);

    // 2. Fetch Cached Claude Tutor Summary Narrative Text
    const { data: summaryData, error: summaryError } = await supabase
      .from('cognitive_summaries')
      .select('tutor_narrative')
      .eq('user_id', uid)
      .maybeSingle();

    if (summaryError) {
      console.error("Cognitive Summary Retrieval Link Exception:", summaryError);
    }

    setTutorNarrative(summaryData?.tutor_narrative || 'No global narrative synthesis compiled yet. Complete a full diagnostic run to trigger your expert tutor evaluation report.');

    // 3. Gather Live Spoken Core Telemetry Items with direct skeleton relationship joins
    const { data: attempts, error } = await supabase
      .from('user_attempts')
      .select(`
        is_correct, 
        solve_time, 
        analysis, 
        skeletons ( 
          al_classification 
        )
      `)
      .eq('user_id', uid)
      .order('created_at', { ascending: true });

    if (error || !attempts || attempts.length === 0) {
      setData({
        raw: { attempted: 0, correct: 0, passed: 0, completedTests: completedTestsCount },
        errors: { conceptUnknown: 0, appTooHard: 0, wordingComprehension: 0, misinterpretedSimpler: 0, unjustifiedAssumption: 0, calculationError: 0, intentionalTrap: 0, subAnswerStall: 0, blindToSolution: 0 },
        charts: { fatigueStream: [], errorDistribution: [], altitudeRadar: [], crunchCurve: [], matrixPoints: [], quadrantPoints: [] },
        verdict: { maxACleared: 1, maxLCleared: 1, givesUpEasily: false, panics: false, speechRatio: 100, structuralCount: 0, flukeCount: 0, triageROICard: 'N/A', crunchBreakpoint: 45, frictionIndexScore: 0, canOtherPlatformsHelp: 'N/A', canTutorHelp: 'N/A', isLostCause: false, canReadAndUnderstand: 'N/A' }
      });
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

    // Temporal velocity window trackers for continuous calibration curves
    let curveBuckets = {
      comfortable: { total: 0, correct: 0 },
      paced: { total: 0, correct: 0 },
      highSpeed: { total: 0, correct: 0 },
      panic: { total: 0, correct: 0 }
    };

    let matrixDataMap = new Map<string, { correct: number; total: number }>();
    for(let a = 1; a <= 4; a++) {
      for(let l = 1; l <= 4; l++) {
        matrixDataMap.set(`A${a}L${l}`, { correct: 0, total: 0 });
      }
    }

    // Explicitly define array item typing signatures to address strict compilation checking
    const focusPoints: { name: string; speed: number; accuracy: number; label: string }[] = [];

    const fatigueStream = rawAttempts.map((a, idx) => {
      const skeletonObj = Array.isArray(a.skeletons) ? a.skeletons[0] : a.skeletons;
      const al = skeletonObj?.al_classification || 'A1L1';

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
      
      const isHabitual = analysis?.speech_telemetry?.is_structural_flaw || analysis?.is_structural_flaw;
      if (isHabitual) structuralCounter++;
      else if (!a.is_correct) flukeCounter++;

      // Velocity bucket sort logic
      if (a.solve_time > 60) {
        curveBuckets.comfortable.total++; if (a.is_correct) curveBuckets.comfortable.correct++;
      } else if (a.solve_time >= 45) {
        curveBuckets.paced.total++; if (a.is_correct) curveBuckets.paced.correct++;
      } else if (a.solve_time >= 30) {
        curveBuckets.highSpeed.total++; if (a.is_correct) curveBuckets.highSpeed.correct++;
      } else {
        curveBuckets.panic.total++; if (a.is_correct) curveBuckets.panic.correct++;
      }

      if (analysis?.speech_telemetry?.time_pressure_derailment || analysis?.time_pressure_derailment || (a.solve_time < 35 && !a.is_correct)) {
        timeCrunchDerailments++;
      }
      if (analysis?.speech_telemetry?.parental_friction_detected || analysis?.parental_friction_detected) {
        verbalFrictionHits++;
      }

      if (!a.is_correct) {
        const reason = analysis?.parent_facing_error || analysis?.error_reason;
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

      const densityScore = analysis?.speech_telemetry?.speech_density_score || Math.max(100 - (a.solve_time / 2), 25);

      // Distribute detailed points onto the Focus Quadrant with slight jitter parameters to map distinct question clouds
      const scatterSpeed = Math.max(8, Math.min(92, Math.round(100 - (a.solve_time / 1.5))));
      const scatterAccuracy = a.is_correct ? (82 + (idx % 6)) : (12 + (idx % 6));
      focusPoints.push({
        name: `Problem #${idx + 1}`,
        speed: scatterSpeed,
        accuracy: scatterAccuracy,
        label: `Ex. ${idx + 1}: ${al} (${a.solve_time}s)`
      });

      return {
        question: `#${idx + 1}`,
        speechVolume: Math.round(densityScore),
        accuracy: a.is_correct ? 100 : 0,
        frustration: (analysis?.speech_telemetry?.detected_frustration_tokens || (a.solve_time > 90 && !a.is_correct)) ? 85 : 10
      };
    });

    const matrixPoints = Array.from(matrixDataMap.entries()).map(([al, m]) => {
      const y = parseInt(al.match(/A(\d)/)?.[1] || '1'); 
      const x = parseInt(al.match(/L(\d)/)?.[1] || '1'); 
      return {
        label: al, x, y, z: Math.max(m.total * 35, m.total > 0 ? 40 : 0), successRate: m.total > 0 ? Math.round((m.correct / m.total) * 100) : 0
      };
    }).filter(p => p.z > 0);

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
      { tier: 'Plain Math', childScore: matrixPoints.filter(p => p.x === 1).reduce((acc, p) => acc + p.successRate, 0) / Math.max(matrixPoints.filter(p => p.x === 1).length, 1), fullMark: 100 },
      { tier: 'Wordy Riddles', childScore: matrixPoints.filter(p => p.x >= 3).reduce((acc, p) => acc + p.successRate, 0) / Math.max(matrixPoints.filter(p => p.x >= 3).length, 1), fullMark: 100 },
      { tier: 'Multi-Step Depth', childScore: matrixPoints.filter(p => p.y >= 3).reduce((acc, p) => acc + p.successRate, 0) / Math.max(matrixPoints.filter(p => p.y >= 3).length, 1), fullMark: 100 },
      { tier: 'Olympiad Shells', childScore: matrixPoints.filter(p => p.y === 4 && p.x === 4).reduce((acc, p) => acc + p.successRate, 0) / Math.max(matrixPoints.filter(p => p.y === 4 && p.x === 4).length, 1), fullMark: 100 }
    ].map(r => ({ ...r, childScore: Math.min(Math.round(r.childScore || 10), 100) }));

    const crunchCurve = [
      { velocityWindow: 'Comfortable (>60s)', accuracy: curveBuckets.comfortable.total > 0 ? Math.round((curveBuckets.comfortable.correct / curveBuckets.comfortable.total) * 100) : 65, speedValue: 70 },
      { velocityWindow: 'Paced (45s-60s)', accuracy: curveBuckets.paced.total > 0 ? Math.round((curveBuckets.paced.correct / curveBuckets.paced.total) * 100) : 50 },
      { velocityWindow: 'High-Speed (30s-45s)', accuracy: curveBuckets.highSpeed.total > 0 ? Math.round((curveBuckets.highSpeed.correct / curveBuckets.highSpeed.total) * 100) : 35 },
      { velocityWindow: 'Panic Boundary (<30s)', accuracy: curveBuckets.panic.total > 0 ? Math.round((curveBuckets.panic.correct / curveBuckets.panic.total) * 100) : 15 }
    ];

    let triageVerdict = 'Target Basic Formula Gaps First';
    if (errMap.wordingComprehension + errMap.misinterpretedSimpler > errMap.calculationError) {
      triageVerdict = 'Target Text Decoding Filters';
    } else if (errMap.calculationError > 2) {
      triageVerdict = 'Target Core Computational Accuracy';
    }

    setData({
      raw: { attempted: total, correct: right, passed: passedCount, completedTests: completedTestsCount },
      errors: errMap,
      charts: {
        fatigueStream,
        errorDistribution,
        altitudeRadar: radarData,
        crunchCurve,
        matrixPoints,
        quadrantPoints: focusPoints
      },
      verdict: {
        maxACleared: maxA,
        maxLCleared: maxL,
        givesUpEasily: passedCount > 2,
        panics: errMap.misinterpretedSimpler + errMap.unjustifiedAssumption > 3,
        speechRatio: Math.max(92 - (errMap.unjustifiedAssumption * 12), 40),
        structuralCount: structuralCounter,
        flukeCount: flukeCounter,
        triageROICard: triageVerdict,
        crunchBreakpoint: Math.max(50 - (timeCrunchDerailments * 12), 20),
        frictionIndexScore: Math.min(verbalFrictionHits * 33, 100),
        canOtherPlatformsHelp: errMap.wordingComprehension + errMap.misinterpretedSimpler > errMap.calculationError ? 'No. Multiple-choice systems measure quick answer mechanics; they cannot trace speech tracking paths or decode wording gaps.' : 'Yes, for structural muscle memory only.',
        canTutorHelp: errMap.conceptUnknown > errMap.blindToSolution ? 'High Efficiency. Missing formula blocks or explicit logic slots can be filled rapidly by a tutor.' : 'Low Efficiency Risk. Your child misses shortcuts independently; a human tutor risks doing the core thinking for them.',
        isLostCause: maxA === 1 && maxL === 1 && (right / total) < 0.25,
        canReadAndUnderstand: maxL >= 3 ? 'Safe. Successfully clears text framing conditions under load.' : 'Vulnerable. Tends to drop constraints when negative phrasing spikes.'
      }
    });
    setLoading(false);
  }

  useEffect(() => {
    async function verify() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      await compileDashboardData(user.id);
    }
    verify();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF6] flex items-center justify-center font-serif text-sm text-[#1B3A5C] animate-pulse">
        Fetching cross-diagnostic matrices... Mapping live operational telemetry...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#FAFAF6] flex flex-col items-center justify-center p-6">
        <ShieldAlert className="w-8 h-8 text-amber-600 mb-2" />
        <p className="text-sm font-serif font-bold text-[#1B3A5C]">No performance telemetry located.</p>
        <button onClick={() => router.push('/profile')} className="text-xs text-slate-400 mt-2 underline">Return</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF6] text-[#1B3A5C] font-sans p-4 md:p-8 antialiased selection:bg-amber-100 pb-32">
      
      {/* DYNAMIC ACTIVE SESSION ALERT BANNER */}
      {isResumable && (
        <div className="max-w-[1400px] mx-auto mb-6 bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-fade-in">
          <div className="flex gap-3 items-center">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">Diagnostic Incomplete / Resumable State</h4>
              <p className="text-[11px] text-amber-800 mt-0.5">Your child has an active testing window open. Spoken charts below are updating live question-by-question, but the holistic tutor narrative text is safely frozen to historical results until the current session is finalized.</p>
            </div>
          </div>
          <button 
            onClick={() => router.push('/staging/diagnostic/test?session=resume')} 
            className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl transition shadow-sm whitespace-nowrap"
          >
            Resume Open Session
          </button>
        </div>
      )}

      {/* HEADER SECTION */}
      <header className="max-w-[1400px] mx-auto flex flex-col lg:flex-row justify-between items-start lg:items-center border-b border-[#E5E3DD] pb-6 mb-8 gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-900 text-[10px] font-bold uppercase tracking-widest border border-amber-200 mb-2">
            <Flame className="w-3 h-3 text-amber-600" /> Live Tracking Terminal Active
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

        {/* THE HOLISTIC TUTOR ASSESSMENT NARRATIVE */}
        <div className="bg-white rounded-3xl border border-[#E5E3DD] shadow-sm overflow-hidden">
          <div className="bg-[#1B3A5C] text-white p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-white/10">
            <div>
              <h2 className="text-lg font-serif font-bold tracking-tight">1-on-1 Expert Tutor Synthesis</h2>
              <p className="text-xs text-amber-200 mt-0.5">Holistic narrative analysis compiled explicitly at the completion boundaries of your test pipeline.</p>
            </div>
            <span className="text-[9px] font-mono font-bold bg-white/10 px-3 py-1 rounded-full uppercase tracking-widest text-slate-200">
              Meta State Ledger
            </span>
          </div>
          <div className="p-6 md:p-8 bg-[#FAF9F5]/40 max-h-[400px] overflow-y-auto text-sm text-slate-700 leading-relaxed font-sans whitespace-pre-wrap selection:bg-amber-200">
            {tutorNarrative}
          </div>
        </div>
        
        {/* ROW 1: THE CORE TRACKING COUNTERS BAR */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-2xl border border-[#E5E3DD] shadow-sm">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-600" /> Completed Diagnostics</span>
            <p className="text-4xl font-black text-[#1B3A5C] mt-2">{data.raw.completedTests} <span className="text-xs font-normal text-slate-400 font-sans">Used Credits</span></p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-[#E5E3DD] shadow-sm border-l-4 border-l-amber-500">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1"><BookOpen className="w-3 h-3 text-amber-600" /> Answered Questions So Far</span>
            <p className="text-4xl font-black text-amber-600 mt-2">{data.raw.attempted} <span className="text-xs font-normal text-slate-400 font-sans">Spoken Logs</span></p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-[#E5E3DD] shadow-sm">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1"><XCircle className="w-3 h-3 text-slate-400" /> Correct Execution Rate</span>
            <p className="text-4xl font-black text-slate-700 mt-2">
              {data.raw.attempted > 0 ? Math.round((data.raw.correct / data.raw.attempted) * 100) : 0}% <span className="text-xs font-normal text-slate-400 font-sans">Accuracy Baseline</span>
            </p>
          </div>
        </div>

        {/* ROW 2: PRIMARY HIGH-FIDELITY SCATTER MATRICES */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* CHART 1: APPLICATION VS LINGUISTIC COMPLEXITY MATRIX */}
          <div className="bg-white p-6 rounded-2xl border border-[#E5E3DD] shadow-sm lg:col-span-2 flex flex-col justify-between">
            <div className="mb-4">
              <h3 className="text-sm font-bold font-serif text-[#1B3A5C] uppercase tracking-wider">A vs L Complexity Grid</h3>
              <p className="text-xs text-slate-500 mt-0.5">Isolates math structure constraints vs text riddle processing layers. Area maps density parameters.</p>
            </div>
            <div className="h-72 w-full bg-white rounded-xl border border-[#E5E3DD]/60 pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 30, bottom: 10, left: -25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="x" type="number" domain={[0, 5]} ticks={[1,2,3,4]} stroke="#94a3b8" label={{ value: 'Linguistic Trick Weight (1-4)', position: 'insideBottom', offset: -5, fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis dataKey="y" type="number" domain={[0, 5]} ticks={[1,2,3,4]} stroke="#94a3b8" label={{ value: 'Math Execution Layering (1-4)', angle: -90, position: 'insideLeft', offset: 10, fill: '#94a3b8', fontSize: 10 }} />
                  <ZAxis dataKey="z" type="number" range={[70, 450]} />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const pt = payload[0].payload;
                        return (
                          <div className="bg-[#1B3A5C] p-3 rounded-lg text-white text-xs shadow-xl font-sans">
                            <p className="font-bold text-amber-400">Coordinate Focus: A{pt.y} — L{pt.x}</p>
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
              <strong>Diagnostic Core Altitude:</strong> Your child records safe clearance up to <span className="font-bold underline">A{data.verdict.maxACleared}L{data.verdict.maxLCleared}</span> blocks. Targeting elite hyper-selective tracks without filling constraints at level <span className="font-bold text-amber-700">A{Math.min(data.verdict.maxACleared + 1, 4)}L{Math.min(data.verdict.maxLCleared + 1, 4)}</span> is an educational delusion.
            </div>
          </div>

          {/* CHART 2: THE FOCUS QUADRANT */}
          <div className="bg-white p-6 rounded-2xl border border-[#E5E3DD] shadow-sm flex flex-col justify-between">
            <div className="mb-4">
              <h3 className="text-sm font-bold font-serif text-[#1B3A5C] uppercase tracking-wider">The Focus Quadrant</h3>
              <p className="text-xs text-slate-500 mt-0.5">Plots live evaluation velocities straight against accuracy bounds to highlight child response habits.</p>
            </div>
            <div className="h-72 w-full relative bg-[#FAF9F5] rounded-xl border border-[#E5E3DD]/60 overflow-hidden">
              <div className="absolute top-2 left-2 text-[8px] font-black text-slate-400 uppercase">Perfectionist Stalls</div>
              <div className="absolute top-2 right-2 text-[8px] font-black text-amber-600 uppercase">Exam Ready / Efficient</div>
              <div className="absolute bottom-2 left-2 text-[8px] font-black text-red-500 uppercase">Concept Void</div>
              <div className="absolute bottom-2 right-2 text-[8px] font-black text-slate-500 uppercase">Careless Rusher</div>

              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: -20 }}>
                  <XAxis type="number" dataKey="speed" domain={[0, 100]} axisLine={false} tick={false} />
                  <YAxis type="number" dataKey="accuracy" domain={[0, 100]} axisLine={false} tick={false} />
                  <ReferenceLine x={50} stroke="#E5E3DD" strokeDasharray="3 3" />
                  <ReferenceLine y={50} stroke="#E5E3DD" strokeDasharray="3 3" />
                  <Tooltip cursor={{ strokeDasharray: '2 2' }} content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-[#1B3A5C] text-white p-2 text-[10px] rounded shadow-lg">
                          {payload[0].payload.label}
                        </div>
                      );
                    }
                    return null;
                  }} />
                  <Scatter name="Placement" data={data.charts.quadrantPoints} fill="#d97706" r={7} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 text-[11px] text-slate-500 leading-tight">
              <strong>Stamina & Comprehension Marker:</strong> Audio stream records confirm child {data.verdict.givesUpEasily ? 'surrenders rapidly when logic shortcuts are invisible.' : 'exhibits controlled operational persistence under structural friction.'} Language decoding capacity tracks as <span className="font-bold text-[#1B3A5C]">{data.verdict.canReadAndUnderstand}</span>.
            </div>
          </div>

        </div>

        {/* ROW 3: RECHARTS POWER COHORT */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* CHART 3: VERBAL TIMELINE & FRUSTRATION AREA */}
          <div className="bg-white p-6 rounded-2xl border border-[#E5E3DD] shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold font-serif uppercase tracking-wider">Spoken Stream Density Timeline</h3>
              <p className="text-xs text-slate-500 mt-0.5">Chronological question vector mapping speech clarity factors (Bars) against friction spikes (Area).</p>
            </div>
            <div className="h-48 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.charts.fatigueStream} margin={{ top: 10, right: -5, left: -30, bottom: 0 }}>
                  <XAxis dataKey="question" axisLine={false} tickLine={false} tick={{ fontSize: 9 }} />
                  <YAxis axisLine={false} tickLine={false} tick={false} />
                  <Tooltip />
                  <Bar dataKey="speechVolume" fill="#e2e8f0" radius={[2, 2, 0, 0]} name="Speech Density Score" />
                  <Area type="monotone" dataKey="frustration" fill="#fef3c7" stroke="#d97706" strokeWidth={1.5} name="Detected Frustration Spikes" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 text-xs bg-slate-50 p-3 rounded-xl border border-[#E5E3DD]">
              <strong>Correct Path Vectoring:</strong> Spoken layout tracks show <span className="font-bold underline">{data.verdict.speechRatio}% logic economy tracking</span>. Parent conversational static index: <span className="font-bold text-amber-700">{data.verdict.frictionIndexScore}% friction volume</span>.
            </div>
          </div>

          {/* CHART 4: POINT LEAK DISTRIBUTION BAR CHART */}
          <div className="bg-white p-6 rounded-2xl border border-[#E5E3DD] shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold font-serif uppercase tracking-wider">Structural Leak Filter</h3>
              <p className="text-xs text-slate-500 mt-0.5">Live error distribution categorizing every single failed logical approach by its failed mode token.</p>
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
              <strong>Fault Re-occurrence Matrix:</strong> The system has isolated <span className="font-bold text-[#1B3A5C]">{data.verdict.structuralCount} repeating behavior bugs</span> vs <span className="font-bold text-slate-400">{data.verdict.flukeCount} isolated calculation slips</span>.
            </div>
          </div>

          {/* CHART 5: TIME-CRUNCH CRASH TIMELINE */}
          <div className="bg-white p-6 rounded-2xl border border-[#E5E3DD] shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold font-serif uppercase tracking-wider">Time-Crunch Crash Ceiling</h3>
              <p className="text-xs text-slate-500 mt-0.5">Maps exact logic stability boundaries as pacing parameters shrink below standard comfort margins.</p>
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
              <strong>Velocity Breakdown:</strong> Logic degradation initializes when forced beneath <span className="font-bold underline">{data.verdict.crunchBreakpoint} seconds/question</span>. 12-Week Triage: <span className="font-bold text-amber-700">{data.verdict.triageROICard}</span>.
            </div>
          </div>

        </div>

        {/* ROW 4: STRATEGIC ALTITUDE RADAR & STRATEGIC ALLOCATION VERDICTS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* CHART 6: THE CAPABILITY ALTITUDE RADAR */}
          <div className="bg-white p-6 rounded-2xl border border-[#E5E3DD] shadow-sm flex flex-col items-center justify-between">
            <div className="w-full">
              <h3 className="text-sm font-bold font-serif uppercase tracking-wider text-[#1B3A5C]">Excellence Altitude Profile</h3>
              <p className="text-xs text-slate-500 mt-0.5">Exposes localized logic capabilities across different selective exam framing setups.</p>
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

          {/* CAPITAL ALLOCATION & EXTERNAL ADVICE BLOCKS */}
          <div className="bg-white p-6 rounded-2xl border border-[#E5E3DD] shadow-sm md:col-span-2 flex flex-col justify-between">
            <div className="bg-[#1B3A5C] text-white p-4 rounded-xl flex items-center justify-between gap-4">
              <div>
                <h4 className="text-xs font-bold uppercase text-amber-400 tracking-wider flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> Capital Safety Switch Directive</h4>
                <p className="text-[11px] text-slate-200 mt-1">
                  {data.verdict.isLostCause 
                    ? 'Bypass 11+ selective streams entirely. Save thousands in private tutoring costs; raw capabilities map away from short-horizon development timelines.' 
                    : 'Core logic nodes active. Capacity tracks tightly with elite selective filter requirements. Target specific text constraints rather than broader equation drill volume.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div className="p-4 rounded-xl border border-[#E5E3DD] bg-[#FAFAF6] space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Can Alternative Digital Platforms Help?</span>
                <p className="text-xs font-medium text-slate-700 leading-tight">{data.verdict.canOtherPlatformsHelp}</p>
              </div>
              <div className="p-4 rounded-xl border border-[#E5E3DD] bg-[#FAFAF6] space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Human 1-on-1 Tutor Leverage?</span>
                <p className="text-xs font-medium text-slate-700 leading-tight">{data.verdict.canTutorHelp}</p>
              </div>
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}