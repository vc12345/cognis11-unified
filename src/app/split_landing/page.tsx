'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight, Brain, Sparkles, Target, Layers, Network, Activity, Crosshair } from 'lucide-react';

export default function SplitLandingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-blue-200">
      
      {/* ======================================================== */}
      {/* THE MISSION BAR: THE OBJECTIVE REALITY                     */}
      {/* ======================================================== */}
      <header className="w-full bg-white border-b border-slate-200 px-6 py-16 md:py-20 flex flex-col items-center text-center relative z-20 shadow-[0_4px_24px_-12px_rgba(0,0,0,0.08)]">
        <div className="inline-flex items-center gap-3 mb-8">
          <div className="p-2.5 bg-slate-900 rounded-xl shadow-md">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl md:text-2xl font-black tracking-[0.25em] text-slate-900">COGNIS11</span>
        </div>
        
        <h2 className="text-3xl md:text-4xl font-medium text-slate-900 max-w-4xl leading-[1.2] tracking-tight mb-6">
          Cognitive infrastructure for the 11+ timeline.
        </h2>
        
        <p className="text-base md:text-lg text-slate-500 max-w-3xl leading-relaxed">
          Mass-market platforms measure "Right vs. Wrong" and prescribe more volume. We measure the underlying cognitive mechanics and prescribe understanding. Whether you are laying a multi-year foundation, or mapping high-ROI interventions in the final 6 months.
        </p>
      </header>

      {/* ======================================================== */}
      {/* THE SPLIT SCREEN: THE TWO PHASES                           */}
      {/* ======================================================== */}
      <main className="flex-1 flex flex-col md:flex-row relative">

        {/* Absolute Center Divider Badge (Desktop Only) */}
        <div className="hidden md:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 items-center justify-center bg-white border border-slate-200 w-12 h-12 rounded-full shadow-lg">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">OR</span>
        </div>

        {/* --- LEFT SIDE: PRE-PREP (CONCEPT ELABORATION) --- */}
        <div className="flex-1 bg-[#FAF9F6] relative group flex flex-col justify-center px-8 md:px-16 lg:px-24 py-20 transition-colors hover:bg-[#F2F0EA]">
          <div className="max-w-lg w-full mx-auto md:mx-0 md:ml-auto md:mr-16">
            
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100/80 text-amber-800 text-[10px] font-bold uppercase tracking-widest mb-6 border border-amber-200">
              <Sparkles className="w-3 h-3" />
              Years 2 — 5
            </div>

            <h1 className="text-4xl md:text-5xl font-medium tracking-tight text-slate-900 mb-6 leading-[1.1]">
              Concept Introduction <br/><span className="text-amber-700 italic font-serif">& Elaboration.</span>
            </h1>
            
            <p className="text-base text-slate-600 leading-relaxed mb-8">
              A cohesive 4-year conceptual runway. Instead of waiting for a topic to confuse your child in class, use our parent-led scripts to confidently introduce and elaborate on the core logic behind the math. 
            </p>

            <div className="space-y-5 mb-12">
              <div className="flex items-start gap-3">
                <Layers className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-900 font-bold">Two Distinct Tiers of Depth</p>
                  <p className="text-xs text-slate-500 mt-1">Structured cleanly into <strong>Foundational</strong> (Early Introduction, Y2-4) and <strong>Supplemental</strong> (Advanced Elaboration, Y4-5).</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Network className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-900 font-bold">Open Access Curriculum</p>
                  <p className="text-xs text-slate-500 mt-1">A pay-what-you-want model. We provide the 10-minute scripts and interactive tools; you guide the breakthrough.</p>
                </div>
              </div>
            </div>

            <button 
              onClick={() => router.push('/register?intent=course')}
              className="group/btn flex items-center gap-3 bg-slate-900 text-white px-8 py-4 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-amber-900 transition-all w-fit shadow-lg shadow-amber-900/10"
            >
              Explore the Curriculum
              <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* --- RIGHT SIDE: DIAGNOSTIC (CODIFIED BASELINING) --- */}
        <div className="flex-1 bg-[#0B1121] relative group flex flex-col justify-center px-8 md:px-16 lg:px-24 py-20 border-t md:border-t-0 md:border-l border-slate-800 overflow-hidden">
          
          {/* Subtle Tech Grid Background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-20 pointer-events-none"></div>

          <div className="max-w-lg w-full mx-auto md:mx-0 md:mr-auto md:ml-16 relative z-10">
            
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-900/40 text-blue-400 text-[10px] font-bold uppercase tracking-widest mb-6 border border-blue-800/50">
              <Target className="w-3 h-3" />
              Year 6 (Exam Prep)
            </div>

            <h1 className="text-4xl md:text-5xl font-medium tracking-tight text-white mb-6 leading-[1.1]">
              The Codified <br/><span className="text-blue-400 font-mono tracking-tighter">BASELINE.</span>
            </h1>
            
            <p className="text-base text-slate-400 leading-relaxed mb-8">
              A premium human tutor spends weeks attempting to map a student's hidden failure points. We codified that initial diagnosis. Identify exactly what to work on to generate the highest "bang-for-buck" improvement in the final 6 months.
            </p>

            <div className="space-y-5 mb-12">
              <div className="flex items-start gap-3">
                <Crosshair className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-white font-bold">Beyond Binary Marking</p>
                  <p className="text-xs text-slate-400 mt-1">Traditional platforms mark answers wrong. We map the Orthogonal reason <em>why</em> (e.g., Linguistic Traps vs. Concept Voids).</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Activity className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-white font-bold">Built for Parents & Tutors</p>
                  <p className="text-xs text-slate-400 mt-1">Accelerate your private tutor's curriculum planning, or take command of the final intervention strategy yourself.</p>
                </div>
              </div>
            </div>

            <button 
              onClick={() => router.push('/register?intent=diagnostic')}
              className="group/btn flex items-center gap-3 bg-blue-600 text-white px-8 py-4 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-blue-500 transition-all w-fit shadow-lg shadow-blue-900/20"
            >
              Initialize Diagnostic
              <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

      </main>
    </div>
  );
}