'use client';
import React from 'react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100">
      
      {/* Top Subtle Banner */}
      <div className="bg-indigo-600 text-white text-center py-2 px-4 text-xs font-semibold tracking-wider uppercase">
        Strictly for Parents Targeting Grammar & Premium Independent Schools
      </div>

      {/* Navigation Header */}
      <header className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between border-b border-slate-200 bg-slate-50/80 backdrop-blur sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <span className="text-xl font-serif font-black tracking-tight text-slate-950">11+<span className="text-indigo-600">Cognitive</span></span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
          <a href="#how-it-works" className="hover:text-indigo-600 transition">The Technology</a>
          <a href="#the-dossier" className="hover:text-indigo-600 transition">The Metrics</a>
          <a href="#pricing" className="hover:text-indigo-600 transition">Pricing Tiers</a>
        </nav>
        <div>
          <a 
            href="#pricing" 
            className="bg-slate-950 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm hover:bg-slate-800 transition"
          >
            Access Portal
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-20 text-center">
        <span className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 rounded-full px-3 py-1 text-xs font-bold text-indigo-700 tracking-wide uppercase mb-6">
          Objective 11+ Diagnostic Engine
        </span>
        <h1 className="text-4xl md:text-6xl font-serif tracking-tight text-slate-950 leading-[1.1] mb-6">
          Stop guessing. Find out exactly where your child is dropping marks in 15 minutes.
        </h1>
        <p className="text-lg md:text-xl font-serif text-slate-600 max-w-2xl mx-auto leading-relaxed mb-10">
          Tuition platforms are incentivised to be relentlessly upbeat. We are not. Our voice-interactive AI extracts how your child actually thinks, mapping hidden memory and parsing failures with absolute clinical accuracy.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <a 
            href="#pricing" 
            className="bg-indigo-600 text-white px-8 py-4 rounded-xl text-base font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition transform hover:-translate-y-0.5"
          >
            Run Initial Diagnostic
          </a>
          <a 
            href="#how-it-works" 
            className="bg-white text-slate-700 border border-slate-300 px-8 py-4 rounded-xl text-base font-bold shadow-sm hover:bg-slate-50 transition"
          >
            See How It Works
          </a>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="bg-slate-900 text-white py-24 px-6 relative overflow-hidden">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs font-mono font-black tracking-[0.2em] uppercase text-indigo-400 mb-2">The Methodology</h2>
            <p className="text-3xl font-serif text-slate-100">Most 11+ metrics test the outcome. We isolate the process.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-slate-950 p-8 rounded-xl border border-slate-800">
              <div className="text-2xl mb-4">🎙️</div>
              <h3 className="text-lg font-bold mb-2">1. Voice-Interactive Capture</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Your child reads and solves problems aloud natively. Our microphone tracking captures exact pauses, hesitations, and false self-corrections.
              </p>
            </div>

            <div className="bg-slate-950 p-8 rounded-xl border border-slate-800">
              <div className="text-2xl mb-4">🧠</div>
              <h3 className="text-lg font-bold mb-2">2. Cognitive Load Mapping</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                The engine evaluates the text transcript against standard $A\#L\#$ matrices, separating linguistic confusion from mechanical arithmetic fatigue.
              </p>
            </div>

            <div className="bg-slate-950 p-8 rounded-xl border border-slate-800">
              <div className="text-2xl mb-4">📊</div>
              <h3 className="text-lg font-bold mb-2">3. The Reality Check</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                You receive a blunt, quantitative assessment revealing exactly what school tier they are currently on track to realistically survive.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The Blurred Dossier / Social Proof Section */}
      <section id="the-dossier" className="max-w-5xl mx-auto px-6 py-24">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">The Artifact</h2>
            <p className="text-3xl font-serif text-slate-950 mb-4">The 11+ Diagnostic Dossier</p>
            <p className="text-slate-600 font-medium leading-relaxed mb-6">
              You will not receive generic charts or patronising summaries. You receive unvarnished, clinical telemetry. Our dashboard shows you exactly where your child's brain hits a saturation point and drops marks.
            </p>
            <ul className="space-y-3 font-semibold text-sm text-slate-700">
              <li className="flex items-center gap-3">
                <span className="text-indigo-600">✓</span> Real-Time Pacing Velocity Graphs
              </li>
              <li className="flex items-center gap-3">
                <span className="text-indigo-600">✓</span> $A\#L\#$ Multi-Layered Complexity Matrices
              </li>
              <li className="flex items-center gap-3">
                <span className="text-indigo-600">✓</span> Pathological Error Identification (Working Memory Drops)
              </li>
            </ul>
          </div>

          {/* Visual Representation of the Dashboard (Slightly Styled to feel Premium) */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl shadow-xl p-6 relative select-none pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-transparent to-transparent backdrop-blur-[1px] rounded-2xl z-10 flex items-center justify-center">
              <span className="bg-slate-900 text-white text-xs font-black px-4 py-2 rounded-lg tracking-wider uppercase shadow-xl">
                Dossier Preview
              </span>
            </div>
            {/* Fake Dashboard Elements */}
            <div className="w-1/3 h-4 bg-slate-900 rounded mb-6"></div>
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="h-16 bg-slate-100 rounded-xl border border-slate-200"></div>
              <div className="h-16 bg-slate-100 rounded-xl border border-slate-200"></div>
              <div className="h-16 bg-slate-100 rounded-xl border border-slate-200"></div>
            </div>
            <div className="h-28 bg-slate-50 border border-slate-200 rounded-xl mb-4 flex items-end p-2 gap-2">
              <div className="w-1/4 h-[40%] bg-indigo-200 rounded-t"></div>
              <div className="w-1/4 h-[75%] bg-indigo-300 rounded-t"></div>
              <div className="w-1/4 h-[85%] bg-indigo-500 rounded-t"></div>
              <div className="w-1/4 h-[25%] bg-rose-400 rounded-t"></div>
            </div>
            <div className="w-full h-3 bg-slate-200 rounded mb-2"></div>
            <div className="w-2/3 h-3 bg-slate-200 rounded"></div>
          </div>
        </div>
      </section>

      {/* Pricing / Monetization Wedge */}
      <section id="pricing" className="bg-slate-100 border-t border-slate-200 py-24 px-6">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Monetization & Packages</h2>
          <p className="text-3xl font-serif text-slate-950">Secure the Data You Actually Need</p>
        </div>

        <div className="max-w-3xl mx-auto grid md:grid-cols-2 gap-8 items-stretch">
          
          {/* Tier 1 */}
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">The Wedge</span>
              <h3 className="text-xl font-bold text-slate-950">One-Off Reality Check</h3>
              <p className="text-xs text-slate-500 mt-1">Perfect for immediate, structural auditing.</p>
              <div className="my-6">
                <span className="text-3xl font-black text-slate-950">£29</span>
                <span className="text-xs text-slate-400 font-bold ml-1">/ single test</span>
              </div>
              <ul className="space-y-2 text-sm text-slate-600 border-t border-slate-100 pt-4">
                <li>• Complete 50-Question Diagnostic</li>
                <li>• Core Trajectory Assessment</li>
                <li>• Cognitive Archetype Profiling</li>
                <li>• Error Leak Diagnosis</li>
              </ul>
            </div>
            <button className="w-full bg-slate-950 text-white text-sm font-bold py-3 rounded-xl mt-8 hover:bg-slate-800 transition">
              Purchase Diagnostic
            </button>
          </div>

          {/* Tier 2 */}
          <div className="bg-white p-8 rounded-2xl border-2 border-indigo-600 shadow-xl flex flex-col justify-between relative">
            <div className="absolute -top-3 right-6 bg-indigo-600 text-white text-[10px] font-black tracking-wider uppercase px-3 py-1 rounded-full">
              Highly Recommended
            </div>
            <div>
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block mb-1">Extended Tracking</span>
              <h3 className="text-xl font-bold text-slate-950">11+ Pro Extended Track</h3>
              <p className="text-xs text-slate-500 mt-1">Designed for ongoing accountability and training.</p>
              <div className="my-6">
                <span className="text-3xl font-black text-slate-950">£39</span>
                <span className="text-xs text-slate-400 font-bold ml-1">/ month</span>
              </div>
              <ul className="space-y-2 text-sm text-slate-600 border-t border-slate-100 pt-4">
                <li className="text-indigo-900 font-semibold">• Everything in the One-Off Tier</li>
                <li>• 5-Point Rolling SMA Accuracy Trends</li>
                <li>• Complete $A\#L\#$ Interactive Complexity Matrix</li>
                <li>• Anomaly Ledger & Flag Feeds</li>
                <li>• Weekly targeted tracking adjustments</li>
              </ul>
            </div>
            <button className="w-full bg-indigo-600 text-white text-sm font-bold py-3 rounded-xl mt-8 hover:bg-indigo-700 transition shadow-lg shadow-indigo-600/20">
              Subscribe to Track Progress
            </button>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-500 text-center py-8 font-mono text-xs border-t border-slate-900">
        © {new Date().getFullYear()} 11+ Cognitive Analytics. Built strictly for competitive academic preparation.
      </footer>

    </div>
  );
}