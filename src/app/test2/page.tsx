// app/test/page.tsx
'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useAudioRecorder } from '@/hooks/useAudioRecorder'; 
import 'katex/dist/katex.min.css';
import { InlineMath } from 'react-katex';

type TestState = 'LOADING' | 'IDLE' | 'RECORDING' | 'ANALYZING_AUDIO' | 'SUBMITTING';

export default function DiagnosticEngine() {
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  const [uiState, setUiState] = useState<TestState>('LOADING');
  // Renamed to 'variant' to match the database table exactly
  const [variant, setVariant] = useState<any>(null);
  const [transcript, setTranscript] = useState('');
  const [hasRecordedOnce, setHasRecordedOnce] = useState(false);
  
  const timeLoaded = useRef<number>(0);
  const timeStartedRecording = useRef<number>(0);
  const isVttTracked = useRef(false);
  
  const { startRecording, stopRecording } = useAudioRecorder();

  const parsedOptions = useMemo(() => {
    if (!variant || !variant.generated_options) return [];
    const optionsObj = typeof variant.generated_options === 'string' 
      ? JSON.parse(variant.generated_options) 
      : variant.generated_options;

    return Object.entries(optionsObj).map(([key, val]) => ({
      label: key, 
      value: val as string 
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, [variant]);

  const fetchRandomVariant = async () => {
    setUiState('LOADING');
    setTranscript(''); 
    setHasRecordedOnce(false); 
    isVttTracked.current = false;
    
    try {
      const { data, error } = await supabase
        .from('variants')
        .select('*')
        .limit(50); 

      if (error) throw error;

      if (data && data.length > 0) {
        const randomIndex = Math.floor(Math.random() * data.length);
        setVariant(data[randomIndex]);
        
        timeLoaded.current = Date.now();
        setUiState('IDLE');
      } else {
        alert("Variants table is currently empty!");
      }
    } catch (err) {
      console.error("Failed to fetch variant:", err);
    }
  };

  useEffect(() => {
    fetchRandomVariant();
  }, [supabase]);

  const handleMicToggle = async () => {
    if (uiState === 'IDLE') {
      isVttTracked.current = true; 
      timeStartedRecording.current = Date.now();
      
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
          setTranscript(result.text || '');
          setHasRecordedOnce(true);
        } catch (err) {
          console.error("Transcription error:", err);
          alert("Could not process speech.");
        } finally {
          setUiState('IDLE');
        }
      } else {
        setUiState('IDLE');
      }
    }
  };

  const handleSubmit = async () => {
    if (!transcript.trim()) {
      alert("Please provide an explanation before submitting.");
      return;
    }

    setUiState('SUBMITTING');
    const submissionTime = Date.now();

    const comprehensionSeconds = timeStartedRecording.current > 0 
      ? parseFloat(((timeStartedRecording.current - timeLoaded.current) / 1000).toFixed(2))
      : parseFloat(((submissionTime - timeLoaded.current) / 1000).toFixed(2));

    const solveSeconds = timeStartedRecording.current > 0
      ? parseFloat(((submissionTime - timeStartedRecording.current) / 1000).toFixed(2))
      : 0;

    try {
      const response = await fetch('/api/save-attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variant_id: variant.id,         // Sends the exact ID of the variant row
          skeleton_id: variant.skeleton_id, // Sends the parent skeleton ID
          transcript: transcript,
          is_vtt: isVttTracked.current,
          comprehension_time: comprehensionSeconds,
          solve_time: solveSeconds
        }),
      });

      if (!response.ok) throw new Error("Evaluation submission failed.");
      await fetchRandomVariant();
    } catch (err) {
      console.error("Submission error:", err);
      alert("Failed to evaluate attempt.");
      setUiState('IDLE');
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <div className="max-w-2xl w-full">
        <div className="flex justify-between items-center mb-6 opacity-60 text-xs font-bold uppercase tracking-wider text-slate-500">
          <span>Diagnostic Workspace</span>
          <span>{uiState === 'LOADING' ? 'Connecting...' : 'Active Test'}</span>
        </div>

        <div className={`bg-white rounded-[2rem] shadow-sm border border-slate-200 p-10 md:p-14 transition-all duration-700 ease-in-out ${
            uiState === 'RECORDING' ? 'shadow-xl shadow-blue-950/5 scale-[1.01] border-blue-100' : ''
          }`}
        >
          {uiState === 'LOADING' || !variant ? (
            <div className="h-40 flex items-center justify-center">
              <div className="animate-pulse flex gap-2">
                <div className="w-3 h-3 bg-slate-300 rounded-full"></div>
                <div className="w-3 h-3 bg-slate-300 rounded-full animate-bounce"></div>
                <div className="w-3 h-3 bg-slate-300 rounded-full"></div>
              </div>
            </div>
          ) : (
            <>
              {/* Image rendering block completely removed here */}

              <h2 className="text-xl md:text-2xl text-slate-800 leading-relaxed font-medium mb-6">
                {(variant.generated_question || "").split('$').map((part: string, i: number) => 
                  i % 2 === 1 ? <InlineMath key={i} math={part} /> : <span key={i}>{part}</span>
                )}
              </h2>

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
                      <div className="overflow-x-auto">
                        {opt.value.split('$').map((part: string, i: number) => 
                          i % 2 === 1 ? <InlineMath key={i} math={part} /> : <span key={i}>{part}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className={`transition-all duration-500 overflow-hidden ${
                hasRecordedOnce || uiState === 'RECORDING' || uiState === 'ANALYZING_AUDIO' ? 'max-h-64 opacity-100 mb-8' : 'max-h-0 opacity-0 pointer-events-none'
              }`}>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                  Your Explanation:
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

                {hasRecordedOnce && (
                  <button 
                    onClick={handleSubmit} 
                    disabled={uiState === 'ANALYZING_AUDIO' || uiState === 'SUBMITTING'}
                    className="flex-1 bg-slate-900 hover:bg-black disabled:bg-slate-300 text-white font-bold py-5 rounded-2xl shadow-lg transition-all active:scale-95"
                  >
                    {uiState === 'SUBMITTING' ? 'Evaluating...' : 'Submit Answer'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}