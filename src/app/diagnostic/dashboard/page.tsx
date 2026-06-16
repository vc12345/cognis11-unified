'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  LineChart, Line, ScatterChart, Scatter, ZAxis, CartesianGrid,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  PieChart, Pie, Cell, ComposedChart, Legend
} from 'recharts';
import { 
  BrainCircuit, Clock, Target, TrendingUp, AlertTriangle, Zap, 
  Activity, Trophy, Flame, Crosshair, Lock, ShieldAlert
} from 'lucide-react';
import AuthBadge from '../../../components/AuthBadge';

interface AggregatedTelemetry {
  kpis: {
    totalAttempts: number;
    overallAccuracy: number;
    avgSolveTime: number;
    dominantWeakness: string;
    longestStreak: number;
    hesitationPenalty: number;
    mentalStamina: number; 
    velocityScore: string;
  };
  cognitiveProfile: { name: string; count: number; fullDesc: string }[];
  sessionTrends: { sessionName: string; accuracy: number; avgTime: number }[];
  complexityMatrix: { x: number; y: number; z: number; label: string; successRate: number }[];
  interventions: { date: string; concept: string; advice: string }[];
  radarData: { subject: string; accuracy: number; fullMark: number }[];
  fatigueData: { sequence: string; accuracy: number; avgTime: number }[];
  outcomeDistribution: { name: string; value: number }[];
}

const W_CATEGORY_MAP: Record<string, string> = {
  W1: 'Concept Void', W2: 'App Complexity', W3: 'Linguistic Error', W4: 'Pattern Snap',
  W5: 'False Assumption', W6: 'Math/Execution', W7: 'Trap Sprung', W8: 'Memory Overflow'
};

const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b', '#3b82f6', '#f97316', '#ec4899'];

export default function AnalystDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [telemetry, setTelemetry] = useState<AggregatedTelemetry | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // --- DATA AGGREGATION LOOP ---
  async function fetchAndCompileTelemetry(targetUid: string) {
    setLoading(true);
    const { data: attempts, error } = await supabase
      .from('user_attempts')
      .select(`created_at, session_id, is_correct, solve_time, analysis, variants ( al_classification )`)
      .eq('user_id', targetUid)
      .order('created_at', { ascending: true });

    if (error || !attempts || attempts.length === 0) {
      setLoading(false);
      return;
    }

    let correctCount = 0;
    let totalTime = 0;
    let currentStreak = 0;
    let maxStreak = 0;
    
    let correctTimeTotal = 0;
    let incorrectTimeTotal = 0;
    let incorrectCount = 0;

    let lateTestCorrect = 0;
    let lateTestTotal = 0;

    const wCounts: Record<string, number> = { W1: 0, W2: 0, W3: 0, W4: 0, W5: 0, W6: 0, W7: 0, W8: 0 };
    const sessionsMap = new Map<string, { correct: number; total: number; time: number }>();
    const matrixMap = new Map<string, { correct: number; total: number }>();
    const radarMap = new Map<string, { correct: number; total: number }>();
    const sequenceMap = new Map<number, { correct: number; total: number; time: number }>();
    const recentInterventions: any[] = [];

    const sessionGroups: Record<string, any[]> = {};
    attempts.forEach(a => {
      const sid = a.session_id || 'unknown';
      if (!sessionGroups[sid]) sessionGroups[sid] = [];
      sessionGroups[sid].push(a);
    });

    Object.values(sessionGroups).forEach((sessionAttempts) => {
      sessionAttempts.forEach((attempt, index) => {
        const isCorrect = attempt.is_correct;
        const time = attempt.solve_time || 0;
        const al = attempt.variants?.al_classification;

        totalTime += time;
        if (isCorrect) {
          correctCount++;
          currentStreak++;
          maxStreak = Math.max(maxStreak, currentStreak);
          correctTimeTotal += time;
        } else {
          currentStreak = 0;
          incorrectCount++;
          incorrectTimeTotal += time;
        }

        if (index > 13) {
          lateTestTotal++;
          if (isCorrect) lateTestCorrect++;
        }

        const seq = index + 1;
        if (!sequenceMap.has(seq)) sequenceMap.set(seq, { correct: 0, total: 0, time: 0 });
        const seqData = sequenceMap.get(seq)!;
        seqData.total++;
        seqData.time += time;
        if (isCorrect) seqData.correct++;

        if (al) {
          if (!matrixMap.has(al)) matrixMap.set(al, { correct: 0, total: 0 });
          const mData = matrixMap.get(al)!;
          mData.total++;
          if (isCorrect) mData.correct++;

          const aMatch = al.match(/(A\d)/);
          const lMatch = al.match(/(L\d)/);
          if (aMatch) {
            if (!radarMap.has(aMatch[1])) radarMap.set(aMatch[1], { correct: 0, total: 0 });
            radarMap.get(aMatch[1])!.total++;
            if (isCorrect) radarMap.get(aMatch[1])!.correct++;
          }
          if (lMatch) {
            if (!radarMap.has(lMatch[1])) radarMap.set(lMatch[1], { correct: 0, total: 0 });
            radarMap.get(lMatch[1])!.total++;
            if (isCorrect) radarMap.get(lMatch[1])!.correct++;
          }
        }

        const sid = attempt.session_id || 'unknown';
        if (!sessionsMap.has(sid)) sessionsMap.set(sid, { correct: 0, total: 0, time: 0 });
        const sData = sessionsMap.get(sid)!;
        sData.total++;
        sData.time += time;
        if (isCorrect) sData.correct++;

        const analysis = typeof attempt.analysis === 'string' ? JSON.parse(attempt.analysis) : attempt.analysis;
        if (analysis?.w_category_breakdown && !isCorrect) {
          Object.entries(analysis.w_category_breakdown).forEach(([key, val]) => {
            if (val === 1 && wCounts[key] !== undefined) wCounts[key]++;
          });
        }
        if (!isCorrect && analysis?.recommended_intervention) {
          recentInterventions.unshift({
            date: new Date(attempt.created_at).toLocaleDateString(),
            concept: al || 'General',
            advice: analysis.recommended_intervention
          });
        }
      });
    });

    const dominantW = Object.entries(wCounts).reduce((a, b) => a[1] > b[1] ? a : b);
    const avgCorrectTime = correctCount > 0 ? correctTimeTotal / correctCount : 0;
    const avgIncorrectTime = incorrectCount > 0 ? incorrectTimeTotal / incorrectCount : 0;

    const outcomeDistribution = [
      { name: 'Flawless Execution', value: correctCount },
      ...Object.entries(wCounts).filter(([_, count]) => count > 0).map(([key, count]) => ({
        name: W_CATEGORY_MAP[key], value: count
      }))
    ];

    let sessionCounter = 1;
    const sessionTrends = Array.from(sessionsMap.entries()).map(([_, data]) => ({
      sessionName: `S${sessionCounter++}`,
      accuracy: Math.round((data.correct / data.total) * 100),
      avgTime: Math.round(data.time / data.total)
    }));

    const complexityMatrix = Array.from(matrixMap.entries()).map(([al, data]) => {
      const y = parseInt(al.match(/A(\d)/)?.[1] || '0');
      const x = parseInt(al.match(/L(\d)/)?.[1] || '0');
      return { label: al, x, y, z: data.total * 20, successRate: Math.round((data.correct / data.total) * 100) };
    }).filter(d => d.x > 0 && d.y > 0);

    const radarOrder = ['L1', 'L2', 'L3', 'A1', 'A2', 'A3', 'A4'];
    const radarData = radarOrder.map(key => {
      const data = radarMap.get(key) || { correct: 0, total: 1 };
      return { subject: key, accuracy: Math.round((data.correct / (data.total || 1)) * 100), fullMark: 100 };
    });

    const fatigueData = Array.from(sequenceMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([seq, data]) => ({
        sequence: `Q${seq}`,
        accuracy: Math.round((data.correct / data.total) * 100),
        avgTime: Math.round(data.time / data.total)
      }));

    setTelemetry({
      kpis: {
        totalAttempts: attempts.length,
        overallAccuracy: Math.round((correctCount / attempts.length) * 100),
        avgSolveTime: Math.round(totalTime / attempts.length),
        dominantWeakness: dominantW[1] > 0 ? W_CATEGORY_MAP[dominantW[0]] : 'None',
        longestStreak: maxStreak,
        hesitationPenalty: Math.round(avgIncorrectTime - avgCorrectTime),
        mentalStamina: lateTestTotal > 0 ? Math.round((lateTestCorrect / lateTestTotal) * 100) : 0,
        velocityScore: (avgCorrectTime < 25 && correctCount/attempts.length > 0.8) ? 'ELITE' : 'STANDARD'
      },
      cognitiveProfile: [],
      sessionTrends,
      complexityMatrix,
      interventions: recentInterventions.slice(0, 5),
      radarData,
      fatigueData,
      outcomeDistribution
    });
    setLoading(false);
  }

  // --- AUTHENTICATION & CACHE CHECK ---
  useEffect(() => {
    async function verifyUserContext() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_pin')
        .eq('id', user.id)
        .single();
        
      const requiresPin = profile?.user_pin && profile.user_pin !== '000';
      const isSessionUnlocked = sessionStorage.getItem('dashboard_unlocked') === 'true';
      
      if (requiresPin && !isSessionUnlocked) {
        router.push('/profile');
        return;
      }
      
      await fetchAndCompileTelemetry(user.id);
    }
    verifyUserContext();
  }, [router, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-mono text-xs tracking-widest uppercase text-slate-400 animate-pulse">
        Aggregating High-Dimensional Telemetry...
      </div>
    );
  }

  if (!telemetry) {
    return (
      <div className="min-h-screen bg-[#FAFAF6] flex flex-col items-center justify-center font-mono space-y-4">
        <div className="text-xs tracking-widest uppercase text-amber-800 font-bold border border-amber-200 bg-amber-50 px-6 py-4 rounded-xl flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600" /> NO_METRIC_RECORDS_FOUND
        </div>
        <button onClick={() => router.push('/profile')} className="text-[10px] uppercase tracking-widest text-slate-400 hover:text-[#1B3A5C] underline">
          Return to Hub
        </button>
      </div>
    );
  }

  // ============================================================================
  // RENDER COMPLETE PERFORMANCE COMMAND CANVAS
  // ============================================================================
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans p-4 md:p-8 selection:bg-blue-100 pb-24">
      
      {/* HEADER */}
      <header className="max-w-[1400px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <Activity className="text-blue-600 w-8 h-8" />
            Command Center
          </h1>
          <p className="text-xs font-mono uppercase tracking-widest text-slate-400 mt-2">
            Comprehensive Cognitive Profiling Matrix
          </p>
        </div>
        
        <div className="flex flex-col items-end gap-4 w-full md:w-auto">
          <AuthBadge />
          <div className="flex gap-3 w-full md:w-auto">
            <button 
              onClick={() => {
                sessionStorage.removeItem('dashboard_unlocked');
                router.push('/profile'); // Lock and return immediately
              }} 
              className="bg-white border border-slate-200 text-slate-600 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-50 transition shadow-sm flex items-center gap-2"
            >
              <Lock className="w-4 h-4" /> Lock
            </button>
            <button onClick={() => router.push('/profile')} className="flex-1 md:flex-none bg-slate-900 text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition shadow-md">
              Return to Profile Hub
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto space-y-6">
        
        {/* ROW 1: 8-POINT MICRO KPI GRID */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider mb-2 flex items-center gap-1"><Target className="w-3 h-3"/> Accuracy</div>
            <div className="text-2xl font-black text-slate-900">{telemetry.kpis.overallAccuracy}<span className="text-sm text-slate-400">%</span></div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider mb-2 flex items-center gap-1"><TrendingUp className="w-3 h-3"/> Evaluated</div>
            <div className="text-2xl font-black text-slate-900">{telemetry.kpis.totalAttempts}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider mb-2 flex items-center gap-1"><Clock className="w-3 h-3"/> Avg Speed</div>
            <div className="text-2xl font-black text-slate-900">{telemetry.kpis.avgSolveTime}<span className="text-sm text-slate-400">s</span></div>
          </div>
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md flex flex-col justify-between text-white">
            <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider mb-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-400"/> Critical Fault</div>
            <div className="text-lg font-black leading-tight truncate">{telemetry.kpis.dominantWeakness}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider mb-2 flex items-center gap-1"><Trophy className="w-3 h-3 text-amber-500"/> Max Streak</div>
            <div className="text-2xl font-black text-slate-900">{telemetry.kpis.longestStreak}<span className="text-sm text-slate-400">🔥</span></div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between" title="Additional time spent hesitating on incorrect answers vs correct ones.">
            <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider mb-2 flex items-center gap-1"><Crosshair className="w-3 h-3 text-red-500"/> Hesitation</div>
            <div className="text-2xl font-black text-slate-900">{telemetry.kpis.hesitationPenalty > 0 ? '+' : ''}{telemetry.kpis.hesitationPenalty}<span className="text-sm text-slate-400">s</span></div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider mb-2 flex items-center gap-1"><BrainCircuit className="w-3 h-3"/> Stamina</div>
            <div className="text-2xl font-black text-slate-900">{telemetry.kpis.mentalStamina}<span className="text-sm text-slate-400">%</span></div>
          </div>
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-5 rounded-2xl shadow-md flex flex-col justify-between text-white">
            <div className="text-[9px] uppercase font-bold text-blue-200 tracking-wider mb-2 flex items-center gap-1"><Zap className="w-3 h-3"/> Projection</div>
            <div className="text-xl font-black tracking-widest">{telemetry.kpis.velocityScore}</div>
          </div>
        </div>

        {/* ROW 2: PRIMARY CHARTS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm lg:col-span-2">
            <div className="mb-6">
              <h3 className="text-sm font-bold text-slate-900">Cognitive Fatigue & Pacing</h3>
              <p className="text-[11px] text-slate-500 font-medium mt-1">Tracks average time allocation (Bars) against accuracy (Line) as the assessment progresses.</p>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={telemetry.fatigueData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="sequence" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Bar yAxisId="left" dataKey="avgTime" name="Avg Time (s)" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="accuracy" name="Accuracy (%)" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col items-center">
            <div className="w-full mb-2">
              <h3 className="text-sm font-bold text-slate-900">Load Tolerance</h3>
              <p className="text-[11px] text-slate-500 font-medium mt-1">Linguistic vs Application parsing accuracy.</p>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={telemetry.radarData}>
                  <PolarGrid stroke="#f1f5f9" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 'bold' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="Accuracy" dataKey="accuracy" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.4} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* ROW 3: DEEP DIVE MATRIX & OUTCOMES */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm lg:col-span-2">
            <h3 className="text-sm font-bold text-slate-900">Orthogonal Complexity Matrix</h3>
            <p className="text-[11px] text-slate-500 font-medium mt-1 mb-6">X-Axis: Linguistic Complexity | Y-Axis: Application Framework | Bubble Size: Exposure Volume</p>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 20, bottom: 0, left: -25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="x" type="number" domain={[0, 4]} ticks={[1,2,3]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis dataKey="y" type="number" domain={[0, 5]} ticks={[1,2,3,4]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <ZAxis dataKey="z" type="number" range={[50, 400]} />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl text-white font-sans text-xs">
                            <p className="font-bold mb-1 text-blue-400">Blueprint: {data.label}</p>
                            <p>Success Rate: {data.successRate}%</p>
                            <p className="text-slate-400">Sample Volume: {data.z / 20}</p>
                          </div>
                        );
                      }
                      return null;
                    }} 
                  />
                  <Scatter data={telemetry.complexityMatrix} fill="#3b82f6" fillOpacity={0.6} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-6">Behavioral Outcome Spread</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={telemetry.outcomeDistribution || []}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {telemetry.outcomeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* ROW 4: AI TUTOR FEED */}
        <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-6">
            <Flame className="w-5 h-5 text-orange-500" />
            Active Micro-Interventions (Tutor Directives)
          </h3>
          
          {telemetry.interventions.length === 0 ? (
            <div className="py-12 flex items-center justify-center text-sm text-slate-400 italic">
              No corrective interventions logged yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {telemetry.interventions.map((log, idx) => (
                <div key={idx} className="p-5 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-white hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-100/50 px-3 py-1.5 rounded-lg uppercase tracking-widest border border-blue-200/50">
                      Target: {log.concept}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">{log.date}</span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed font-medium">
                    "{log.advice}"
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}