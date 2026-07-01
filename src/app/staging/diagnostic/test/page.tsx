'use client';

import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { 
  Mic, Square, Loader2, Sparkles, AlertCircle, CheckCircle2, 
  ArrowRight, PauseCircle, Brain, Volume2, HelpCircle, Smile, Frown, Award
} from 'lucide-react';

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

// Scaffolding Sub-steps for the active question
type ScaffoldingStep = 1 | 2 | 3;

type UIState = 'IDLE' | 'RECORDING' | 'ANALYZING_AUDIO' | 'SUBMITTING' | 'COMPILING_SUMMARY';

// --- META COPY GUIDE FOR THE CHILD ---
const SCAFFOLD_CONFIG = {
  1: {
    title: "Step 1: Spot the Goal",
    prompt: "Read the question out loud, then tell me: what is this puzzle asking you to find?",
    placeholder: "Listening to you read and find the target goal...",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200"
  },
  2: {
    title: "Step 2: Form a Game Plan",
    prompt: "Don't do any math yet! In your own words, what is your step-by-step plan to solve this?",
    placeholder: "Tell me your strategy game plan...",
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200"
  },
  3: {
    title: "Step 3: Solve & Reflect",
    prompt: "Grab your pen and paper! Solve it out loud step-by-step, then pick your answer and tell me how you feel.",
    placeholder: "Talk through your calculations all the way to your final answer...",
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200"
  }
};

const renderLatexString = (text: string) => {
  if (!text) return null;
  const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);
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
  
  // Core Test States
  const [testState, setTestState] = useState<TestState>({
    status: 'INITIALIZING',
    sessionId: null,
    payload: [],
    currentIndex: 0,
    errorMessage: '',
  });

  // Scaffolding Interface Engines
  const [currentStep, setCurrentStep] = useState<ScaffoldingStep>(1);
  const [transcripts, setTranscripts] = useState({ step1: '', step2: '', step3: '' });
  const [confidence, setConfidence] = useState<'low' | 'medium' | 'high' | null>(null);

  // UI Engine States
  const [uiState, setUiState] = useState<UIState>('IDLE');
  const [hasRecordedCurrentStep, setHasRecordedCurrentStep] = useState(false);
  
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
          if (!res.ok) throw new Error(data.error || 'Failed to generate payload');

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
          if (!res.ok) throw new Error(data.error || 'Failed to restore session');

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

  // Current active step transcript manager
  const currentTranscriptValue = useMemo(() => {
    if (currentStep === 1) return transcripts.step1;
    if (currentStep === 2) return transcripts.step2;
    return transcripts.step3;
  }, [currentStep, transcripts]);

  const updateCurrentTranscriptValue = (val: string) => {
    setTranscripts(prev => ({
      ...prev,
      [currentStep === 1 ? 'step1' : currentStep === 2 ? 'step2' : 'step3']: val
    }));
  };

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
          
          const currentText = currentTranscriptValue;
          const mergedText = currentText ? `${currentText} ${result.text}` : result.text;
          updateCurrentTranscriptValue(mergedText);
          setHasRecordedCurrentStep(true);
        } catch (err) {
          console.error("Transcription error:", err);
          alert("Could not process your voice cleanly. Feel free to adjust the notes area by hand using your keyboard!");
          setHasRecordedCurrentStep(true);
        } finally {
          setUiState('IDLE');
        }
      } else {
        setUiState('IDLE');
      }
    }
  };

  const handleAdvanceStep = () => {
    if (currentStep < 3) {
      setCurrentStep((prev) => (prev + 1) as ScaffoldingStep);
      setHasRecordedCurrentStep(false);
    } else {
      handleCommitAnswer();
    }
  };

  const handleCommitAnswer = async () => {
    if (uiState === 'SUBMITTING' || uiState === 'COMPILING_SUMMARY') return;
    setUiState('SUBMITTING');

    const timeSpentMs = Date.now() - questionStartTime.current;
    const timeSpentSeconds = Math.round(timeSpentMs / 1000);

    try {
      // NOTE: For now, keeping core synchronization call structure intact 
      const saveResponse = await fetch('/api/save-attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: testState.sessionId,
          variant_id: activeQuestion.variant_id,
          raw_answer: JSON.stringify({ ...transcripts, confidence }), 
          execution_velocity_seconds: timeSpentSeconds,
        })
      });

      if (!saveResponse.ok) {
        console.error("Sync error encountered during data save pipeline loop.");
      }

      const nextIndex = testState.currentIndex + 1;
      
      if (nextIndex >= testState.payload.length) {
        setUiState('COMPILING_SUMMARY');
        const compilationResponse = await fetch('/api/compile-cognitive-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: testState.sessionId })
        });

        if (!compilationResponse.ok) throw new Error("Global core model extraction error.");

        setTestState(prev => ({ ...prev, status: 'COMPLETED' }));
        setUiState('IDLE');
      } else {
        // Reset sub-state metrics for the next incoming problem architecture block
        setTestState(prev => ({ ...prev, currentIndex: nextIndex }));
        setTranscripts({ step1: '', step2: '', step3: '' });
        setConfidence(null);
        setCurrentStep(1);
        setHasRecordedCurrentStep(false);
        setUiState('IDLE');
        questionStartTime.current = Date.now();
      }
    } catch (err: any) {
      console.error("Critical engine crash:", err);
      alert("A synchronization dropout happened. Please re-tap the submission button.");
      setUiState('IDLE');
    }
  };

  if (testState.status === 'INITIALIZING') {
    return (
      <div className="min-h-screen bg-[#FAFAF6] flex flex-col items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-[#1B3A5C] animate-spin" />
          <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Loading Diagnostic Hub...</span>
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

  if (uiState === 'COMPILING_SUMMARY') {
    return (
      <div className="min-h-screen bg-[#FAFAF6] flex items-center justify-center p-6 font-sans">
        <div className="text-center max-w-md bg-white border border-[#E5E3DD] rounded-3xl p-10 shadow-xl space-y-6 flex flex-col items-center">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center border border-amber-200 animate-pulse">
            <Brain className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold font-serif text-[#1B3A5C]">Building Your Thought-Map Summary</h1>
            <p className="text-xs text-slate-400 leading-relaxed text-balance">
              Excellent job! We're analyzing how you read rules, map your plans, and walk through math steps to draw your custom diagnostic pattern guide.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-slate-400 tracking-widest">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" /> Translating voice signals...
          </div>
        </div>
      </div>
    );
  }

  if (testState.status === 'COMPLETED') {
    return (
      <div className="min-h-screen bg-[#FAFAF6] flex items-center justify-center p-6 font-sans">
        <div className="text-center max-w-sm bg-white border border-[#E5E3DD] rounded-3xl p-10 shadow-xl space-y-6">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold font-serif text-[#1B3A5C]">All Done!</h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your comprehensive cognitive thought report is ready. Let's look at how your brain breaks down logic traps!
            </p>
          </div>
          <button 
            onClick={() => router.push('/staging/diagnostic/dashboard')} 
            className="w-full bg-[#1B3A5C] hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider py-4 rounded-xl transition-all shadow-sm"
          >
            Open Performance Command Canvas
          </button>
        </div>
      </div>
    );
  }

  if (!activeQuestion) return null;

  return (
    <main className="min-h-screen bg-[#FAFAF6] text-[#1B3A5C] font-sans flex flex-col items-center justify-between p-4 md:p-8 selection:bg-amber-100">
      <div className="max-w-3xl w-full flex-1 flex flex-col justify-center space-y-4">
        
        {/* TOP METRIC PROGRESS CONTROLLER */}
        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
            <span>Active Cognitive Extraction Space</span>
          </div>
          <span className="bg-white px-4 py-1.5 rounded-full border border-[#E5E3DD] shadow-sm text-[#1B3A5C] font-mono">
            Puzzle {testState.currentIndex + 1} / {testState.payload.length}
          </span>
        </div>

        {/* PRIMARY PUZZLE CANVAS PANEL */}
        <div className="bg-white rounded-[2rem] border border-[#E5E3DD] p-6 md:p-10 shadow-sm space-y-6">
          
          {/* Main Question Display block */}
          <div className="space-y-6 border-b border-slate-100 pb-6">
            <div className="text-xl md:text-2xl text-slate-800 leading-relaxed font-serif font-medium text-balance">
              {renderLatexString(activeQuestion.question)}
            </div>

            {parsedOptions.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {parsedOptions.map((opt) => (
                  <div 
                    key={opt.label} 
                    className="p-4 bg-[#FAFAF6]/40 rounded-xl border border-[#E5E3DD] text-[#1B3A5C] flex items-center gap-4 shadow-sm"
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

          {/* SCAFFOLDING GUIDANCE INTERACTION DECK */}
          <div className="space-y-6 pt-2">
            
            {/* SUB-STEP INDICATOR HUB */}
            <div className="flex items-center justify-between bg-slate-50 border border-slate-100 p-3 rounded-2xl">
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${SCAFFOLD_CONFIG[currentStep].badgeColor}`}>
                  {SCAFFOLD_CONFIG[currentStep].title}
                </span>
              </div>
              
              {/* Animated Progress Pills */}
              <div className="flex items-center gap-1.5">
                {([1, 2, 3] as ScaffoldingStep[]).map((stepIdx) => (
                  <div 
                    key={stepIdx}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      currentStep === stepIdx 
                        ? 'w-8 bg-[#1B3A5C]' 
                        : currentStep > stepIdx 
                        ? 'w-3 bg-emerald-500' 
                        : 'w-3 bg-slate-200'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* LIVE CONVERSATIONAL COACH PROMPT HEADER */}
            <div className="flex items-start gap-3 bg-amber-50/40 border border-amber-100/70 rounded-2xl p-4">
              <Volume2 className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-serif font-medium text-slate-800 leading-relaxed">
                "{SCAFFOLD_CONFIG[currentStep].prompt}"
              </p>
            </div>

            {/* SPEECH TEXT MONITOR ARTIFACT VIEW */}
            <div className={`transition-all duration-500 ease-in-out overflow-hidden ${
              hasRecordedCurrentStep || uiState === 'RECORDING' || uiState === 'ANALYZING_AUDIO' 
                ? 'max-h-48 opacity-100' 
                : 'max-h-0 opacity-0 pointer-events-none'
            }`}>
              <div className="bg-[#FAFAF6] border border-[#E5E3DD] rounded-2xl p-4 space-y-2 relative shadow-inner">
                <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <AlertCircle className="w-3 h-3 text-[#1B3A5C]" />
                    Interactive Audio Catchpad (Edit your notes anytime if needed)
                  </span>
                  {uiState === 'ANALYZING_AUDIO' && <span className="text-amber-600 animate-pulse font-bold">Transcribing...</span>}
                </div>
                
                <textarea 
                  value={currentTranscriptValue}
                  placeholder={SCAFFOLD_CONFIG[currentStep].placeholder}
                  onChange={(e) => updateCurrentTranscriptValue(e.target.value)}
                  disabled={uiState === 'RECORDING' || uiState === 'ANALYZING_AUDIO' || uiState === 'SUBMITTING'}
                  className="w-full bg-transparent text-[#1B3A5C] outline-none resize-none h-20 text-sm leading-relaxed placeholder-slate-300 disabled:opacity-60"
                />
              </div>
            </div>

            {/* STEP 3 OPTIONAL: METACOGNITIVE CONFIDENCE BLOCK */}
            {currentStep === 3 && hasRecordedCurrentStep && (
              <div className="bg-purple-50/30 border border-purple-100 p-4 rounded-2xl space-y-3 animate-fade-in">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-900 flex items-center gap-1">
                  <Award className="w-3.5 h-3.5" /> How sure do you feel about this answer?
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(['low', 'medium', 'high'] as const).map((level) => {
                    const active = confidence === level;
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setConfidence(level)}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all capitalize flex items-center justify-center gap-1.5 ${
                          active 
                            ? 'bg-[#1B3A5C] text-white border-[#1B3A5C] shadow-sm scale-[1.02]' 
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {level === 'low' && <Frown className="w-3.5 h-3.5" />}
                        {level === 'medium' && <HelpCircle className="w-3.5 h-3.5" />}
                        {level === 'high' && <Smile className="w-3.5 h-3.5" />}
                        {level === 'low' ? 'Not Sure' : level === 'medium' ? 'Pretty Close' : 'Got It!'}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* AUDIO RECORDING CONTROL ROW */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button 
                onClick={handleMicToggle}
                disabled={uiState === 'ANALYZING_AUDIO' || uiState === 'SUBMITTING'}
                className={`flex-[2] py-4 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2.5 border border-[#E5E3DD] shadow-sm ${
                  uiState === 'RECORDING' 
                    ? 'bg-rose-500 text-white border-rose-600 shadow-md ring-4 ring-rose-100' 
                    : uiState === 'ANALYZING_AUDIO'
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed animate-pulse'
                    : 'bg-white text-[#1B3A5C] border-slate-200 hover:border-[#1B3A5C] hover:bg-slate-50/60'
                }`}
              >
                {uiState === 'RECORDING' ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-white text-white" />
                    Stop & Listen to My Notes
                  </>
                ) : uiState === 'ANALYZING_AUDIO' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                    Processing Voice Path...
                  </>
                ) : (
                  <>
                    <Mic className="w-3.5 h-3.5" />
                    {hasRecordedCurrentStep ? 'Tap to speak more thoughts' : 'Tap mic and explain your step'}
                  </>
                )}
              </button>

              {/* ACTION NAVIGATION TRIGGER TRIGGERBUTTON */}
              {(hasRecordedCurrentStep || currentTranscriptValue.trim().length > 0) && (
                <button 
                  onClick={handleAdvanceStep} 
                  disabled={uiState === 'ANALYZING_AUDIO' || uiState === 'SUBMITTING' || (currentStep === 3 && !confidence)}
                  className="flex-1 bg-[#1B3A5C] hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold py-4 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
                >
                  {uiState === 'SUBMITTING' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : currentStep === 3 ? (
                    <>
                      Submit Final Puzzle Path <CheckCircle2 className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      Next: {SCAFFOLD_CONFIG[(currentStep + 1) as ScaffoldingStep].title.split(':')[1]} <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

        </div>

        {/* CONTROLLER PAUSE LEAVE RUNTIME ROW */}
        <div className="text-center">
          <button
            onClick={() => window.location.href = '/profile'}
            className="text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all inline-flex items-center gap-1.5"
          >
            <PauseCircle className="w-3.5 h-3.5" />
            Pause Evaluation & Return to Dashboard
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