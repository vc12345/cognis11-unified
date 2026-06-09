'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

// --- SUB-COMPONENT: LOAD-RESPONSE PROFILE ---
// Maps Cognitive Load (Complexity + Weight) vs. Processing Time
function LoadResponseProfile({ attempts }: { attempts: any[] }) {
  const padding = 40;
  const width = 450;
  const height = 300;
  const TIME_CEILING = 300; // 5 minutes max for visualization

  const normalizeLevel = (val: any) => {
    if (!val) return 0;
    const num = parseInt(val.toString().replace(/\D/g, ''));
    return isNaN(num) ? 0 : num;
  };

  const points = useMemo(() => {
    if (attempts.length === 0) return [];
    
    // We calculate maxTime based on capped values so the scale stays useful
    const maxTimeOnChart = Math.max(
      ...attempts.map(a => Math.min(a.duration_seconds || 0, TIME_CEILING)), 
      60 // Ensure at least a 60s scale
    );

    const maxLoad = Math.max(...attempts.map(a => 
      (normalizeLevel(a.questions?.application_level) + normalizeLevel(a.questions?.linguistic_level) + (a.concept_weight || 1))
    ), 1);

    return attempts.map((a, i) => {
      const q = a.questions || {};
      const load = normalizeLevel(q.application_level) + normalizeLevel(q.linguistic_level) + (a.concept_weight || 1);
      
      // CLAMP THE TIME: If it's 5000s, it becomes 300s for the chart
      const rawTime = a.duration_seconds || 0;
      const displayTime = Math.min(rawTime, TIME_CEILING);

      const x = padding + ((load / maxLoad) * (width - padding * 2));
      const y = height - padding - ((displayTime / maxTimeOnChart) * (height - padding * 2));
      
      return { 
        x, y, 
        is_correct: a.is_correct, 
        load, 
        time: rawTime, // Keep raw time for tooltips if needed
        is_capped: rawTime > TIME_CEILING,
        id: i, 
        is_vtt: a.is_vtt 
      };
    });
  }, [attempts]);

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm h-full">
      <div className="mb-6">
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-bold text-slate-800 tracking-tight">Load-Response Profile</h3>
          {attempts.some(a => a.duration_seconds > TIME_CEILING) && (
            <span className="text-[8px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">
              Outliers Clamped
            </span>
          )}
        </div>
        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Processing Time vs. Cognitive Load</p>
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
          {/* Axis Lines */}
          <line x1={padding} y1={height-padding} x2={width-padding} y2={height-padding} stroke="#e2e8f0" strokeWidth="2" />
          <line x1={padding} y1={padding} x2={padding} y2={height-padding} stroke="#e2e8f0" strokeWidth="2" />
          
          {/* Axis Labels */}
          <text x={width/2} y={height-5} textAnchor="middle" className="text-[9px] fill-slate-400 font-black uppercase">Cognitive Load</text>
          <text x={10} y={height/2} textAnchor="middle" transform={`rotate(-90, 10, ${height/2})`} className="text-[9px] fill-slate-400 font-black uppercase">Time (s)</text>

          {/* Points */}
          {points.map(p => (
            <circle 
              key={p.id} 
              cx={p.x} 
              cy={p.y} 
              r={p.is_capped ? "4" : "6"} // Smaller dots for outliers pegged at the top
              className={`${p.is_correct ? 'fill-emerald-400' : 'fill-red-400'} 
                         ${p.is_vtt ? 'stroke-blue-400 stroke-2' : ''} 
                         ${p.is_capped ? 'opacity-40' : 'opacity-80'} transition-all`}
            />
          ))}
        </svg>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full border-2 border-blue-400"></div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Voice</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-400 opacity-40"></div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Time Outlier</span>
          </div>
        </div>
        <p className="text-[10px] text-slate-400 leading-relaxed italic">
          Points are clamped at 300s to maintain chart legibility. A high concentration of points near the top indicates a "Cognitive Ceiling" where the logic load exceeds the current processing capacity.
        </p>
      </div>
    </div>
  );
}

// --- MAIN PAGE COMPONENT ---
export default function ResultsPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const router = useRouter();

  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFrame, setTimeFrame] = useState('all'); 
  const [summary, setSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);

  const normalizeLevel = (val: any) => {
    if (!val) return 0;
    const num = parseInt(val.toString().replace(/\D/g, ''));
    return isNaN(num) ? 0 : num;
  };

  const generateMetaSummary = useCallback(async (data: any[]) => {
    const inferenceList = data
      .filter(a => a.analysis?.inference_on_student_logic)
      .map(a => a.analysis.inference_on_student_logic);

    if (inferenceList.length < 3) return; 

    setSummaryLoading(true);
    try {
      const res = await fetch('/api/get-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inferences: inferenceList })
      });
      const result = await res.json();
      setSummary(result.summary);
    } catch (err) {
      console.error("Summary generation failed:", err);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      let query = supabase
        .from('user_attempts')
        .select(`
          is_correct,
          logic_tag,
          created_at,
          analysis,
          duration_seconds,
          is_vtt,
          questions (
            application_level, 
            linguistic_level
          )
        `)
        .eq('user_id', user.id);

      if (timeFrame !== 'all') {
        const days = timeFrame === '7d' ? 7 : 30;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        query = query.gte('created_at', cutoff.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error("❌ Database Error:", error);
      } else if (data) {
        setAttempts(data);
        if (data.length >= 3) {
          generateMetaSummary(data);
        }
      }
      setLoading(false);
    };

    fetchResults();
  }, [timeFrame, router, supabase, generateMetaSummary]);

  const getCellStats = (appLvl: number, lingLvl: number) => {
    const cellAttempts = attempts.filter(a => {
      const q = a.questions; 
      if (!q) return false;
      return normalizeLevel(q.application_level) === appLvl && 
             normalizeLevel(q.linguistic_level) === lingLvl;
    });
    
    if (cellAttempts.length === 0) return null;
    const incorrect = cellAttempts.filter(a => !a.is_correct);
    const errorRate = (incorrect.length / cellAttempts.length) * 100;
    const tags = incorrect.map(a => a.logic_tag).filter(Boolean);
    const primaryTag = tags.length > 0 ? tags.sort((a,b) =>
      tags.filter(v => v===a).length - tags.filter(v => v===b).length
    ).pop() : null;

    return { errorRate, primaryTag, total: cellAttempts.length };
  };

  const tagBreakdown = attempts.reduce((acc: any, curr) => {
    if (!curr.is_correct) {
      acc[curr.logic_tag] = (acc[curr.logic_tag] || 0) + 1;
    }
    return acc;
  }, {});

  if (loading) return <div className="p-10 text-center text-slate-400 animate-pulse">Running Diagnostic Analysis...</div>;

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER & FILTERS */}
        <header className="mb-12 md:flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Diagnostic Snapshot</h1>
            <p className="text-slate-500 mt-2 text-lg italic">Inferential analysis of cognitive patterns.</p>
          </div>
          
          <div className="mt-6 md:mt-0 flex gap-2 bg-slate-200 p-1 rounded-xl">
            {[
              { id: 'all', label: 'All Time' },
              { id: '30d', label: 'Last 30 Days' },
              { id: '7d', label: 'Last 7 Days' }
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setTimeFrame(btn.id)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  timeFrame === btn.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </header>

        <div className="flex flex-col gap-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            
            {/* 1. THE HEATMAP (SKILL MATRIX) */}
            <div className="lg:col-span-2 bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-200">
               <div className="flex h-[400px]">
                  <div className="flex flex-col justify-between text-[11px] font-black text-slate-400 uppercase py-6 pr-6 border-r border-slate-100">
                      <span className="text-red-400">High App</span>
                      <span className="rotate-180 [writing-mode:vertical-lr] tracking-widest text-slate-300">Application</span>
                      <span>Low App</span>
                  </div>
                  <div className="flex-1 grid grid-cols-3 grid-rows-3 gap-4 pl-6">
                    {[3, 2, 1].map((appLvl) => (
                      [1, 2, 3].map((lingLvl) => {
                        const stats = getCellStats(appLvl, lingLvl);
                        const mastery = stats ? Math.round(100 - stats.errorRate) : 0;
                        return (
                          <div 
                            key={`${appLvl}-${lingLvl}`} 
                            className={`rounded-3xl flex flex-col items-center justify-center border-2 transition-all
                              ${!stats ? 'bg-slate-50 border-slate-100 opacity-40' : 
                                mastery < 50 ? 'bg-red-50 border-red-200' : 
                                mastery < 100 ? 'bg-orange-50 border-orange-200' : 'bg-emerald-50 border-emerald-200'}`}
                          >
                            {stats ? (
                              <>
                                <span className="text-2xl font-black text-slate-800">{mastery}%</span>
                                <span className="text-[9px] text-slate-400 font-bold uppercase">{stats.total} Tries</span>
                              </>
                            ) : (
                              <span className="text-[9px] font-bold text-slate-300 uppercase">No Data</span>
                            )}
                          </div>
                        );
                      })
                    ))}
                  </div>
               </div>
               <div className="grid grid-cols-3 mt-8 ml-20 text-center text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  <span>Direct</span>
                  <span className="text-slate-300">Complexity</span>
                  <span className="text-red-400">Dense</span>
               </div>
            </div>

            {/* 2. LOAD-RESPONSE PROFILE */}
            <div className="lg:col-span-1">
               <LoadResponseProfile attempts={attempts} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* 3. SENIOR TUTOR REPORT */}
            <div className="lg:col-span-2">
              <section className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 overflow-hidden h-full">
                <div className="bg-slate-900 px-10 py-6 flex justify-between items-center">
                    <div>
                      <h2 className="text-white font-bold text-xl tracking-tight">Senior Tutor’s Meta-Analysis</h2>
                      <p className="text-slate-400 text-xs uppercase tracking-widest mt-1">Cognitive Profile Analysis</p>
                    </div>
                    <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center border border-white/20 text-blue-400 font-serif italic text-2xl">
                    &
                    </div>
                </div>
                
                <div className="p-10 md:p-16 relative">
                    {summaryLoading ? (
                      <div className="space-y-6 animate-pulse">
                          <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                          <div className="h-4 bg-slate-100 rounded w-5/6"></div>
                          <div className="h-4 bg-slate-100 rounded w-2/3"></div>
                      </div>
                    ) : summary ? (
                      <div className="prose prose-slate max-w-none">
                          <div className="text-slate-700 text-lg leading-relaxed whitespace-pre-wrap font-serif italic">
                            {summary}
                          </div>
                          <div className="mt-12 pt-8 border-t border-slate-100 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500">ST</div>
                            <div>
                                <p className="text-sm font-bold text-slate-900">Head of Diagnostics</p>
                                <p className="text-xs text-slate-400 uppercase tracking-widest">Automated Insight Engine</p>
                            </div>
                          </div>
                      </div>
                    ) : (
                      <div className="text-center py-20">
                          <p className="text-slate-400 italic">Please complete at least 3 challenges to allow the Senior Tutor to generate a cognitive profile.</p>
                      </div>
                    )}
                </div>
              </section>
            </div>

            {/* 4. SIDEBAR ERROR BREAKDOWN */}
            <div className="lg:col-span-1 flex flex-col gap-6">
              <div className="bg-slate-900 text-white p-8 rounded-[2rem] shadow-xl">
                <h2 className="text-xl font-bold mb-6 text-blue-400 flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                  Error Breakdown
                </h2>
                <div className="space-y-5">
                  {Object.entries(tagBreakdown).length > 0 ? (
                    Object.entries(tagBreakdown).map(([tag, count]) => (
                      <div key={tag} className="flex items-center justify-between">
                        <span className="text-slate-400 text-sm">
                          {tag === 'E' ? 'Execution Slips' : 
                           tag === 'C' ? 'Concept Gaps' : 
                           tag === 'L' ? 'Language Block' : 
                           tag === 'T' ? 'Transfer Difficulty' : 'Other'}
                        </span>
                        <span className="bg-slate-800 px-4 py-1.5 rounded-xl font-mono font-bold text-blue-300 border border-slate-700">
                          {count as number}
                        </span>
                      </div>
                    ))
                  ) : <p className="text-slate-500 italic text-sm text-center py-4">No errors detected in this period.</p>}
                </div>
              </div>
              
              <div className="bg-blue-600 text-white p-8 rounded-[2rem] shadow-lg">
                <h3 className="font-bold text-lg mb-2">Next Step</h3>
                <p className="text-blue-100 text-sm leading-relaxed">
                  Focus on bridging the gap between your verbal reasoning and written execution. Your Load-Response profile shows high stamina but inconsistent checking.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}