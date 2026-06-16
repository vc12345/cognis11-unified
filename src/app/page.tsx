'use client';

import { useRouter } from 'next/navigation';
import { Brain, Sparkles, Target, ArrowRight } from 'lucide-react';

export default function LocalhostSplitLanding() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col font-sans bg-[#FAFAF6] selection:bg-amber-200 text-[#1B3A5C]">
      
      {/* 1. Unified Shared Mission Header */}
      <header className="w-full bg-white border-b border-[#E5E3DD] px-6 py-12 md:py-16 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-3 mb-4">
          <div className="p-2 bg-[#FAF9F6] border border-[#E5E3DD] rounded-xl">
            <Brain className="w-6 h-6 text-[#1B3A5C]" />
          </div>
          <span className="text-lg font-black tracking-[0.25em] font-mono text-slate-800">COGNIS11</span>
        </div>
        
        <h2 className="text-3xl md:text-4xl font-bold font-serif text-[#1B3A5C] max-w-3xl tracking-tight mb-4">
          An intelligent alternative to 11+ preparation.
        </h2>
        
        <p className="text-sm md:text-base text-slate-500 max-w-2xl leading-relaxed">
          Mass-market platforms measure right vs. wrong and prescribe more repetitive volume. We evaluate the underlying cognitive mechanics. Whether you are building a foundational base early or establishing high-ROI interventions in the final 6 months.
        </p>
      </header>

      {/* 2. Split Screen Navigation Environment */}
      <main className="flex-1 flex flex-col md:flex-row relative">
        
        {/* Desktop Central Indicator */}
        <div className="hidden md:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 items-center justify-center bg-white border border-[#E5E3DD] w-12 h-12 rounded-full shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 font-mono tracking-widest">OR</span>
        </div>

        {/* CTA 1: Pre-Prep Course Path */}
        <div className="flex-1 bg-[#FAFAF6] flex flex-col justify-center px-8 md:px-16 py-16 border-b md:border-b-0 md:border-r border-[#E5E3DD]">
          <div className="max-w-md w-full mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold uppercase tracking-widest mb-6 border border-amber-200">
              <Sparkles className="w-3 h-3" /> Years 2 — 5
            </div>
            <h3 className="text-3xl font-bold font-serif mb-4 text-[#1B3A5C]">Concept Introduction & Elaboration</h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-8">
              Build intuitive logic before the pressure of rote drilling sets in. Complete open-access curriculum mapping with 10-minute parental conversational scripts. Pay what you want.
            </p>
            <button 
              onClick={() => router.push('/course/')}
              className="inline-flex items-center gap-2 bg-[#1B3A5C] hover:bg-slate-800 text-white font-medium text-xs uppercase tracking-wider px-6 py-3.5 rounded-md shadow-sm transition-all"
            >
              Enter Pre-Prep Course
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* CTA 2: Diagnostic Evaluation Path */}
        <div className="flex-1 bg-[#F5F4EE] flex flex-col justify-center px-8 md:px-16 py-16">
          <div className="max-w-md w-full mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-900 text-[10px] font-bold uppercase tracking-widest mb-6 border border-blue-200">
              <Target className="w-3 h-3" /> Year 6 Focus
            </div>
            <h3 className="text-3xl font-bold font-serif mb-4 text-[#1B3A5C]">The Codified Cognitive Baseline</h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-8">
              A premium tutor spends weeks figuring out what a child needs. Our high-stakes evaluation matrices isolate the exact logic failure types capping their scores in the final 6 months.
            </p>
            <button 
              onClick={() => router.push('/diagnostic/')}
              className="inline-flex items-center gap-2 bg-[#1B3A5C] hover:bg-slate-800 text-white font-medium text-xs uppercase tracking-wider px-6 py-3.5 rounded-md shadow-sm transition-all"
            >
              Access Diagnostic Engine
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </main>
    </div>
  );
}