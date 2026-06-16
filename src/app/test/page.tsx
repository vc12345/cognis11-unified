'use client';

import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';

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

// Shared KaTeX Delimiter Configuration
const latexDelimiters = [
  { left: '$$', right: '$$', display: true },
  { left: '\\(', right: '\\)', display: false },
  { left: '$', right: '$', display: false },
  { left: '\\[', right: '\\]', display: true },
];

// --- CORE TEST RUNNER COMPONENT ---
function DiagnosticRunner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // 1. Core Engine State
  const [testState, setTestState] = useState<TestState>({
    status: 'INITIALIZING',
    sessionId: null,
    payload: [],
    currentIndex: 0,
    errorMessage: '',
  });

  // 2. Interactive UI State
  const [uiState, setUiState] = useState<UIState>('IDLE');
  const [transcript, setTranscript] = useState('');
  const [hasRecordedOnce, setHasRecordedOnce] = useState(false);
  
  // 3. Telemetry Timers & Audio Hooks
  const questionStartTime = useRef<number>(0);
  const { startRecording, stopRecording } = useAudioRecorder();

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  // --- STAGE 1: HYDRATE THE SESSION NETWORK ---
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

  // --- STAGE 2: DYNAMIC OPTIONS PARSING ---
  const activeQuestion = testState.payload[testState.currentIndex];
  
  const parsedOptions = useMemo(() => {
    if (!activeQuestion || !activeQuestion.options) return [];
    
    // Safely handle both pre-parsed objects and JSON strings from the database
    const optionsObj = typeof activeQuestion.options === 'string' 
      ? JSON.parse(activeQuestion.options) 
      : activeQuestion.options;

    return Object.entries(optionsObj).map(([key, val]) => ({
      label: key, 
      value: String(val)
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, [activeQuestion]);

  // --- STAGE 3: INTERACTIVE HANDLERS ---
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
          
          // Append transcript rather than overwrite, allowing multi-part explanations
          setTranscript(prev => prev ? `${prev} ${result.text}` : result.text);
          setHasRecordedOnce(true);
        } catch (err) {
          console.error("Transcription error:", err);
          alert("Could not process speech. You may type your answer manually.");
          setHasRecordedOnce(true); // Reveal the box anyway so they aren't stuck
        } finally {
          setUiState('IDLE');
        }
      } else {
        setUiState('IDLE');
      }
    }
  };

  const handleCommitAnswer = async () => {
    if (!transcript.trim()) {
      alert("Please provide an explanation before submitting.");
      return;
    }

    setUiState('SUBMITTING');

    const timeSpentMs = Date.now() - questionStartTime.current;
    const timeSpentSeconds = Math.round(timeSpentMs / 1000);

    // Fire Background Telemetry (Does not block UI)
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

    // Advance Engine State
    const nextIndex = testState.currentIndex + 1;
    
    if (nextIndex >= testState.payload.length) {
      setTestState(prev => ({ ...prev, status: 'COMPLETED' }));
    } else {
      setTestState(prev => ({ ...prev, currentIndex: nextIndex }));
      // Reset Interactive UI for the next question
      setTranscript('');
      setHasRecordedOnce(false);
      setUiState('IDLE');
      questionStartTime.current = Date.now();
    }
  };

  // --- RENDER ROUTING ---
  if (testState.status === 'INITIALIZING') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="animate-pulse flex gap-2">
          <div className="w-3 h-3 bg-slate-300 rounded-full"></div>
          <div className="w-3 h-3 bg-slate-300 rounded-full animate-bounce"></div>
          <div className="w-3 h-3 bg-slate-300 rounded-full"></div>
        </div>
      </div>
    );
  }

  if (testState.status === 'ERROR') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-mono space-y-4">
        <div className="text-xs tracking-widest uppercase text-red-600 font-bold border border-red-200 bg-red-50 px-6 py-4">
          SYSTEM FAULT: {testState.errorMessage}
        </div>
        <button onClick={() => router.push('/test-initiate')} className="text-[10px] uppercase tracking-widest text-slate-500 hover:text-slate-900 underline">
          Return to Hub
        </button>
      </div>
    );
  }

  if (testState.status === 'COMPLETED') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="text-center space-y-4 max-w-md px-6">
          <div className="w-12 h-12 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-8"></div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Diagnostic Concluded</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            The assessment is being reviewed.<br/>The telemetry dashboard will update shortly.
          </p>
          <div className="pt-12">
            <button onClick={() => router.push('/dashboard')} className="text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors">
              [ Terminate Session & Return ]
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!activeQuestion) return null;

  // --- MAIN EVALUATION CANVAS ---
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-2xl w-full">
        
        {/* Header Block */}
        <div className="flex justify-between items-center mb-6 opacity-80 text-xs font-bold uppercase tracking-wider text-slate-500">
          <span>Diagnostic Workspace</span>
          <span>Sequence {testState.currentIndex + 1} / {testState.payload.length}</span>
        </div>

        {/* Question Container */}
        <div className={`bg-white rounded-[2rem] shadow-sm border border-slate-200 p-10 md:p-14 transition-all duration-700 ease-in-out ${
            uiState === 'RECORDING' ? 'shadow-xl shadow-blue-950/5 scale-[1.01] border-blue-100' : ''
          }`}
        >
          {/* Question Text */}
          <h2 className="text-xl md:text-2xl text-slate-800 leading-relaxed font-medium mb-8">
            <BlockMath math={activeQuestion.question} />
          </h2>

          {/* Options Grid */}
          {parsedOptions.length > 0 && (
            <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {parsedOptions.map((opt) => (
                <div 
                  key={opt.label} 
                  className="p-4 bg-slate-50 rounded-xl border border-slate-200/60 text-slate-700 text-sm font-medium flex items-center gap-3 shadow-sm"
                >
                  <span className="w-6 h-6 rounded-md bg-white border border-slate-200 shadow-sm flex items-center justify-center font-bold text-slate-500 text-xs shrink-0">
                    {opt.label}
                  </span>
                  <div className="overflow-x-auto text-base">
                    <InlineMath math={opt.value} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Transcript / Text Input Area */}
          <div className={`transition-all duration-500 overflow-hidden ${
            hasRecordedOnce || uiState === 'RECORDING' || uiState === 'ANALYZING_AUDIO' 
              ? 'max-h-64 opacity-100 mb-8' 
              : 'max-h-0 opacity-0 pointer-events-none'
          }`}>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex justify-between">
              <span>Your Explanation:</span>
              {(uiState === 'RECORDING' || uiState === 'ANALYZING_AUDIO') && (
                <span className="text-blue-500 animate-pulse">Processing...</span>
              )}
            </label>
            <textarea 
              value={transcript}
              placeholder={
                uiState === 'RECORDING' ? "Listening..." : 
                uiState === 'ANALYZING_AUDIO' ? "Converting voice to text..." : 
                "Review your text here. You can make adjustments or type changes directly if needed."
              }
              onChange={(e) => setTranscript(e.target.value)}
              disabled={uiState === 'RECORDING' || uiState === 'ANALYZING_AUDIO' || uiState === 'SUBMITTING'}
              className="w-full bg-slate-50 text-slate-700 p-4 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:bg-white transition-colors resize-none h-28 text-sm leading-relaxed"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={handleMicToggle}
              disabled={uiState === 'ANALYZING_AUDIO' || uiState === 'SUBMITTING'}
              className={`flex-[2] py-5 rounded-2xl font-bold transition-all duration-300 flex items-center justify-center gap-3 ${
                uiState === 'RECORDING' 
                  ? 'bg-red-50 text-red-600 border-2 border-red-200 animate-pulse shadow-inner' 
                  : uiState === 'ANALYZING_AUDIO'
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed animate-pulse'
                  : 'bg-white border-2 border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600 hover:shadow-md'
              }`}
            >
              <span className="text-2xl">
                {uiState === 'RECORDING' ? '⏹' : uiState === 'ANALYZING_AUDIO' ? '⏳' : '🎤'}
              </span>
              {uiState === 'RECORDING' ? 'Stop Recording' : uiState === 'ANALYZING_AUDIO' ? 'Transcribing...' : 'Talk us through your working'}
            </button>

            {/* If they haven't recorded yet, let them opt to type */}
            {!hasRecordedOnce && uiState === 'IDLE' && (
              <button 
                onClick={() => setHasRecordedOnce(true)}
                className="flex-1 bg-transparent text-slate-400 font-bold py-5 rounded-2xl transition-all hover:text-slate-600 underline text-sm"
              >
                Prefer to type?
              </button>
            )}

            {/* Submission Trigger */}
            {hasRecordedOnce && (
              <button 
                onClick={handleCommitAnswer} 
                disabled={uiState === 'ANALYZING_AUDIO' || uiState === 'SUBMITTING'}
                className="flex-1 bg-slate-900 hover:bg-black disabled:bg-slate-300 text-white font-bold py-5 rounded-2xl shadow-lg transition-all active:scale-95"
              >
                {uiState === 'SUBMITTING' ? 'Evaluating...' : 'Submit Answer'}
              </button>
            )}
          </div>

        </div>

        {/* Global Pause Action */}
        <div className="mt-8 text-center">
          <button
            onClick={async () => {
              // Save current session checkpoint states to database here if needed
              window.location.href = '/profile'; 
            }}
            className="px-5 py-2.5 bg-amber-50 border border-amber-300 text-amber-900 hover:bg-amber-100 font-bold text-[11px] uppercase tracking-widest rounded-lg transition-all shadow-sm flex items-center gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Pause Diagnostic Session
          </button>
        </div>
      </div>
    </main>
  );
}

// Wrapper to satisfy Next.js client-side Suspense boundary requirements for searchParams
export default function TestPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-mono text-xs tracking-widest uppercase text-slate-400">
        Mounting Core...
      </div>
    }>
      <DiagnosticRunner />
    </Suspense>
  );
}