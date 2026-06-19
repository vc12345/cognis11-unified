'use client';

import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { Mic, Square, Loader2, Sparkles, AlertCircle, CheckCircle2, ArrowRight, PauseCircle } from 'lucide-react';

import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

// --- TYPE DEFINITIONS ---
interface TestQuestion {
  variant_id: string;
  al_classification: string;
  question: string;
  options?: any;
}

interface TestState {
  status: 'INITIALIZING' | 'ACTIVE' | 'COMPLETED' | 'ERROR';
  sessionId: string | null;
  payload: TestQuestion[];
  currentIndex: number;
  errorMessage: string;
}

type UIState = 'IDLE' | 'RECORDING' | 'ANALYZING_AUDIO' | 'SUBMITTING';

// --- CUSTOM MIXED-CONTENT LATEX PARSER ---
const renderLatexString = (text: string) => {
  if (!text) return null;
  const parts = text.split(/(\$\$[\s\S]*?\External APIs|\$[\s\S]*?\$)/g);
  return parts.map((part, index) => {
    if (part.startsWith('$$') && part.endsWith('$$')) {
      return <BlockMath key={index} math={part.slice(2, -2)} />;
    } else if (part.startsWith('$') && part.endsWith('$')) {
      return <InlineMath key={index} math={part.slice(1, -1)} />;
    }
    return <span key={index}>{part}</span>;
  });
};

function DiagnosticRunner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Core State Engine
  const [testState, setTestState] = useState<TestState>({
    status: 'INITIALIZING',
    sessionId: null,
    payload: [],
    currentIndex: 0,
    errorMessage: '',
  });

  // UI Engine
  const [uiState, setUiState] = useState<UIState>('IDLE');
  const [transcript, setTranscript] = useState('');
  const [hasRecordedOnce, setHasRecordedOnce] = useState(false);
  
  // Telemetry Setup
  const questionStartTime = useRef<number>(0);
  const { startRecording, stopRecording } = useAudioRecorder();

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  useEffect(() => {
    async function initializeSession() {
      const sessionParam = searchParams.get('session');
      if (!sessionParam) {
        setTestState(prev => ({ ...prev, status: 'ERROR', errorMessage: 'INVALID_ROUTING_PARAMETER' }));
        return;
      }

      try {
        if (sessionParam === 'new') {
          const res = await fetch('/api/generate-test', { method: 'POST' });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to generate diagnostic payload');

          setTestState({
            status: 'ACTIVE',
            sessionId: data.session_id,
            payload: data.payload,
            currentIndex: 0,
            errorMessage: ''
          });
          questionStartTime.current = Date.now();
        } else {
          const res = await fetch(`/api/resume-test?session_id=${sessionParam}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to restore session state');

          setTestState({
            status: 'ACTIVE',
            sessionId: data.session_id,
            payload: data.payload,
            currentIndex: data.resume_index,
            errorMessage: ''
          });
          questionStartTime.current = Date.now();
        }
      } catch (err: any) {
        setTestState(prev => ({ ...prev, status: 'ERROR', errorMessage: err.message }));
      }
    }
    initializeSession();
  }, [searchParams]);

  const activeQuestion = testState.payload[testState.currentIndex];
  
  const parsedOptions = useMemo(() => {
    if (!activeQuestion || !activeQuestion.options) return [];
    const optionsObj = typeof activeQuestion.options === 'string' 
      ? JSON.parse(activeQuestion.options) 
      : activeQuestion.options;

    return Object.entries(optionsObj).map(([key, val]) => ({
      label: key, 
      value: String(val)
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, [activeQuestion]);

  const handleMicToggle = async () => {
    if (uiState === 'IDLE') {
      await startRecording();
      setUiState('RECORDING');
    } else if (uiState === 'RECORDING') {
      setUiState('ANALYZING_AUDIO');
      const audioBlob = await stopRecording();
      
      if (audioBlob) {
        try {
          const formData = new FormData();
          formData.append('file', audioBlob);

          const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) throw new Error("Transcription failed.");
          const result = await response.json();
          
          // Tutor-pattern: Stream appending to preserve iterative thinking adjustments
          setTranscript(prev => prev ? `${prev} ${result.text}` : result.text);
          setHasRecordedOnce(true);
        } catch (err) {
          console.error("Transcription error:", err);
          alert("Could not catch that audio sample cleanly. You may type directly into the workspace scratchpad.");
          setHasRecordedOnce(true);
        } finally {
          setUiState('IDLE');
        }
      } else {
        setUiState('IDLE');
      }
    }
  };

  const handleCommitAnswer = async () => {
    if (!transcript.trim()) return;
    setUiState('SUBMITTING');

    const timeSpentMs = Date.now() - questionStartTime.current;
    const timeSpentSeconds = Math.round(timeSpentMs / 1000);

    fetch('/api/save-attempt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: testState.sessionId,
        variant_id: activeQuestion.variant_id,
        raw_answer: transcript,
        execution_velocity_seconds: timeSpentSeconds,
      })
    }).catch(err => console.error("Telemetry Sync Failure:", err));

    const nextIndex = testState.currentIndex + 1;
    
    if (nextIndex >= testState.payload.length) {
      setTestState(prev => ({ ...prev, status: 'COMPLETED' }));
    } else {
      setTestState(prev => ({ ...prev, currentIndex: nextIndex }));
      setTranscript('');
      setHasRecordedOnce(false);
      setUiState('IDLE');
      questionStartTime.current = Date.now();
    }
  };

  if (testState.status === 'INITIALIZING') {
    return (
      <div className="min-h-screen bg-[#FAFAF6] flex flex-col items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-[#1B3A5C] animate-spin" />
          <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Syncing Diagnostic Room...</span>
        </div>
      </div>
    );
  }

  if (testState.status === 'ERROR') {
    return (
      <div className="min-h-screen bg-[#FAFAF6] flex flex-col items-center justify-center space-y-5 px-6">
        <div className="text-xs tracking-widest uppercase text-rose-700 font-bold border-2 border-rose-200 bg-rose-50/50 p-6 rounded-2xl max-w-md text-center shadow-sm">
          System Interruption: {testState.errorMessage}
        </div>
        <button onClick={() => router.push('/profile')} className="text-[10px] uppercase font-bold tracking-widest text-slate-400 hover:text-[#1B3A5C] transition-all underline decoration-2">
          Return to Hub
        </button>
      </div>
    );
  }

  if (testState.status === 'COMPLETED') {
    return (
      <div className="min-h-screen bg-[#FAFAF6] flex items-center justify-center p-6">
        <div className="text-center max-w-sm bg-white border border-[#E5E3DD] rounded-3xl p-10 shadow-xl space-y-6">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold font-serif text-[#1B3A5C]">Workspace Captured</h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your explanation maps and structural reasoning vectors have been compiled into the parental telemetry hub.
            </p>
          </div>
          <button onClick={() => router.push('/profile')} className="w-full bg-[#1B3A5C] hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider py-4 rounded-xl transition-all shadow-sm">
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!activeQuestion) return null;

  return (
    <main className="min-h-screen bg-[#FAFAF6] text-[#1B3A5C] flex flex-col items-center justify-between p-6 md:p-12 font-sans selection:bg-amber-100">
      <div className="max-w-3xl w-full flex-1 flex flex-col justify-center space-y-6">
        
        {/* Workspace Context Tracker */}
        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
            <span>Interactive Diagnostic Space</span>
          </div>
          <span className="bg-white px-4 py-1.5 rounded-full border border-[#E5E3DD] shadow-sm text-[#1B3A5C] font-mono">
            Exercise {testState.currentIndex + 1}
          </span>
        </div>

        {/* Primary Interaction Surface */}
        <div className={`bg-white rounded-[2.5rem] border border-[#E5E3DD] p-8 md:p-12 shadow-sm transition-all duration-500 relative flex flex-col justify-between overflow-hidden min-h-[500px] ${
          uiState === 'RECORDING' ? 'border-rose-400 shadow-[0_20px_50px_rgba(225,29,72,0.04)]' : ''
        }`}>
          {/* Audio Visualization Line */}
          {uiState === 'RECORDING' && (
            <div className="absolute top-0 inset-x-0 h-1 flex gap-1 justify-center overflow-hidden">
              {[...Array(32)].map((_, i) => (
                <div key={i} className="w-1 bg-rose-500 h-full rounded-full animate-bounce" style={{ animationDelay: `${i * 0.04}s`, animationDuration: '0.5s' }} />
              ))}
            </div>
          )}

          <div className="space-y-8">
            {/* The KaTeX Core Core Query */}
            <div className="text-xl md:text-2xl text-slate-800 leading-relaxed font-serif font-medium text-balance">
              {renderLatexString(activeQuestion.question)}
            </div>

            {/* Static Exhibition Grid (Non-Clickable Displays) */}
            {parsedOptions.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {parsedOptions.map((opt) => (
                  <div 
                    key={opt.label} 
                    className="p-5 bg-[#FAFAF6]/40 rounded-2xl border border-[#E5E3DD] text-[#1B3A5C] flex items-center gap-4 shadow-sm"
                  >
                    <span className="w-7 h-7 rounded-lg bg-white border border-[#E5E3DD] flex items-center justify-center font-bold text-slate-400 text-xs shadow-inner">
                      {opt.label}
                    </span>
                    <div className="text-base font-medium overflow-x-auto pt-0.5">
                      {renderLatexString(opt.value)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Core Input Stack */}
          <div className="space-y-6 mt-8">
            
            {/* The Active Workspace Scratchpad Container */}
            <div className={`transition-all duration-500 ease-in-out overflow-hidden ${
              hasRecordedOnce || uiState === 'RECORDING' || uiState === 'ANALYZING_AUDIO' 
                ? 'max-h-64 opacity-100' 
                : 'max-h-0 opacity-0 pointer-events-none'
            }`}>
              <div className="bg-[#FAFAF6] border border-[#E5E3DD] rounded-2xl p-5 space-y-2 relative shadow-inner">
                <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <AlertCircle className="w-3 h-3 text-[#1B3A5C]" />
                    Tutor Workspace Scratchpad (Review or edit your spoken thought track below)
                  </span>
                  {uiState === 'ANALYZING_AUDIO' && <span className="text-amber-600 animate-pulse font-bold">Appending transcription...</span>}
                </div>
                
                <textarea 
                  value={transcript}
                  placeholder={
                    uiState === 'RECORDING' ? "Listening... Talk through your steps, rules, or reasons out loud." : 
                    uiState === 'ANALYZING_AUDIO' ? "Aligning cognitive audio frames..." : 
                    "Spoken text compiles here. You can click into this area to type-adjust your ideas before submitting."
                  }
                  onChange={(e) => setTranscript(e.target.value)}
                  disabled={uiState === 'RECORDING' || uiState === 'ANALYZING_AUDIO' || uiState === 'SUBMITTING'}
                  className="w-full bg-transparent text-[#1B3A5C] outline-none resize-none h-24 text-sm leading-relaxed placeholder-slate-300 disabled:opacity-60"
                />
              </div>
            </div>

            {/* Interface Control Row */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                onClick={handleMicToggle}
                disabled={uiState === 'ANALYZING_AUDIO' || uiState === 'SUBMITTING'}
                className={`flex-[2] py-4.5 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2.5 border border-[#E5E3DD] shadow-sm ${
                  uiState === 'RECORDING' 
                    ? 'bg-rose-500 text-white border-rose-600 shadow-md' 
                    : uiState === 'ANALYZING_AUDIO'
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed animate-pulse'
                    : 'bg-white text-slate-600 hover:border-[#1B3A5C] hover:text-[#1B3A5C] hover:bg-slate-50'
                }`}
              >
                {uiState === 'RECORDING' ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-white text-white" />
                    Pause & Process Explanation
                  </>
                ) : uiState === 'ANALYZING_AUDIO' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                    Parsing Cognitive Signals
                  </>
                ) : (
                  <>
                    <Mic className="w-3.5 h-3.5 text-[#1B3A5C]" />
                    {hasRecordedOnce ? 'Talk more to expand your answer' : 'Talk through your working out'}
                  </>
                )}
              </button>

              {hasRecordedOnce && (
                <button 
                  onClick={handleCommitAnswer} 
                  disabled={uiState === 'ANALYZING_AUDIO' || uiState === 'SUBMITTING' || !transcript.trim()}
                  className="flex-1 bg-[#1B3A5C] hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-4.5 rounded-2xl transition-all shadow-md flex items-center justify-center gap-1 text-xs uppercase tracking-wider"
                >
                  {uiState === 'SUBMITTING' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Save Thinking Layout <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Global Structural Pause Control */}
        <div className="text-center">
          <button
            onClick={() => window.location.href = '/profile'}
            className="text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all inline-flex items-center gap-1.5"
          >
            <PauseCircle className="w-3.5 h-3.5" />
            Pause Intake & Exit Safely
          </button>
        </div>
      </div>
    </main>
  );
}

export default function TestPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FAFAF6] flex items-center justify-center font-mono text-xs tracking-widest uppercase text-slate-400 animate-pulse">
        Mounting Intake Architecture...
      </div>
    }>
      <DiagnosticRunner />
    </Suspense>
  );
}