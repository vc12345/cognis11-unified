'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { 
  AlertTriangle, Brain, Clock, ShieldAlert, Target, Wallet, Zap, Activity, BookOpen, 
  HelpCircle, CheckCircle2, XCircle, ChevronRight, UserX, MessageSquare, Gauge 
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
    speechRatio: number; // optimal logic density ratio
    pacingVariance: number; // 0 = stable, 100 = volatile panic
  };
}

export default function ParentVerdictDashboard() {
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
    let highComplexityPauses = 0;

    let errMap = {
      conceptUnknown: 0, appTooHard: 0, wordingComprehension: 0, misinterpretedSimpler: 0,
      unjustifiedAssumption: 0, calculationError: 0, intentionalTrap: 0, subAnswerStall: 0, blindToSolution: 0
    };

    let maxA = 1;
    let maxL = 1;

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
      }

      if (analysis?.verbal_action === 'passed' || analysis?.gave_up || a.solve_time > 120) {
        passedCount++;
      }

      if (y >= 3 && a.solve_time > 45) {
        highComplexityPauses++;
      }

      if (!a.is_correct && analysis?.error_reason) {
        const reason = analysis.error_reason;
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

    setData({
      raw: { attempted: total, correct: right, passed: passedCount },
      errors: errMap,
      verdict: {
        maxACleared: maxA,
        maxLCleared: maxL,
        givesUpEasily: passedCount > 3,
        panics: errMap.misinterpretedSimpler + errMap.unjustifiedAssumption > 3,
        speechRatio: Math.max(85 - (errMap.unjustifiedAssumption * 8), 40),
        pacingVariance: Math.min((highComplexityPauses * 20) + (errMap.misinterpretedSimpler * 15), 100)
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
        Building custom logic components... Generating raw parental truth...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#FAFAF6] flex flex-col items-center justify-center p-6">
        <ShieldAlert className="w-8 h-8 text-amber-600 mb-2" />
        <p className="text-sm font-serif font-bold text-[#1B3A5C]">No diagnostic records generated yet.</p>
        <button onClick={() => router.push('/profile')} className="text-xs text-slate-400 mt-2 underline">Return to Hub</button>
      </div>
    );
  }

  // Derived helper scores
  const totalErrors = Object.values(data.errors).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-[#FAFAF6] text-[#1B3A5C] font-sans p-4 md:p-8 antialiased selection:bg-amber-100 pb-32">
      
      {/* HEADER */}
      <header className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[#E5E3DD] pb-6 mb-10 gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif tracking-tight">The 11+ Reality Report</h1>
          <p className="text-xs text-slate-500 mt-1">An unvarnished visual diagnostic mapping exactly how your child’s brain responds to elite competition rules.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <AuthBadge />
          <button onClick={() => router.push('/profile')} className="bg-[#1B3A5C] text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-slate-800 transition shadow-sm">
            Exit to Hub
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto space-y-8">

        {/* ------------------------------------------------------------- */}
        {/* QUESTIONS 1 & 2: STAMINA AND CORRECT PATH ECONOMY            */}
        {/* ------------------------------------------------------------- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Q1: DOES HE GIVE UP EASILY? */}
          <div className="bg-white p-6 rounded-2xl border border-[#E5E3DD] shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">1. Does he give up easily?</h3>
              <p className="text-sm font-bold font-serif mb-4">
                {data.verdict.givesUpEasily ? 'Yes. He hits a complexity ceiling and cuts the speech file short.' : 'No. He maintains stubborn verbal stamina even when entirely lost.'}
              </p>
            </div>
            {/* VISUALIZATION: The Verbal Stamina Wave */}
            <div className="bg-[#FAFAF6] p-4 rounded-xl border border-[#E5E3DD]/60">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-2">Verbal Processing Flow (Stamina Indicator)</div>
              <div className="flex items-end gap-1 h-12 pt-2">
                {[45, 60, 80, 75, data.verdict.givesUpEasily ? 20 : 70, data.verdict.givesUpEasily ? 10 : 85, 90, 50, 15, 5].map((h, i) => (
                  <div 
                    key={i} 
                    className={`flex-1 rounded-t-sm transition-all ${
                      i >= 7 && data.verdict.givesUpEasily ? 'bg-red-300' : 'bg-amber-500'
                    }`}
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              <div className="flex justify-between text-[9px] text-slate-400 font-bold uppercase mt-2">
                <span>Start (Simple Concepts)</span>
                <span className={data.verdict.givesUpEasily ? 'text-red-600' : 'text-slate-400'}>
                  {data.verdict.givesUpEasily ? 'Logic Snapped' : 'Endured Pressure'}
                </span>
              </div>
            </div>
          </div>

          {/* Q2: DIRECTNESS VS SPEED */}
          <div className="bg-white p-6 rounded-2xl border border-[#E5E3DD] shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">2. When he answers correctly, is it clean?</h3>
              <p className="text-sm font-bold font-serif mb-4">
                {data.verdict.speechRatio > 70 ? 'High Directness. He isolates clues instantly without circular chatter.' : 'High Friction. He wanders into verbal loops before stumbling onto the rule.'}
              </p>
            </div>
            {/* VISUALIZATION: Logic Streamliner Path */}
            <div className="bg-[#FAFAF6] p-4 rounded-xl border border-[#E5E3DD]/60 space-y-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Thinking Vector Economy</div>
              <div className="relative h-6 w-full bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="absolute top-0 left-0 h-full bg-[#1B3A5C] transition-all"
                  style={{ width: `${data.verdict.speechRatio}%` }}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-slate-600">
                  {data.verdict.speechRatio}% Direct
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                {data.verdict.speechRatio > 70 
                  ? 'Child moves in a straight vector from question conditions to the conceptual shortcut.' 
                  : 'Wastes critical exam seconds backtracking through already discarded equations.'}
              </p>
            </div>
          </div>

        </div>

        {/* ------------------------------------------------------------- */}
        {/* QUESTION 3: THE 9 EXACT MARK LEAKS                           */}
        {/* ------------------------------------------------------------- */}
        <div className="bg-white p-6 rounded-2xl border border-[#E5E3DD] shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">3. When he answers incorrectly, where did he go wrong?</h3>
          <p className="text-sm font-bold font-serif mb-6">Every single error categorized by its exact logical mechanism. Check where the column stacks highest.</p>
          
          {/* VISUALIZATION: Point Leak Filter Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* Category A: Core Rule Failures */}
            <div className="bg-[#FAFAF6] border border-[#E5E3DD] p-4 rounded-xl space-y-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800 border-b border-[#E5E3DD] pb-1">A. Concept Foundation Block</div>
              <div className="space-y-2">
                <div className="text-xs">
                  <div className="flex justify-between mb-1 text-slate-500"><span>Concept Unknown</span> <span>{data.errors.conceptUnknown}</span></div>
                  <div className="w-full bg-slate-200 h-1.5 rounded"><div className="bg-amber-600 h-1.5 rounded" style={{ width: `${totalErrors > 0 ? (data.errors.conceptUnknown / totalErrors) * 100 : 0}%` }} /></div>
                </div>
                <div className="text-xs">
                  <div className="flex justify-between mb-1 text-slate-500"><span>Application Too Layered</span> <span>{data.errors.appTooHard}</span></div>
                  <div className="w-full bg-slate-200 h-1.5 rounded"><div className="bg-amber-600 h-1.5 rounded" style={{ width: `${totalErrors > 0 ? (data.errors.appTooHard / totalErrors) * 100 : 0}%` }} /></div>
                </div>
                <div className="text-xs">
                  <div className="flex justify-between mb-1 text-slate-500"><span>Solution Blindness</span> <span>{data.errors.blindToSolution}</span></div>
                  <div className="w-full bg-slate-200 h-1.5 rounded"><div className="bg-amber-600 h-1.5 rounded" style={{ width: `${totalErrors > 0 ? (data.errors.blindToSolution / totalErrors) * 100 : 0}%` }} /></div>
                </div>
              </div>
            </div>

            {/* Category B: Linguistic Framing Failures */}
            <div className="bg-[#FAFAF6] border border-[#E5E3DD] p-4 rounded-xl space-y-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-[#E5E3DD] pb-1">B. Word Comprehension Block</div>
              <div className="space-y-2">
                <div className="text-xs">
                  <div className="flex justify-between mb-1 text-slate-500"><span>Wording Comprehension</span> <span>{data.errors.wordingComprehension}</span></div>
                  <div className="w-full bg-slate-200 h-1.5 rounded"><div className="bg-slate-700 h-1.5 rounded" style={{ width: `${totalErrors > 0 ? (data.errors.wordingComprehension / totalErrors) * 100 : 0}%` }} /></div>
                </div>
                <div className="text-xs">
                  <div className="flex justify-between mb-1 text-slate-500"><span>Rushed/Simplified Trap</span> <span>{data.errors.misinterpretedSimpler}</span></div>
                  <div className="w-full bg-slate-200 h-1.5 rounded"><div className="bg-slate-700 h-1.5 rounded" style={{ width: `${totalErrors > 0 ? (data.errors.misinterpretedSimpler / totalErrors) * 100 : 0}%` }} /></div>
                </div>
                <div className="text-xs">
                  <div className="flex justify-between mb-1 text-slate-500"><span>Unjustified Assumption</span> <span>{data.errors.unjustifiedAssumption}</span></div>
                  <div className="w-full bg-slate-200 h-1.5 rounded"><div className="bg-slate-700 h-1.5 rounded" style={{ width: `${totalErrors > 0 ? (data.errors.unjustifiedAssumption / totalErrors) * 100 : 0}%` }} /></div>
                </div>
              </div>
            </div>

            {/* Category C: Execution Failures */}
            <div className="bg-[#FAFAF6] border border-[#E5E3DD] p-4 rounded-xl space-y-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-900 border-b border-[#E5E3DD] pb-1">C. Test-Craft Execution</div>
              <div className="space-y-2">
                <div className="text-xs">
                  <div className="flex justify-between mb-1 text-slate-500"><span>Calculation Error</span> <span>{data.errors.calculationError}</span></div>
                  <div className="w-full bg-slate-200 h-1.5 rounded"><div className="bg-[#1B3A5C] h-1.5 rounded" style={{ width: `${totalErrors > 0 ? (data.errors.calculationError / totalErrors) * 100 : 0}%` }} /></div>
                </div>
                <div className="text-xs">
                  <div className="flex justify-between mb-1 text-slate-500"><span>Fell For Intentional Trap</span> <span>{data.errors.intentionalTrap}</span></div>
                  <div className="w-full bg-slate-200 h-1.5 rounded"><div className="bg-[#1B3A5C] h-1.5 rounded" style={{ width: `${totalErrors > 0 ? (data.errors.intentionalTrap / totalErrors) * 100 : 0}%` }} /></div>
                </div>
                <div className="text-xs">
                  <div className="flex justify-between mb-1 text-slate-500"><span>Stopped at Sub-Answer</span> <span>{data.errors.subAnswerStall}</span></div>
                  <div className="w-full bg-slate-200 h-1.5 rounded"><div className="bg-[#1B3A5C] h-1.5 rounded" style={{ width: `${totalErrors > 0 ? (data.errors.subAnswerStall / totalErrors) * 100 : 0}%` }} /></div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* QUESTIONS 4 & 5: ADVANCEMENT altitude & NEXT STEP UP          */}
        {/* ------------------------------------------------------------- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Q4: HOW ADVANCED IS HE REALLY? */}
          <div className="bg-white p-6 rounded-2xl border border-[#E5E3DD] shadow-sm md:col-span-2 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">4. How advanced is he, really?</h3>
              <p className="text-sm font-bold font-serif mb-4">Are we aiming for the right target schools or deluding ourselves?</p>
            </div>
            
            {/* VISUALIZATION: The Conceptual Altitude Ladder */}
            <div className="space-y-2">
              {[4, 3, 2, 1].map((level) => {
                const isCleared = data.verdict.maxACleared >= level && data.verdict.maxLCleared >= level;
                const labelMap = [
                  '', 'Level 1: Basic Worded Math (Run-of-mill Secondary)', 
                  'Level 2: Multistep Constraints (Standard Selective Grammar)', 
                  'Level 3: True Olympiad Logic Shells (Elite Super-Selective)', 
                  'Level 4: Advanced Shifting Vectors (Top Tier Scholarships)'
                ];
                return (
                  <div 
                    key={level}
                    className={`p-3 rounded-xl border text-xs flex justify-between items-center transition-all ${
                      isCleared 
                        ? 'bg-amber-50 border-amber-300 text-amber-950 font-bold' 
                        : 'bg-slate-50 border-slate-200 text-slate-400'
                    }`}
                  >
                    <span>{labelMap[level]}</span>
                    {isCleared ? <CheckCircle2 className="w-4 h-4 text-amber-600" /> : <XCircle className="w-4 h-4 text-slate-300" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Q5: DISTANCE TO NEXT STEP UP */}
          <div className="bg-white p-6 rounded-2xl border border-[#E5E3DD] shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">5. Distance to next tier</h3>
              <p className="text-sm font-bold font-serif mb-4">How far off is he from the next step up?</p>
            </div>
            {/* VISUALIZATION: Frontier Gap Gauge */}
            <div className="bg-[#1B3A5C] text-white p-5 rounded-xl text-center space-y-2">
              <div className="text-[10px] uppercase font-bold tracking-widest text-amber-400">Current Frontier Block</div>
              <div className="text-2xl font-black font-mono">A{Math.min(data.verdict.maxACleared + 1, 4)} — L{Math.min(data.verdict.maxLCleared + 1, 4)}</div>
              <div className="text-[11px] text-slate-300 leading-tight pt-2 border-t border-white/10">
                To bridge this gap, he requires exact text decoding frameworks—not more repetitive arithmetic exercises.
              </div>
            </div>
          </div>

        </div>

        {/* ------------------------------------------------------------- */}
        {/* QUESTIONS 6 & 10: PANIC DISCOVERY & COMPREHENSION WEIGHT      */}
        {/* ------------------------------------------------------------- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Q6: DOES HE PANIC? */}
          <div className="bg-white p-6 rounded-2xl border border-[#E5E3DD] shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">6. Does he panic under pressure?</h3>
              <p className="text-sm font-bold font-serif mb-4 font-serif">
                {data.verdict.panics ? 'Yes. High wording complexity immediately breaks his structural pacing mechanics.' : 'No. His response cadence stays solid regardless of text difficulty.'}
              </p>
            </div>
            {/* VISUALIZATION: Speech Pace Governor Dial */}
            <div className="bg-[#FAFAF6] p-4 rounded-xl border border-[#E5E3DD]/60 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Pacing Cadence Variance</span>
                <span className={`text-xs font-black p-1 rounded uppercase tracking-wider ${data.verdict.panics ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                  {data.verdict.panics ? 'Erratic Shifting' : 'Controlled Cadence'}
                </span>
              </div>
              <div className="w-24 bg-slate-200 rounded-full h-3 overflow-hidden relative">
                <div className={`h-full transition-all ${data.verdict.panics ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: `${data.verdict.pacingVariance}%` }} />
              </div>
            </div>
          </div>

          {/* Q10: CAN HE READ AND UNDERSTAND WRITING? */}
          <div className="bg-white p-6 rounded-2xl border border-[#E5E3DD] shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">10. Can he read and understand complex writing?</h3>
              <p className="text-sm font-bold font-serif mb-4">
                {data.verdict.maxLCleared >= 3 ? 'Yes. Successfully maps text limitations.' : 'No. Easily turned around by hidden exclusions.'}
              </p>
            </div>
            {/* VISUALIZATION: The Riddle Decoder Spotlight */}
            <div className="p-3 bg-[#1B3A5C] text-white rounded-xl text-xs space-y-2 relative overflow-hidden">
              <div className="opacity-40 font-mono text-[9px] uppercase tracking-wider">Linguistic Trap Snapshot:</div>
              <p className="italic text-slate-300">
                "Find the sum of all alternating prime boundaries <span className={`p-0.5 rounded font-bold ${data.verdict.maxLCleared >= 3 ? 'bg-amber-500/30 text-amber-300 line-through' : 'bg-red-500/40 text-white'}`}>except the preceding values</span>..."
              </p>
              <div className="text-[10px] text-amber-400 font-bold uppercase pt-1 border-t border-white/10">
                {data.verdict.maxLCleared >= 3 ? '✓ Caught the exclusion layer' : '✕ Missed the negative boundary constraint'}
              </div>
            </div>
          </div>

        </div>

        {/* ------------------------------------------------------------- */}
        {/* QUESTIONS 7, 8, 9: THE SYSTEM RECOMMENDATIONS & SAFETIES       */}
        {/* ------------------------------------------------------------- */}
        <div className="bg-white border border-[#E5E3DD] rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-[#1B3A5C] text-white p-6">
            <h3 className="text-base font-serif font-bold">7, 8 & 9. Resource & Financial Safety Deployment</h3>
            <p className="text-xs text-slate-300 mt-1">Where to allocate capital and study hours to maximize return on effort.</p>
          </div>
          
          <div className="divide-y divide-[#E5E3DD] text-xs">
            
            {/* Q7: CAN OTHER PLATFORMS HELP? */}
            <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div className="flex items-center gap-2 font-bold text-slate-500 uppercase tracking-wider"><MessageSquare className="w-4 h-4 text-amber-600" /> 7. Other Platforms?</div>
              <div className="md:col-span-2">
                {data.errors.wordingComprehension + data.errors.misinterpretedSimpler > data.errors.calculationError ? (
                  <p className="text-slate-700">
                    <strong className="text-red-700 block mb-0.5">Incompatible.</strong> Generic multiple-choice quiz portals drill rote calculations; they will not fix your child’s speech tracking errors or wordy riddle failures.
                  </p>
                ) : (
                  <p className="text-slate-700">
                    <strong className="text-green-700 block mb-0.5">Compatible.</strong> Basic grid training apps can assist with speeding up his raw execution mechanics.
                  </p>
                )}
              </div>
            </div>

            {/* Q8: CAN A 1-ON-1 TUTOR HELP? */}
            <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div className="flex items-center gap-2 font-bold text-slate-500 uppercase tracking-wider"><UserX className="w-4 h-4 text-amber-600" /> 8. Tutor Leverage?</div>
              <div className="md:col-span-2">
                {data.errors.conceptUnknown + data.errors.calculationError > data.errors.blindToSolution ? (
                  <p className="text-slate-700">
                    <strong className="text-emerald-700 block mb-0.5">High Efficiency.</strong> Your child's core weakness lies in explicit rule voids. A target human tutor can unlock massive score gains by directly teaching the missing calculation formulas.
                  </p>
                ) : (
                  <p className="text-slate-700">
                    <strong className="text-amber-800 block mb-0.5">Low Efficiency Risk.</strong> Your child is failing to see independent logical links. A standard tutor will step in and do the conceptual heavy lifting for them, leaving them helpless on an unseen test.
                  </p>
                )}
              </div>
            </div>

            {/* Q9: IS HE A LOST CAUSE / FINANCIAL GUARDRAIL */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-center bg-amber-50/30">
              <div className="flex items-center gap-2 font-bold text-amber-900 uppercase tracking-wider"><Wallet className="w-4 h-4 text-amber-600" /> 9. Capital Safety Switch</div>
              <div className="md:col-span-2">
                {data.verdict.maxACleared === 1 && data.verdict.maxLCleared === 1 && (data.raw.correct / data.raw.attempted) < 0.3 ? (
                  <div className="border border-red-200 bg-red-50 text-red-950 p-4 rounded-xl">
                    <strong className="block text-sm font-bold mb-1">Recommendation: Shut down the 11+ pipeline and save your money.</strong>
                    The conceptual leap to clearing local competitive selection barriers is tracking outside of a realistic development timeframe. Do not burn thousands on introductory private fees.
                  </div>
                ) : (
                  <div className="border border-emerald-200 bg-emerald-50 text-emerald-950 p-4 rounded-xl">
                    <strong className="block text-sm font-bold mb-1">Verdict: Core logic layers are active. Do not pull funding.</strong>
                    Your child has the natural capacity to clear selection filters. Avoid generic mock exam bundles; invest strictly in resolving the exact text interpretation leaks highlighted in the grid above.
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

      </main>
    </div>
  );
}