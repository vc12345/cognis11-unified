'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, BookOpen, Lightbulb, CheckCircle2, ChevronRight, Sparkles, RefreshCw } from 'lucide-react';

export default function CourseLandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);
    }
    checkAuth();
  }, [supabase]);

  const handleSelection = (approach: 'foundational' | 'supplemental') => {
    if (isLoggedIn) {
      // Logged in users bypass the forms entirely and configure directly inside Profile
      router.push('/profile');
    } else {
      // Guest users head to the registration gateway with their initial intent preserved
      router.push(`/register?intent=course&plan=${approach}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF6] text-[#1B3A5C] font-sans antialiased selection:bg-amber-200">
      
      {/* HERO SECTION */}
      <section className="relative pt-24 pb-20 px-6 md:px-12 bg-white border-b border-[#E5E3DD]">
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold uppercase tracking-widest mb-8 border border-amber-200">
            <Sparkles className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            Unified 11+ Learning System
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-serif leading-[1.1] mb-6 tracking-tight">
            11+ preparation that feels like <span className="italic text-amber-600">quality time.</span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto mb-10">
            One comprehensive master curriculum. Two flexible instruction approaches tailored dynamically to your child's current development.
          </p>
        </div>
      </section>

      {/* THESIS BAND */}
      <section className="py-16 px-6 md:px-12 bg-[#1B3A5C] text-white text-center">
        <div className="max-w-3xl mx-auto space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">The Design Principle</p>
          <h2 className="text-3xl font-serif leading-tight">
            <span className="italic text-amber-400">You</span> are the teacher. <span className="italic text-amber-400">We</span> are the preparation.
          </h2>
          <p className="text-slate-300 text-base leading-relaxed">
            Young children acquire conceptual frameworks through human interaction, not isolated screen drills. Cognis11+ gives you everything you need in 60 seconds to guide an impactful 10-minute daily session.
          </p>
        </div>
      </section>

      {/* TWO APPROACHES APPROACH SECTION */}
      <section className="py-24 px-6 md:px-12 bg-white border-b border-[#E5E3DD]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16 space-y-2">
            <h2 className="text-3xl font-bold font-serif">One Curriculum. <span className="italic text-amber-600">Two Flexible Approaches.</span></h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm">
              You are never locked into a single plan. Seamlessly swap between delivery formats in your Control Hub as your child progresses.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            
            {/* APPROACH 1: FOUNDATIONAL */}
            <div className="border border-[#E5E3DD] bg-[#FAFAF6] rounded-2xl p-8 flex flex-col justify-between hover:border-amber-200 transition-colors">
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Target: Years 2–4</p>
                  <h3 className="text-2xl font-bold font-serif text-[#1B3A5C]">Foundational Path</h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">Introduces core mental frameworks early using elegant, lightweight visuals to deconstruct complex conceptual rules safely.</p>
                </div>
                <ul className="space-y-3 border-t border-[#E5E3DD] pt-6">
                  {['Full access to all 59 core modules', 'Lightweight daily visual guides', 'Covers foundational Maths, VR, and NVR frameworks'].map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-slate-600"><CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" /> {f}</li>
                  ))}
                </ul>
              </div>
              <button onClick={() => handleSelection('foundational')} className="w-full bg-white border border-[#E5E3DD] text-[#1B3A5C] hover:border-[#1B3A5C] font-bold text-xs uppercase tracking-wider py-4 rounded-lg transition-all mt-8 flex items-center justify-center gap-2">
                Explore Foundational Approach <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* APPROACH 2: SUPPLEMENTAL */}
            <div className="border border-[#1B3A5C] bg-white rounded-2xl p-8 flex flex-col justify-between shadow-md hover:border-amber-500 transition-colors">
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#1B3A5C] font-bold mb-1">Target: Years 4–6</p>
                  <h3 className="text-2xl font-bold font-serif text-[#1B3A5C]">Supplemental Path</h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">Deploys rigorous exam-level logic matrices and adaptive Mastery sub-modules engineered explicitly to isolate mock exam gaps.</p>
                </div>
                <ul className="space-y-3 border-t border-[#E5E3DD] pt-6">
                  {['Includes everything in Foundational', 'Advanced Mastery Sub-Modules attached to topics', 'Designed targetedly for ultimate final exam pacing'].map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-slate-600"><CheckCircle2 className="w-4 h-4 text-[#1B3A5C] shrink-0" /> {f}</li>
                  ))}
                </ul>
              </div>
              <button onClick={() => handleSelection('supplemental')} className="w-full bg-[#1B3A5C] text-white hover:bg-slate-800 font-bold text-xs uppercase tracking-wider py-4 rounded-lg transition-all mt-8 flex items-center justify-center gap-2 shadow-sm">
                Explore Supplemental Approach <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </div>

          {/* VOLUNTARY PRICING ACCORD */}
          <div className="mt-16 text-center max-w-md mx-auto bg-slate-50 border border-[#E5E3DD] p-6 rounded-xl">
            <h4 className="text-xs font-bold uppercase tracking-widest text-[#1B3A5C] mb-2">Simple Voluntary Support Model</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              We serve the entire core curriculum completely free. If our tools help your child flourish, consider an optional <span className="font-bold text-[#1B3A5C]">£5/month</span> contribution to help power our servers.
            </p>
          </div>

        </div>
      </section>
    </div>
  );
}