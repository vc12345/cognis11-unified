'use client';

import { useRouter } from 'next/navigation';
import { Brain, Microscope, HeartHandshake, Target, ArrowRight, ShieldCheck, CheckCircle2, AlertTriangle, ChevronRight } from 'lucide-react';

export default function DiagnosticSalesPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#FAFAF6] text-[#1B3A5C] font-sans selection:bg-blue-200">
      
      {/* ======================================================== */}
      {/* HERO SECTION                                             */}
      {/* ======================================================== */}
      <header className="relative pt-20 pb-24 px-6 md:px-12 overflow-hidden border-b border-[#E5E3DD] bg-white">
        <div className="max-w-4xl mx-auto text-center relative z-10">
          
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-blue-800 text-[10px] font-bold uppercase tracking-widest mb-8 border border-blue-200">
            <Target className="w-3.5 h-3.5" />
            Year 6 Preparation
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-serif text-[#1B3A5C] leading-[1.1] mb-6 tracking-tight">
            Stop guessing <span className="italic text-blue-700">why</span> they lost marks.
          </h1>
          
          <p className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto mb-10">
            Mock exams only tell you what your child got wrong. We help you understand exactly why it happened, giving you a clear path to fix it before the real 11+.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
              className="w-full sm:w-auto bg-[#1B3A5C] hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider px-8 py-4 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2"
            >
              View Assessment Options <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ======================================================== */}
      {/* THE PROBLEM VS SOLUTION (THE PITCH)                        */}
      {/* ======================================================== */}
      <section className="py-24 px-6 md:px-12 bg-[#FAFAF6]">
        <div className="max-w-5xl mx-auto">
          
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold font-serif mb-4">A smarter way to prepare.</h2>
            <p className="text-slate-500 max-w-2xl mx-auto leading-relaxed">
              When a child gets a question wrong, the usual advice is "do more practice papers." But if you don't know the root cause of the mistake, extra practice just leads to frustration and burnout.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* The Old Way */}
            <div className="bg-white border border-[#E5E3DD] p-8 rounded-2xl shadow-sm opacity-80">
              <div className="flex items-center gap-3 mb-6">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
                <h3 className="text-lg font-bold">Standard Practice Papers</h3>
              </div>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-slate-600 text-sm leading-relaxed">
                  <span className="text-red-500 font-bold mt-0.5">✕</span> Just marks an answer as "Right" or "Wrong".
                </li>
                <li className="flex items-start gap-3 text-slate-600 text-sm leading-relaxed">
                  <span className="text-red-500 font-bold mt-0.5">✕</span> Can't tell if your child made a silly calculation error, or if they genuinely don't understand the topic.
                </li>
                <li className="flex items-start gap-3 text-slate-600 text-sm leading-relaxed">
                  <span className="text-red-500 font-bold mt-0.5">✕</span> Leaves parents and tutors guessing what to focus on next.
                </li>
              </ul>
            </div>

            {/* The Cognis Way */}
            <div className="bg-[#1B3A5C] text-white p-8 rounded-2xl shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <HeartHandshake className="w-32 h-32" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <Brain className="w-6 h-6 text-blue-400" />
                  <h3 className="text-lg font-bold">The Cognis11 Approach</h3>
                </div>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3 text-slate-300 text-sm leading-relaxed">
                    <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" /> Spots the real reason behind the mistake (like misreading the question vs. forgetting the math rule).
                  </li>
                  <li className="flex items-start gap-3 text-slate-300 text-sm leading-relaxed">
                    <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" /> Creates a clear, step-by-step action plan you can easily hand over to your tutor.
                  </li>
                  <li className="flex items-start gap-3 text-slate-300 text-sm leading-relaxed">
                    <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" /> Saves weeks of expensive tutoring time by immediately showing exactly what needs work.
                  </li>
                </ul>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ======================================================== */}
      {/* PRICING & CTAs                                           */}
      {/* ======================================================== */}
      <section id="pricing" className="py-24 px-6 md:px-12 bg-white border-t border-[#E5E3DD]">
        <div className="max-w-4xl mx-auto">
          
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold font-serif mb-4">Find their exact starting point.</h2>
            <p className="text-slate-500">
              Whether you want a quick check-up or long-term support, we have an option for you.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* TIER 1: ONE-OFF */}
            <div className="border border-[#E5E3DD] bg-[#FAFAF6] rounded-2xl p-8 flex flex-col hover:border-blue-200 transition-colors">
              <div className="mb-8">
                <h3 className="text-xl font-bold font-serif mb-2">Deep-Dive Assessment</h3>
                <p className="text-sm text-slate-500 mb-6">Perfect for parents who want a thorough, immediate check-up on their child's readiness.</p>
                <div className="text-4xl font-black text-[#1B3A5C]">£29</div>
                <div className="text-[10px] uppercase tracking-widest text-slate-400 mt-2 font-bold">One-off evaluation</div>
              </div>
              
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3 text-sm text-slate-600">
                  <ShieldCheck className="w-4 h-4 text-[#1B3A5C]" /> 1 Full Diagnostic Assessment
                </li>
                <li className="flex items-center gap-3 text-sm text-slate-600">
                  <ShieldCheck className="w-4 h-4 text-[#1B3A5C]" /> Detailed Breakdown Report
                </li>
                <li className="flex items-center gap-3 text-sm text-slate-600">
                  <ShieldCheck className="w-4 h-4 text-[#1B3A5C]" /> Tutor-ready action plan
                </li>
              </ul>

              <button 
                onClick={() => router.push('/register?intent=diagnostic&plan=one-off')}
                className="w-full bg-white border border-[#E5E3DD] text-[#1B3A5C] hover:border-[#1B3A5C] font-bold text-xs uppercase tracking-wider py-4 rounded-lg transition-all flex items-center justify-center gap-2"
              >
                Purchase Single Test <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* TIER 2: 6-MONTH ACCESS */}
            <div className="border-2 border-blue-600 bg-blue-50/30 rounded-2xl p-8 flex flex-col relative shadow-lg">
              <div className="absolute top-0 right-6 -translate-y-1/2 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                Exam Season Support
              </div>
              
              <div className="mb-8">
                <h3 className="text-xl font-bold font-serif mb-2 text-blue-900">Exam-Cycle Tracking</h3>
                <p className="text-sm text-slate-600 mb-6">For families in the final 6 months. Take multiple assessments to measure progress and adjust focus.</p>
                <div className="flex items-end gap-2">
                  <div className="text-4xl font-black text-blue-900">£59</div>
                </div>
                <div className="text-[10px] uppercase tracking-widest text-slate-500 mt-2 font-bold">6-Month Platform Access</div>
              </div>
              
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3 text-sm text-blue-900 font-medium">
                  <Target className="w-4 h-4 text-blue-600" /> 5 Full Diagnostic Assessments
                </li>
                <li className="flex items-center gap-3 text-sm text-slate-600">
                  <Target className="w-4 h-4 text-blue-600" /> Track improvement over time
                </li>
                <li className="flex items-center gap-3 text-sm text-slate-600">
                  <Target className="w-4 h-4 text-blue-600" /> Update your tutor's plan dynamically
                </li>
              </ul>

              <button 
                onClick={() => router.push('/register?intent=diagnostic&plan=6-month')}
                className="w-full bg-blue-600 text-white hover:bg-blue-700 font-bold text-xs uppercase tracking-wider py-4 rounded-lg transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-900/10"
              >
                Secure 6-Month Access <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      </section>

    </div>
  );
}