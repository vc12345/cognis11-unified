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
            Free Concept Lessons For All Families
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-serif leading-[1.1] mb-6 tracking-tight">
            11+ preparation that feels like <span className="italic text-amber-600">quality time.</span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto mb-10">
            A free, open-access course designed to bypass expensive tutoring. Introduce tricky test ideas early at home using your own family's voice.
          </p>
        </div>
      </section>

      {/* THESIS BAND */}
      <section className="py-16 px-6 md:px-12 bg-[#1B3A5C] text-white text-center">
        <div className="max-w-3xl mx-auto space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Our Shared Approach</p>
          <h2 className="text-3xl font-serif leading-tight">
            <span className="italic text-amber-400">You</span> know your child best. <span className="italic text-amber-400">We</span> just provide the map.
          </h2>
          <p className="text-slate-300 text-base leading-relaxed">
            Young children don't learn deep concepts by staring at isolated screen drills or memorising answers by rote. They learn through conversations with you. We give you easy, 10-minute daily talking points so you can confidently explain the trickiest topics before school pressure sets in.
          </p>
        </div>
      </section>

      {/* TWO APPROACHES SECTION */}
      <section className="py-24 px-6 md:px-12 bg-white border-b border-[#E5E3DD]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16 space-y-2">
            <h2 className="text-3xl font-bold font-serif">One Core Curriculum. <span className="italic text-amber-600">Two Ways to Learn.</span></h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm">
              Every child develops at their own pace. You can easily switch between these formats in your dashboard at any time as your child grows more confident.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            
            {/* APPROACH 1: FOUNDATIONAL */}
            <div className="border border-[#E5E3DD] bg-[#FAFAF6] rounded-2xl p-8 flex flex-col justify-between hover:border-amber-200 transition-colors">
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Best for: Years 2–4</p>
                  <h3 className="text-2xl font-bold font-serif text-[#1B3A5C]">The Early Foundation Path</h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">Quietly introduces the core rules of the exam early. Uses clear, gentle visuals like "The Paper Pile" and "The Scissors Cut" to make tricky spatial puzzles feel natural.</p>
                </div>
                <ul className="space-y-3 border-t border-[#E5E3DD] pt-6">
                  {['Full access to all 59 core learning modules', 'Lightweight, stress-free daily visual lessons', 'Covers foundational Maths, Spatial, and Verbal frameworks'].map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-slate-600"><CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" /> {f}</li>
                  ))}
                </ul>
              </div>
              <button onClick={() => handleSelection('foundational')} className="w-full bg-white border border-[#E5E3DD] text-[#1B3A5C] hover:border-[#1B3A5C] font-bold text-xs uppercase tracking-wider py-4 rounded-lg transition-all mt-8 flex items-center justify-center gap-2">
                Start Early Foundation Path <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* APPROACH 2: SUPPLEMENTAL */}
            <div className="border border-[#1B3A5C] bg-white rounded-2xl p-8 flex flex-col justify-between shadow-md hover:border-amber-500 transition-colors">
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#1B3A5C] mb-1">Best for: Years 4–6</p>
                  <h3 className="text-2xl font-bold font-serif text-[#1B3A5C]">The Step-Up Mastery Path</h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">Adds real exam-level thinking to the lessons. Perfect for children who understand the basics but get tripped up by the unexpected curveballs modern selective school tests use.</p>
                </div>
                <ul className="space-y-3 border-t border-[#E5E3DD] pt-6">
                  {['Includes everything in the Foundation Path', 'Advanced practice sub-modules attached to every topic', 'Built explicitly to handle the speed and pressure of real exams'].map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-slate-600"><CheckCircle2 className="w-4 h-4 text-[#1B3A5C] shrink-0" /> {f}</li>
                  ))}
                </ul>
              </div>
              <button onClick={() => handleSelection('supplemental')} className="w-full bg-[#1B3A5C] text-white hover:bg-slate-800 font-bold text-xs uppercase tracking-wider py-4 rounded-lg transition-all mt-8 flex items-center justify-center gap-2 shadow-sm">
                Start Step-Up Mastery Path <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </div>

          {/* VOLUNTARY PRICING ACCORD */}
          <div className="mt-16 text-center max-w-md mx-auto bg-slate-50 border border-[#E5E3DD] p-6 rounded-xl">
            <h4 className="text-xs font-bold uppercase tracking-widest text-[#1B3A5C] mb-2">Our Pay-What-You-Can Promise</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              We know how expensive raising a family is, and we don't think good education should belong only to those with huge budgets. Our entire core course is completely free. If our tools help your child flourish and your budget allows, a voluntary <span className="font-bold text-[#1B3A5C]">£5/month</span> contribution helps us keep this resource open for everyone.
            </p>
          </div>

        </div>
      </section>
    </div>
  );
}