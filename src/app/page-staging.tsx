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
          Because the 11+ has become an arms race. Let’s change how you play it.
        </h2>
        
        <p className="text-sm md:text-base text-slate-500 max-w-2xl leading-relaxed">
          Schools are designing trickier tests to catch out children who simply memorise answers. We don't believe in endless, expensive drilling. Whether you want to quietly build an unbreakable foundation early at home, or need to instantly spot hidden mistakes in the final stretch, we give your child a level footing.
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
            <h3 className="text-3xl font-bold font-serif mb-4 text-[#1B3A5C]">Build the Foundation Early</h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-8">
              Don’t wait for the classroom to rush through the basics. Use our 10-minute conversational scripts to introduce tricky concepts to your child in your own family's voice—long before test pressure sets in. Fully accessible, open to every budget, and completely free.
            </p>
            <button 
              onClick={() => router.push('/course/')}
              className="inline-flex items-center gap-2 bg-[#1B3A5C] hover:bg-slate-800 text-white font-medium text-xs uppercase tracking-wider px-6 py-3.5 rounded-md shadow-sm transition-all"
            >
              Start Free Concept Course
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* CTA 2: Diagnostic Evaluation Path */}
        <div className="flex-1 bg-[#F5F4EE] flex flex-col justify-center px-8 md:px-16 py-16">
          <div className="max-w-md w-full mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-900 text-[10px] font-bold uppercase tracking-widest mb-6 border border-blue-200">
              <Target className="w-3 h-3" /> Year 6 / Final Push
            </div>
            <h3 className="text-3xl font-bold font-serif mb-4 text-[#1B3A5C]">Skip the Tutor Trial & Error</h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-8">
              Private tutors charge hundreds of pounds over several sessions just to work out where a child is struggling. Our single, targeted diagnostic bypasses the sunk cost—instantly mapping out the exact logical blind spots holding back your child's score in these vital final months.
            </p>
            <button 
              onClick={() => router.push('/diagnostic/')}
              className="inline-flex items-center gap-2 bg-[#1B3A5C] hover:bg-slate-800 text-white font-medium text-xs uppercase tracking-wider px-6 py-3.5 rounded-md shadow-sm transition-all"
            >
              Run the 11+ Diagnostic
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </main>
    </div>
  );
}