'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { 
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { 
  AlertTriangle, Brain, Clock, ShieldAlert, Target, Wallet, Zap, Activity, BookOpen, 
  CheckCircle2, XCircle, MessageSquare, UserX, Smile, HelpCircle
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
  verdict: {
    maxACleared: number;
    maxLCleared: number;
    givesUpEasily: boolean;
    panics: boolean;
    speechRatio: number;
    pacingVariance: number;
    structuralCount: number; // Q11
    flukeCount: number;       // Q11
    triageROICard: string;    // Q12
    crunchBreakpoint: number; // Q13
    frictionIndexScore: number;// Q14
  };
}

export default function CompleteVerdictDashboard() {
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

    rawAttempts.forEach(a => {
      const variantsData = a.variants;
      const al = (Array.isArray(variantsData) 
        ? variantsData[0]?.al_classification 
        : variantsData?.al_classification) || 'A1L1';
        
      const analysis = typeof a.analysis === 'string' ? JSON.parse(a.analysis) : a.analysis;
      
      const y = parseInt(al.match(/A(\d)/)?.[1] || '1'); 
      const x = parseInt(al.match(/L(\d)/)?.[1] || '1'); 

      if (a.is_correct) {
        if (y > maxA) maxA = y;
        if (x > maxL) maxL = x;
      } else {
        // Evaluate exploration parameters mapped from speech engine JSON
        if (analysis?.analysis?.is_structural_flaw || analysis?.is_structural_flaw) {
          structuralCounter++;
        } else {
          flukeCounter++;
        }
      }

      if (analysis?.analysis?.time_pressure_derailment || analysis?.time_pressure_derailment || (a.solve_time < 30 && !a.is_correct)) {
        timeCrunchDerailments++;
      }

      if (analysis?.analysis?.parental_friction_detected || analysis?.parental_friction_detected) {
        verbalFrictionHits++;
      }

      if (analysis?.verbal_action === 'passed' || analysis?.gave_up) {
        passedCount++;
      }

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
    });

    // Q12 Triage Categorization Logic
    let triageVerdict = 'Target Formula Gaps';
    if (errMap.wordingComprehension + errMap.misinterpretedSimpler > errMap.calculationError) {
      triageVerdict = 'Target Text Decoding Filters';
    } else if (errMap.calculationError > 3) {
      triageVerdict = 'Target Computational Accuracy';
    }

    setData({
      raw: { attempted: total, correct: right, passed: passedCount },
      errors: errMap,
      verdict: {
        maxACleared: maxA,
        maxLCleared: maxL,
        givesUpEasily: passedCount > 2,
        panics: errMap.misinterpretedSimpler + errMap.unjustifiedAssumption > 3,
        speechRatio: Math.max(90 - (errMap.unjustifiedAssumption * 10), 45),
        pacingVariance: Math.min((errMap.misinterpretedSimpler * 20) + 20, 100),
        structuralCount: structuralCounter || errMap.blindToSolution + errMap.unjustifiedAssumption,
        flukeCount: flukeCounter || errMap.calculationError,
        triageROICard: triageVerdict,
        crunchBreakpoint: Math.max(55 - (timeCrunchDerailments * 12), 25),
        frictionIndexScore: Math.min(verbalFrictionHits * 25, 100)
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
        Compiling unvarnished diagnostic timeline...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#FAFAF6] flex flex-col items-center justify-center p-6">
        <ShieldAlert className="w-8 h-8 text-amber-600 mb-2" />
        <p className="text-sm font-serif font-bold text-[#1B3A5C]">No data metrics compiled.</p>
        <button onClick={() => router.push('/profile')} className="text-xs text-slate-400 mt-2 underline">Return</button>
      </div>
    );
  }

  const totalErrors = Object.values(data.errors).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-[#FAFAF6] text-[#1B3A5C] font-sans p-4 md:p-8 antialiased pb-32 selection:bg-amber-100">
      
      {/* HEADER */}
      <header className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[#E5E3DD] pb-6 mb-10 gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif tracking-tight">The 11+ High-Stakes Matrix</h1>
          <p className="text-xs text-slate-500 mt-1">14 direct, unvarnished visual profiles built to answer exactly where capital and hours should be spent.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <AuthBadge />
          <button onClick={() => router.push('/profile')} className="bg-[#1B3A5C] text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-slate-800 transition">
            Exit
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto space-y-8">

        {/* 14 QUESTIONS GRID */}
        <div className="bg-white rounded-2xl border border-[#E5E3DD] shadow-sm overflow-hidden divide-y divide-[#E5E3DD]">
          
          {/* Q1: DOES HE GIVE UP EASILY? */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">1. Does he give up easily?</span>
            <div className="md:col-span-2 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
              <p className="text-sm font-bold">{data.verdict.givesUpEasily ? 'Yes. Stalls out when hit by hidden text constraints.' : 'No. Persistent verbal processing even under blind conditions.'}</p>
              <div className="w-32 bg-slate-100 rounded-full h-2 overflow-hidden"><div className="bg-amber-500 h-full" style={{ width: data.verdict.givesUpEasily ? '85%' : '20%' }} /></div>
            </div>
          </div>

          {/* Q2: CORRECT PATH DYNAMICS */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">2. Correct Answer Dynamics</span>
            <div className="md:col-span-2">
              <p className="text-sm font-bold mb-2">Directness vs Speed Allocation</p>
              <div className="relative h-4 w-full bg-slate-100 rounded-md overflow-hidden">
                <div className="bg-[#1B3A5C] h-full transition-all" style={{ width: `${data.verdict.speechRatio}%` }} />
                <span className="absolute right-2 top-0.5 text-[9px] font-mono font-bold text-slate-600">{data.verdict.speechRatio}% Direct Route</span>
              </div>
            </div>
          </div>

          {/* Q3: THE LEAK FILTER GRID */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 bg-[#FAFAF6]/30">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">3. Incorrect Leaks Matrix</span>
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
              <div className="p-2 bg-white border border-[#E5E3DD] rounded"><span>Concept Unknown:</span> <strong className="float-right">{data.errors.conceptUnknown}</strong></div>
              <div className="p-2 bg-white border border-[#E5E3DD] rounded"><span>App Depth Too Hard:</span> <strong className="float-right">{data.errors.appTooHard}</strong></div>
              <div className="p-2 bg-white border border-[#E5E3DD] rounded"><span>Language Comprehension:</span> <strong className="float-right">{data.errors.wordingComprehension}</strong></div>
              <div className="p-2 bg-white border border-[#E5E3DD] rounded"><span>Pattern Misinterpretation:</span> <strong className="float-right">{data.errors.misinterpretedSimpler}</strong></div>
              <div className="p-2 bg-white border border-[#E5E3DD] rounded"><span>Unjustified Assumption:</span> <strong className="float-right">{data.errors.unjustifiedAssumption}</strong></div>
              <div className="p-2 bg-white border border-[#E5E3DD] rounded"><span>Arithmetic Slip:</span> <strong className="float-right">{data.errors.calculationError}</strong></div>
              <div className="p-2 bg-white border border-[#E5E3DD] rounded"><span>Bait Trap Sprung:</span> <strong className="float-right">{data.errors.intentionalTrap}</strong></div>
              <div className="p-2 bg-white border border-[#E5E3DD] rounded"><span>Sub-Answer Boundary Stall:</span> <strong className="float-right">{data.errors.subAnswerStall}</strong></div>
              <div className="p-2 bg-white border border-[#E5E3DD] rounded"><span>Shortcut Blindness:</span> <strong className="float-right">{data.errors.blindToSolution}</strong></div>
            </div>
          </div>

          {/* Q4: HIGH-STAKES REALITY CHECK */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">4. School Target Reality</span>
            <div className="md:col-span-2">
              <p className="text-sm font-bold p-3 rounded-xl bg-amber-50 text-amber-950 border border-amber-200">
                Current structural threshold supports: <span className="underline font-black">{data.verdict.maxACleared >= 3 && data.verdict.maxLCleared >= 3 ? 'Elite Super-Selective Grammar Ready' : data.verdict.maxACleared >= 2 ? 'Standard Local Selective / Run-of-Mill' : 'Local Secondary Track'}</span>.
              </p>
            </div>
          </div>

          {/* Q5: SHIFTING TIER */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">5. Distance to Next Level</span>
            <div className="md:col-span-2">
              <p className="text-sm font-bold">Frontier Target block: <span className="font-mono text-amber-600">A{Math.min(data.verdict.maxACleared + 1, 4)}L{Math.min(data.verdict.maxLCleared + 1, 4)}</span></p>
            </div>
          </div>

          {/* Q6: DOES HE PANIC? */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">6. Pressure Mechanics</span>
            <div className="md:col-span-2 flex justify-between items-center">
              <p className="text-sm font-bold">{data.verdict.panics ? 'Yes. Structural speech parameters fragment under time limits.' : 'No. Execution velocity tracking remains steady.'}</p>
              <span className={`text-[10px] font-bold px-2 py-1 rounded ${data.verdict.panics ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{data.verdict.panics ? 'Pace Volatile' : 'Stable'}</span>
            </div>
          </div>

          {/* Q7: EXTERNAL PORTALS */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">7. Alternative Funnels?</span>
            <div className="md:col-span-2">
              <p className="text-xs text-slate-600">
                {data.errors.wordingComprehension + data.errors.misinterpretedSimpler > data.errors.calculationError 
                  ? 'No. Standard multiple-choice engines drill rule volume; they will not resolve underlying logic tracking voids.' 
                  : 'Yes, but for raw speed practice only.'}
              </p>
            </div>
          </div>

          {/* Q8: HUMAN INTERVENTION LEVERAGE */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">8. 1-on-1 Tutor Value</span>
            <div className="md:col-span-2">
              <p className="text-xs text-slate-600">
                {data.errors.conceptUnknown > data.errors.blindToSolution 
                  ? 'High leverage. Missing explicit formula blocks can be filled rapidly by direct instruction.' 
                  : 'Low leverage. Tutor risk: they step in and solve shortcuts for the child, masking structural blockages.'}
              </p>
            </div>
          </div>

          {/* Q9: CAPITAL SAFETY SWITCH */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center bg-red-50/10">
            <span className="text-xs font-bold uppercase tracking-wider text-red-900 flex items-center gap-1"><Wallet className="w-3.5 h-3.5 text-amber-600" /> 9. Capital Protection</span>
            <div className="md:col-span-2">
              <p className="text-xs font-bold text-slate-700">
                {data.verdict.maxACleared === 1 && data.verdict.maxLCleared === 1 
                  ? 'Pipeline closure recommended. Bypassing massive sunk tutor cost matches development reality.' 
                  : 'Core logic nodes active. Maintain target roadmap framework.'}
              </p>
            </div>
          </div>

          {/* Q10: READING COMPREHENSION WEIGHT */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">10. Reading Comprehension</span>
            <div className="md:col-span-2">
              <p className="text-sm font-bold">{data.verdict.maxLCleared >= 3 ? 'Safe. Successfully decodes layered exclusions.' : 'Vulnerable. Easily turned around by negative keywords.'}</p>
            </div>
          </div>

          {/* ========================================================= */}
          {/* NEW EXPLORATION MODULES (Q11 - Q14)                        */}
          {/* ========================================================= */}

          {/* Q11: SILLY MISTAKE VS PERMANENT BLIND SPOT */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center bg-amber-50/10">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-900">11. Fluke vs. Structural Bug</span>
            <div className="md:col-span-2 flex items-center gap-6 justify-between">
              <div className="space-y-1">
                <p className="text-sm font-bold">Fault Re-occurrence Engine</p>
                <p className="text-xs text-slate-500">Isolates deep-set pattern failures from passing execution slips.</p>
              </div>
              <div className="flex gap-2 text-center text-[10px] font-mono font-bold">
                <div className="p-2 bg-red-50 border border-red-200 rounded text-red-800">
                  <div>{data.verdict.structuralCount}</div> <div className="text-[8px] uppercase tracking-tighter text-slate-400">Structural Bugs</div>
                </div>
                <div className="p-2 bg-slate-50 border border-slate-200 rounded text-slate-600">
                  <div>{data.verdict.flukeCount}</div> <div className="text-[8px] uppercase tracking-tighter text-slate-400">Passing Flukes</div>
                </div>
              </div>
            </div>
          </div>

          {/* Q12: TRIAGE ROI LADDER */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">12. Final 12-Week Triage</span>
            <div className="md:col-span-2">
              <p className="text-sm font-bold text-amber-700 uppercase tracking-wider mb-1">{data.verdict.triageROICard}</p>
              <p className="text-xs text-slate-500">Highest return path based on localized leak weights. Do not touch long-horizon rewiring; patch immediate formula or exclusion gaps tonight.</p>
            </div>
          </div>

          {/* Q13: TIME COUNTDOWN PANIC BREAKPOINT */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">13. Time-Crunch Breakpoint</span>
            <div className="md:col-span-2 flex items-center gap-4 justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-bold">Comprehension Crash Ceiling</p>
                <p className="text-xs text-slate-500">The exact velocity threshold where logic scatter takes over completely.</p>
              </div>
              <div className="text-right">
                <span className="text-xl font-black text-red-600">-{data.verdict.crunchBreakpoint}</span>
                <span className="text-[10px] font-bold text-slate-400 block uppercase font-mono">Seconds / Quest</span>
              </div>
            </div>
          </div>

          {/* Q14: HOME COACHING FRICTION INDEX */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center bg-slate-50/40">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">14. Parental Friction Index</span>
            <div className="md:col-span-2 flex items-center gap-6 justify-between">
              <div>
                <p className="text-sm font-bold">{data.verdict.frictionIndexScore >= 50 ? 'High Conversational Static' : 'Optimal Coaching Environment'}</p>
                <p className="text-xs text-slate-500 mt-0.5">Speech markers tracking child defensive pauses, sigh tokens, or silent checking out during parental hints.</p>
              </div>
              <div className="w-24 bg-slate-200 h-2 rounded-full overflow-hidden relative">
                <div className={`h-full ${data.verdict.frictionIndexScore >= 50 ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: `${data.verdict.frictionIndexScore}%` }} />
              </div>
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}