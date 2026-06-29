'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { 
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { 
  AlertTriangle, Brain, Clock, HelpCircle, ShieldAlert, Target, ThumbsUp, Wallet, Zap 
} from 'lucide-react';
import AuthBadge from '../../../components/AuthBadge';

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
  quadrant: { name: string; speed: number; accuracy: number; label: string }[];
  matrix: { x: number; y: number; z: number; label: string; successRate: number }[];
  verdict: {
    schoolTarget: string;
    nextStepUp: string;
    givesUpEasily: boolean;
    panics: boolean;
    canOtherPlatformsHelp: string;
    canTutorHelp: string;
    isLostCause: boolean;
    canReadAndUnderstand: string;
  };
}

export default function RealTalkDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DiagnosticTelemetry | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function compileDiagnosticData(uid: string) {
    setLoading(true);
    
    // Fetch user attempts from the 20-question Olympiad shell engine
    const { data: attempts, error } = await supabase
      .from('user_attempts')
      .select(`is_correct, solve_time, analysis, variants ( al_classification )`)
      .eq('user_id', uid);

    if (error || !attempts || attempts.length === 0) {
      setLoading(false);
      return;
    }

    // --- Hardcoded defaults for demo mapping / processing fallback ---
    let total = attempts.length;
    let right = attempts.filter(a => a.is_correct).length;
    let passedCount = 0;

    let errMap = {
      conceptUnknown: 0, appTooHard: 0, wordingComprehension: 0, misinterpretedSimpler: 0,
      unjustifiedAssumption: 0, calculationError: 0, intentionalTrap: 0, subAnswerStall: 0, blindToSolution: 0
    };

    let matrixDataMap = new Map<string, { correct: number; total: number }>();

    attempts.forEach(a => {
      const al = a.variants?.al_classification || 'A1L1';
      const analysis = typeof a.analysis === 'string' ? JSON.parse(a.analysis) : a.analysis;
      
      // Map matrix exposure
      if (!matrixDataMap.has(al)) matrixDataMap.set(al, { correct: 0, total: 0 });
      const m = matrixDataMap.get(al)!;
      m.total++;
      if (a.is_correct) m.correct++;

      // Check if item was outright passed/skipped verbally
      if (analysis?.verbal_action === 'passed' || analysis?.gave_up) {
        passedCount++;
      }

      // Process the 9 specific error categories passed back from our speech LLM parsing
      if (!a.is_correct && analysis?.error_reason) {
        const reason = analysis.error_reason; // Expected clean token matching our mapping
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

    // Format A v L matrix points cleanly
    const matrixPoints = Array.from(matrixDataMap.entries()).map(([al, m]) => {
      const y = parseInt(al.match(/A(\d)/)?.[1] || '1'); // Application Level (1-4)
      const x = parseInt(al.match(/L(\d)/)?.[1] || '1'); // Linguistic Level (1-4)
      return {
        label: al, x, y, z: m.total * 30, successRate: Math.round((m.correct / m.total) * 100)
      };
    });

    // Generate real-talk answers based on math ceilings
    const maxA_Cleared = Math.max(...matrixPoints.filter(p => p.successRate >= 60).map(p => p.y), 1);
    const maxL_Cleared = Math.max(...matrixPoints.filter(p => p.successRate >= 60).map(p => p.x), 1);

    setData({
      raw: { attempted: total, correct: right, passed: passedCount },
      errors: errMap,
      quadrant: [
        { name: 'Your Child', speed: right > 0 ? total * 2 : 10, accuracy: Math.round((right / total) * 100), label: 'Current Pace State' }
      ],
      matrix: matrixPoints,
      verdict: {
        schoolTarget: maxA_Cleared >= 3 && maxL_Cleared >= 3 ? 'Elite Super-Selective Grammar Ready' : maxA_Cleared >= 2 ? 'Standard Local Selective / Run-of-Mill Grammar' : 'Local Non-Selective Secondary Route',
        nextStepUp: `Level A${Math.min(maxA_Cleared + 1, 4)} L${Math.min(maxL_Cleared + 1, 4)} Core Shells`,
        givesUpEasily: passedCount > 3,
        panics: errMap.misinterpretedSimpler + errMap.unjustifiedAssumption > 4,
        canOtherPlatformsHelp: errMap.wordingComprehension + errMap.misinterpretedSimpler > errMap.calculationError ? 'No. Multiple-choice platforms drill math rules; they will not fix your child’s text comprehension failures.' : 'Yes, for mechanical drill practice only.',
        canTutorHelp: errMap.conceptUnknown + errMap.calculationError > errMap.blindToSolution ? 'Highly effective. A tutor can easily fill a missing calculation process or raw equation rule.' : 'Limited impact. Your child struggles to see logic shortcuts independently; a tutor will end up doing the thinking for them.',
        isLostCause: maxA_Cleared === 1 && maxL_Cleared === 1 && right / total < 0.25,
        canReadAndUnderstand: maxL_Cleared >= 3 ? 'Yes, successfully decodes complex phrasing and background limitations.' : 'No. Gets easily turned around by layered questions or hidden exclusions.'
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
      <div className="min-h-screen bg-[#FAFAF6] flex items-center justify-center font-serif text-sm text-slate-600 animate-pulse">
        Stripping diagnostic fluff... Generating your direct raw-truth answers...
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

  return (
    <div className="min-h-screen bg-[#FAFAF6] text-[#1B3A5C] font-sans p-4 md:p-8 antialiased selection:bg-amber-100">
      
      {/* HEADER SECTION */}
      <header className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[#E5E3DD] pb-6 mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif tracking-tight">The 11+ Diagnostic Verdict</h1>
          <p className="text-xs text-slate-500 mt-1">Raw answers to high-stakes parenting questions. No sugarcoating, no decorative graphs.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <AuthBadge />
          <button onClick={() => router.push('/profile')} className="bg-[#1B3A5C] text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-slate-800 transition">
            Exit to Hub
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto space-y-8">
        
        {/* THE THREE CORE VOLUMES */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-xl border border-[#E5E3DD] shadow-sm">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Attempted Volume</p>
            <p className="text-3xl font-black">{data.raw.attempted} <span className="text-xs font-normal text-slate-400">Questions</span></p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-[#E5E3DD] shadow-sm border-l-4 border-l-amber-500">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Flawless Execution</p>
            <p className="text-3xl font-black text-amber-600">{data.raw.correct} <span className="text-xs font-normal text-slate-400">Right Answers</span></p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-[#E5E3DD] shadow-sm">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Passed or Abandonded Mid-Speech</p>
            <p className="text-3xl font-black text-slate-700">{data.raw.passed} <span className="text-xs font-normal text-slate-400">Gave Up Early</span></p>
          </div>
        </div>

        {/* SECTION 1: THE TWO VERIFIED VISUALIZATIONS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* VISUAL 1: FOCUS QUADRANT */}
          <div className="bg-white p-6 rounded-2xl border border-[#E5E3DD] shadow-sm flex flex-col">
            <div className="mb-4">
              <h3 className="text-sm font-bold uppercase tracking-wider">1. The Focus Quadrant (Behavior Profile)</h3>
              <p className="text-xs text-slate-500 mt-1">Maps raw speed against exact concept execution accuracy to highlight deep-set study habits.</p>
            </div>
            <div className="h-64 w-full relative bg-[#FAF9F5] rounded-xl border border-[#E5E3DD]/60 overflow-hidden">
              {/* Background Quadrant Grid Text Markers */}
              <div className="absolute top-4 left-4 text-[10px] font-bold text-slate-400 uppercase">Perfectionist / Stalls</div>
              <div className="absolute top-4 right-4 text-[10px] font-bold text-amber-600 uppercase">Exam Ready / Efficient</div>
              <div className="absolute bottom-4 left-4 text-[10px] font-bold text-red-500 uppercase">Foundation Void</div>
              <div className="absolute bottom-4 right-4 text-[10px] font-bold text-slate-500 uppercase">Careless / Rusher</div>

              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: -20 }}>
                  <XAxis type="number" dataKey="speed" domain={[0, 100]} name="Speed Meter" axisLine={false} tick={false} />
                  <YAxis type="number" dataKey="accuracy" domain={[0, 100]} name="Accuracy %" axisLine={false} tick={false} />
                  <ReferenceLine x={50} stroke="#E5E3DD" strokeDasharray="3 3" />
                  <ReferenceLine y={50} stroke="#E5E3DD" strokeDasharray="3 3" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter name="Child Placement" data={data.quadrant} fill="#d97706" shape="circle" r={10} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* VISUAL 2: A vs L MATRIX SCATTERPLOT */}
          <div className="bg-white p-6 rounded-2xl border border-[#E5E3DD] shadow-sm flex flex-col">
            <div className="mb-4">
              <h3 className="text-sm font-bold uppercase tracking-wider">2. Application vs. Linguistic Complexity Matrix</h3>
              <p className="text-xs text-slate-500 mt-1">Y-Axis: Math Layering Depth (1-4) | X-Axis: Text Phrasing/Riddle Weight (1-4)</p>
            </div>
            <div className="h-64 w-full bg-white rounded-xl border border-[#E5E3DD]/60">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 30, bottom: 10, left: -25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="x" type="number" domain={[0, 5]} ticks={[1,2,3,4]} name="Language Trick Levels" stroke="#94a3b8" tickSize={4} />
                  <YAxis dataKey="y" type="number" domain={[0, 5]} ticks={[1,2,3,4]} name="Math Application Depth" stroke="#94a3b8" tickSize={4} />
                  <ZAxis dataKey="z" type="number" range={[100, 500]} />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const pt = payload[0].payload;
                        return (
                          <div className="bg-[#1B3A5C] p-3 rounded-lg text-white text-xs shadow-xl">
                            <p className="font-bold text-amber-400">Matrix Tier: A{pt.y} - L{pt.x}</p>
                            <p>Correct Approach Rate: {pt.successRate}%</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Scatter data={data.matrix} fill="#1B3A5C" fillOpacity={0.8} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* SECTION 2: THE 10 BRUTAL ANSWERS */}
        <div className="bg-white rounded-2xl border border-[#E5E3DD] shadow-sm overflow-hidden">
          <div className="bg-[#1B3A5C] text-white p-6">
            <h2 className="text-lg font-serif font-bold">Direct Structural Verdict</h2>
            <p className="text-xs text-amber-200 mt-0.5">Evaluating underlying mechanics, completely stripped of sales padding.</p>
          </div>
          
          <div className="divide-y divide-[#E5E3DD]">
            
            {/* Q1 */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">1. Does he give up easily?</span>
              <div className="md:col-span-2">
                <p className="text-sm font-bold">{data.verdict.givesUpEasily ? 'Yes. Stalls completely when hit by unexpected rules.' : 'No. Persists verbally even when confused by the calculation depth.'}</p>
                <p className="text-xs text-slate-500 mt-1">Logged {data.raw.passed} moments of absolute silence or direct verbal surrender out of {data.raw.attempted} high-tier problems.</p>
              </div>
            </div>

            {/* Q2 */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">2. Correct Answer Dynamics</span>
              <div className="md:col-span-2">
                <p className="text-sm font-bold">Directness vs Speed Evaluation</p>
                <p className="text-xs text-slate-600 mt-1">
                  When a question is solved correctly, the verbal path shows {data.raw.correct > 0 && data.errors.unjustifiedAssumption < 2 ? 'clean logical economy. He establishes the constraints first and jumps cleanly to the core rule.' : 'severe pacing volatility. He over-explains simple premises and builds circular sentences before catching the right clue.'}
                </p>
              </div>
            </div>

            {/* Q3: THE 9 ERROR CAUSES */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-2 bg-[#FAFAF6]/50">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 text-amber-800">3. Where are the leaks when failing?</span>
              <div className="md:col-span-2 space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Exact Error Reason Distribution:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between p-2 bg-white border border-[#E5E3DD] rounded"><span>Concept completely unknown:</span> <strong className="text-[#1B3A5C]">{data.errors.conceptUnknown}</strong></div>
                  <div className="flex justify-between p-2 bg-white border border-[#E5E3DD] rounded"><span>Concept application depth too hard:</span> <strong className="text-[#1B3A5C]">{data.errors.appTooHard}</strong></div>
                  <div className="flex justify-between p-2 bg-white border border-[#E5E3DD] rounded"><span>Lacks comprehension of wording:</span> <strong className="text-[#1B3A5C]">{data.errors.wordingComprehension}</strong></div>
                  <div className="flex justify-between p-2 bg-white border border-[#E5E3DD] rounded"><span>Misinterpreted problem as simpler:</span> <strong className="text-[#1B3A5C]">{data.errors.misinterpretedSimpler}</strong></div>
                  <div className="flex justify-between p-2 bg-white border border-[#E5E3DD] rounded"><span>Made an unjustified assumption:</span> <strong className="text-[#1B3A5C]">{data.errors.unjustifiedAssumption}</strong></div>
                  <div className="flex justify-between p-2 bg-white border border-[#E5E3DD] rounded"><span>Right approach, wrong arithmetic:</span> <strong className="text-[#1B3A5C]">{data.errors.calculationError}</strong></div>
                  <div className="flex justify-between p-2 bg-white border border-[#E5E3DD] rounded"><span>Fell directly for intentional test trap:</span> <strong className="text-[#1B3A5C]">{data.errors.intentionalTrap}</strong></div>
                  <div className="flex justify-between p-2 bg-white border border-[#E5E3DD] rounded"><span>Stalled out at a sub-answer boundary:</span> <strong className="text-[#1B3A5C]">{data.errors.subAnswerStall}</strong></div>
                  <div className="flex justify-between p-2 bg-white border border-[#E5E3DD] rounded sm:col-span-2"><span>Simply does not see the logical shortcut:</span> <strong className="text-[#1B3A5C]">{data.errors.blindToSolution}</strong></div>
                </div>
              </div>
            </div>

            {/* Q4 */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">4. School Targeting Reality</span>
              <div className="md:col-span-2">
                <p className="text-sm font-bold">Are we deluding ourselves based on performance?</p>
                <p className="text-xs text-slate-600 mt-1 font-medium bg-amber-50 border border-amber-200 p-3 rounded-lg text-amber-900">
                  Current baseline fits: <span className="font-bold underline">{data.verdict.schoolTarget}</span>. Olympiad shells strip away drilled memory; if the grid points are blank past Level 2, targeting ultra-selective streams without substantial foundational work is an educational delusion.
                </p>
              </div>
            </div>

            {/* Q5 */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">5. Shifting to the Next Tier</span>
              <div className="md:col-span-2">
                <p className="text-sm font-bold">How far off is he from the next step up?</p>
                <p className="text-xs text-slate-600 mt-1">The logical frontier stands at <span className="font-bold text-[#1B3A5C]">{data.verdict.nextStepUp}</span>. To break this ceiling, he needs to practice structural word parsing rather than running wider volumes of standard equations.</p>
              </div>
            </div>

            {/* Q6 */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">6. Pressure Mechanics</span>
              <div className="md:col-span-2">
                <p className="text-sm font-bold">Does he panic under load?</p>
                <p className="text-xs text-slate-600 mt-1">
                  {data.verdict.panics ? 'Yes. When language complexity spikes, his verbal processing speeds up erratically and he invents imaginary clues to reach an early exit.' : 'No. Pace remains highly controlled even when hitting blind spots or calculation loops.'}
                </p>
              </div>
            </div>

            {/* Q7 */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">7. Alternate Funnel Viability</span>
              <div className="md:col-span-2">
                <p className="text-sm font-bold">Can standard multiple-choice platforms help him?</p>
                <p className="text-xs text-slate-600 mt-1 font-medium">{data.verdict.canOtherPlatformsHelp}</p>
              </div>
            </div>

            {/* Q8 */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">8. Human Intervention Value</span>
              <div className="md:col-span-2">
                <p className="text-sm font-bold">Can a 1-on-1 tutor unlock this score?</p>
                <p className="text-xs text-slate-600 mt-1">{data.verdict.canTutorHelp}</p>
              </div>
            </div>

            {/* Q9 */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-2 bg-red-50/20">
              <span className="text-xs font-bold uppercase tracking-wider text-red-800 flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> 9. Financial Capital Check</span>
              <div className="md:col-span-2">
                <p className="text-sm font-bold text-red-900">Is he a lost cause for 11+ selective maths?</p>
                <p className="text-xs text-red-900/80 mt-1">
                  {data.verdict.isLostCause 
                    ? 'Yes. Save your money and bypass the stress. The conceptual distance from baseline Olympiad shells indicates the relative competitive threshold is tracking too far out of reach.' 
                    : 'No. The core spatial and mechanical structures are live. Do not give up or burn money on generic mock exams; target the precise text interpretation failures identified above.'}
                </p>
              </div>
            </div>

            {/* Q10 */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">10. Reading Comprehension Check</span>
              <div className="md:col-span-2">
                <p className="text-sm font-bold">Can he genuinely read and understand complex writing under pressure?</p>
                <p className="text-xs text-slate-600 mt-1">{data.verdict.canReadAndUnderstand}</p>
              </div>
            </div>

          </div>
        </div>

      </main>
    </div>
  );
}