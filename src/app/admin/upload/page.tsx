'use client';

import { useState, useMemo } from 'react';
import { createBrowserClient } from '@supabase/ssr';

type UploadState = 'idle' | 'loading' | 'success' | 'error';

interface PanelState {
  json: string;
  status: UploadState;
  message: string;
}

const INITIAL_PANEL: PanelState = {
  json: '',
  status: 'idle',
  message: '',
};

function StatusBadge({ status, message }: { status: UploadState; message: string }) {
  if (status === 'idle') return null;
  const styles: Record<string, string> = {
    loading: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    error: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  const icons: Record<string, string> = {
    loading: '⟳',
    success: '✓',
    error: '✕',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${styles[status]}`}>
      <span className={status === 'loading' ? 'animate-spin inline-block' : ''}>{icons[status]}</span>
      {message}
    </span>
  );
}

interface UploadPanelProps {
  label: string;
  accent: string;
  accentBg: string;
  accentBorder: string;
  accentText: string;
  placeholder: string;
  state: PanelState;
  onChange: (val: string) => void;
  onUpload: () => void;
  onClear: () => void;
}

function UploadPanel({
  label, accent, accentBg, accentBorder, accentText,
  placeholder, state, onChange, onUpload, onClear
}: UploadPanelProps) {
  const isSuccess = state.status === 'success';
  const isLoading = state.status === 'loading';

  return (
    <div className={`
      relative rounded-[2.5rem] border p-8 flex flex-col gap-5 transition-all duration-700
      ${isSuccess
        ? 'bg-emerald-950/40 border-emerald-500/30 shadow-[0_0_40px_-10px_rgba(16,185,129,0.15)]'
        : 'bg-slate-900/60 border-slate-800/60'}
    `}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${isSuccess ? 'bg-emerald-400' : accentBg} transition-colors duration-700`} />
          <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isSuccess ? 'text-emerald-400' : accentText} transition-colors duration-700`}>
            {label}
          </span>
        </div>
        <StatusBadge status={state.status} message={state.message} />
      </div>

      {/* Textarea */}
      <div className="relative">
        <textarea
          value={state.json}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={12}
          className={`
            w-full rounded-2xl p-5 text-xs font-mono leading-relaxed resize-none outline-none transition-all duration-700
            placeholder:text-slate-700 text-slate-200
            ${isSuccess
              ? 'bg-emerald-950/30 border border-emerald-500/20 focus:border-emerald-400/40'
              : `bg-slate-950/80 border border-slate-800 focus:border-${accent}-500/40`}
          `}
        />
        {isSuccess && (
          <div className="absolute inset-0 rounded-2xl pointer-events-none overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent" />
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onUpload}
          disabled={isLoading || !state.json.trim()}
          className={`
            flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-200
            active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed
            ${isSuccess
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30'
              : `bg-${accent}-600 hover:bg-${accent}-500 text-white shadow-lg shadow-${accent}-900/20`}
          `}
        >
          {isLoading ? 'Uploading...' : isSuccess ? '✓ Uploaded' : 'Upload'}
        </button>
        <button
          onClick={onClear}
          className="px-6 py-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[10px] font-black uppercase tracking-widest transition-all duration-200 active:scale-95 border border-slate-700"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

export default function WardenUploadPage() {
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  const [source, setSource] = useState<PanelState>({ ...INITIAL_PANEL });
  const [skeleton, setSkeleton] = useState<PanelState>({ ...INITIAL_PANEL });
  const [variant, setVariant] = useState<PanelState>({ ...INITIAL_PANEL });

  const parseJSON = (raw: string): { data: any; error: string | null } => {
    try {
      const data = JSON.parse(raw.trim());
      return { data, error: null };
    } catch (e: any) {
      return { data: null, error: `Invalid JSON: ${e.message}` };
    }
  };

  const handleUpload = async (
    state: PanelState,
    setState: (s: PanelState) => void,
    table: string,
    isArray?: boolean
  ) => {
    setState({ ...state, status: 'loading', message: 'uploading...' });

    const { data, error: parseError } = parseJSON(state.json);
    if (parseError) {
      setState({ ...state, status: 'error', message: parseError });
      return;
    }

    const records = isArray ? (Array.isArray(data) ? data : [data]) : [data];

    const { error } = await supabase.from(table).upsert(records);

    if (error) {
      setState({ ...state, status: 'error', message: error.message.slice(0, 40) });
    } else {
      const count = records.length;
      setState({
        ...state,
        status: 'success',
        message: `${count} record${count > 1 ? 's' : ''} saved`,
      });
    }
  };

  const handleClear = (setState: (s: PanelState) => void) => {
    setState({ ...INITIAL_PANEL });
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 antialiased">
      {/* Atmospheric background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-900/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-900/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-slate-900/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-8 py-12">

        {/* Header */}
        <header className="mb-14">
          <div className="flex items-start justify-between border-b border-slate-800/60 pb-10">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-violet-500 rounded-full" />
                <h1 className="text-3xl font-black italic uppercase text-white tracking-tighter">
                  The Warden
                </h1>
              </div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.25em] ml-4">
                Question Bank Upload Terminal
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-slate-600 font-mono uppercase tracking-widest">Pipeline</p>
              <div className="flex items-center gap-2 mt-2">
                {[
                  { label: 'SRC', color: 'bg-blue-500', active: source.status === 'success' },
                  { label: 'SKL', color: 'bg-violet-500', active: skeleton.status === 'success' },
                  { label: 'VAR', color: 'bg-amber-500', active: variant.status === 'success' },
                ].map(({ label, color, active }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full transition-all duration-700 ${active ? color : 'bg-slate-700'}`} />
                    <span className={`text-[8px] font-black uppercase tracking-widest transition-colors duration-700 ${active ? 'text-slate-300' : 'text-slate-700'}`}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-8 grid grid-cols-3 gap-4">
            {[
              { step: '01', text: 'Paste JSON from agent output into the relevant panel' },
              { step: '02', text: 'Click Upload — panel turns green on success' },
              { step: '03', text: 'Click Clear to reset a panel for the next record' },
            ].map(({ step, text }) => (
              <div key={step} className="flex items-start gap-3 bg-slate-900/40 rounded-2xl px-5 py-4 border border-slate-800/40">
                <span className="text-[9px] font-black text-slate-600 font-mono mt-0.5">{step}</span>
                <p className="text-[10px] text-slate-500 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </header>

        {/* Upload panels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Source Specification */}
          <UploadPanel
            label="Source Specification"
            accent="blue"
            accentBg="bg-blue-500"
            accentBorder="border-blue-500/30"
            accentText="text-blue-400"
            placeholder={`{\n  "id": "2025JMC01",\n  "year": 2025,\n  "source": "JMC",\n  "domain": "Number & arithmetic",\n  "concept": "...",\n  "curriculum_level": 5,\n  "application_complexity": "A1",\n  "linguistic_complexity": "L2",\n  "al_classification": "A1L2",\n  "verbatim_question": "...",\n  "verbatim_solution": "...",\n  "associated_images": [],\n  "added_date": "2026-05-19",\n  "updated_date": "2026-05-19"\n}`}
            state={source}
            onChange={val => setSource({ ...source, json: val })}
            onUpload={() => handleUpload(source, setSource, 'source_questions', false)}
            onClear={() => handleClear(setSource)}
          />

          {/* Skeleton Specification */}
          <UploadPanel
            label="Skeleton Specification"
            accent="violet"
            accentBg="bg-violet-500"
            accentBorder="border-violet-500/30"
            accentText="text-violet-400"
            placeholder={`{\n  "id": "SKL2025JMC01",\n  "source_question_id": "2025JMC01",\n  "mathematical_engine": "...",\n  "failure_map": {"W1": 0, "W2": 0},\n  "failure_profile": {\n    "W1": {"rating": "Low", "reason": "..."}\n  },\n  "trap_anatomy": "...",\n  "al_classification": "A1L2",\n  "variants_to_generate": ["A1L1","A2L1"],\n  "variant_constraints": {},\n  "same_al_variant": "VAR2025JMC01A1L2",\n  "approved": false,\n  "added_date": "2026-05-19",\n  "updated_date": "2026-05-19"\n}`}
            state={skeleton}
            onChange={val => setSkeleton({ ...skeleton, json: val })}
            onUpload={() => handleUpload(skeleton, setSkeleton, 'skeletons', false)}
            onClear={() => handleClear(setSkeleton)}
          />

          {/* Variant Specification */}
          <UploadPanel
            label="Variant Specification"
            accent="amber"
            accentBg="bg-amber-500"
            accentBorder="border-amber-500/30"
            accentText="text-amber-400"
            placeholder={`[\n  {\n    "id": "VAR2025JMC01A1L1",\n    "skeleton_id": "SKL2025JMC01",\n    "al_classification": "A1L1",\n    "generated_question": "...",\n    "generated_options": {\n      "A": "6", "B": "18",\n      "C": "30", "D": "45", "E": "48"\n    },\n    "correct_answer": "A",\n    "solution_trace": "...",\n    "consistency_check": "Passed.",\n    "qc_passed": false,\n    "added_date": "2026-05-19",\n    "updated_date": "2026-05-19"\n  }\n]`}
            state={variant}
            onChange={val => setVariant({ ...variant, json: val })}
            onUpload={() => handleUpload(variant, setVariant, 'variants', true)}
            onClear={() => handleClear(setVariant)}
          />

        </div>

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-slate-800/40 flex items-center justify-between">
          <p className="text-[9px] text-slate-700 font-mono uppercase tracking-widest">
            Records upserted on conflict — safe to re-upload
          </p>
          <div className="flex items-center gap-6">
            {[
              { label: 'Source', count: source.status === 'success' ? '✓' : '–', color: source.status === 'success' ? 'text-emerald-500' : 'text-slate-700' },
              { label: 'Skeleton', count: skeleton.status === 'success' ? '✓' : '–', color: skeleton.status === 'success' ? 'text-emerald-500' : 'text-slate-700' },
              { label: 'Variants', count: variant.status === 'success' ? '✓' : '–', color: variant.status === 'success' ? 'text-emerald-500' : 'text-slate-700' },
            ].map(({ label, count, color }) => (
              <div key={label} className="text-center">
                <p className={`text-sm font-black font-mono ${color} transition-colors duration-700`}>{count}</p>
                <p className="text-[8px] text-slate-700 uppercase tracking-widest">{label}</p>
              </div>
            ))}
          </div>
        </footer>

      </div>
    </main>
  );
}
