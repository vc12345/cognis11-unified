'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useSearchParams, useRouter } from 'next/navigation';
import 'katex/dist/katex.min.css';

function WardenContent() {
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  const searchParams = useSearchParams();
  const router = useRouter();
  const targetId = searchParams.get('id');

  const [queue, setQueue] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchData();
  }, [targetId]);

  const fetchData = async () => {
    setLoading(true);
    // Updated select to use 'weight' based on your DB schema
    const selectQuery = '*, conceptual_shells!questions_shell_id_fkey(id, weight, original_jmc_question, original_jmc_solution, original_image_url, original_image_desc)';
    
    if (targetId) {
      const { data } = await supabase
        .from('questions')
        .select(selectQuery)
        .eq('id', targetId)
        .single();
      if (data) setQueue([data]);
    } else {
      const { data } = await supabase
        .from('questions')
        .select(selectQuery)
        .eq('is_verified', false)
        .order('created_at', { ascending: true });
      if (data) setQueue(data || []);
    }
    setLoading(false);
  };

  const currentQuestion = queue[currentIndex];

  const handleImageUpload = async (file: File) => {
    if (!currentQuestion) return;
    setSaveStatus('uploading image...');

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `variants/${currentQuestion.id}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('question-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('question-images')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('questions')
        .update({ image_url: publicUrl })
        .eq('id', currentQuestion.id);

      if (updateError) throw updateError;

      const updatedQueue = [...queue];
      updatedQueue[currentIndex].image_url = publicUrl;
      setQueue(updatedQueue);
      setSaveStatus('image updated!');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (err: any) {
      alert(err.message);
      setSaveStatus('error');
    }
  };

  const handleUpdateText = async (val: string) => {
    if (!currentQuestion) return;
    setSaveStatus('saving...');
    const { error } = await supabase.from('questions').update({ content: val }).eq('id', currentQuestion.id);
    setSaveStatus(error ? 'error' : 'saved!');
    setTimeout(() => setSaveStatus(null), 2000);
  };

  const debouncedSave = (val: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => handleUpdateText(val), 800);
  };

  const nextInQueue = () => {
    if (targetId) {
      router.push('/admin'); 
      return;
    }
    if (currentIndex < queue.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      fetchData();
      setCurrentIndex(0);
    }
  };

  const handleVerify = async () => {
    if (!currentQuestion) return;
    await supabase.from('questions').update({ is_verified: true }).eq('id', currentQuestion.id);
    nextInQueue();
  };

  const handleTrash = async () => {
    if (!currentQuestion || !confirm('Delete permanently?')) return;
    await supabase.from('questions').delete().eq('id', currentQuestion.id);
    nextInQueue();
  };

  if (loading) return <div className="p-20 text-center font-mono text-slate-500 animate-pulse uppercase tracking-widest">Synchronizing Warden...</div>;
  if (!currentQuestion) return <div className="p-20 text-center font-mono text-slate-500 text-xs tracking-widest">QUEUE EMPTY / ID NOT FOUND</div>;

  const shell = Array.isArray(currentQuestion.conceptual_shells) 
    ? currentQuestion.conceptual_shells[0] 
    : currentQuestion.conceptual_shells;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 p-8 antialiased">
      <header className="max-w-6xl mx-auto mb-12 flex justify-between items-center border-b border-slate-900 pb-8">
        <div>
          <h1 className="text-2xl font-black italic uppercase text-white tracking-tighter">The Warden</h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
            {targetId ? `Direct Edit Mode` : `Reviewing ${currentIndex + 1} of ${queue.length}`}
          </p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={nextInQueue}
            className="text-[10px] font-black uppercase tracking-widest bg-slate-800 text-slate-300 px-6 py-3 rounded-2xl hover:bg-slate-700 transition-all border border-slate-700 active:scale-95"
          >
            {targetId ? "Back to Queue ↩" : "Skip Variant →"}
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12">
        
        {/* LEFT: SOURCE REFERENCE (JMC ORIGINAL) */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-8 border border-slate-800 shadow-2xl flex items-center justify-center min-h-[250px] overflow-hidden">
            {shell?.original_image_url ? (
              <img src={shell.original_image_url} className="max-h-64 object-contain" alt="JMC Original" />
            ) : (
              <div className="text-slate-300 text-xs text-center p-8 italic">{shell?.original_image_desc || "No original image data."}</div>
            )}
          </div>
          <div className="bg-slate-900/40 p-10 rounded-[2.5rem] border border-slate-800/50">
             <span className="text-[10px] text-slate-600 font-black uppercase mb-4 block tracking-widest">Original JMC Question</span>
             <p className="text-slate-300 font-serif italic text-lg leading-relaxed">{shell?.original_jmc_question}</p>
             <div className="mt-8 pt-8 border-t border-slate-800/50">
                <span className="text-[10px] text-slate-600 font-black uppercase tracking-widest">Solution Reference</span>
                <p className="text-slate-500 text-sm mt-3 leading-relaxed">{shell?.original_jmc_solution}</p>
             </div>
          </div>
        </div>

        {/* RIGHT: EDITABLE VARIANT */}
        <div className="bg-slate-900 p-10 rounded-[3.5rem] border border-slate-800 shadow-2xl relative">
          
          {/* DIAGNOSTIC RIBBON (Corrected to 'weight') */}
          <div className="grid grid-cols-4 gap-3 mb-8">
            <div className="bg-slate-950 border border-slate-800 p-3 rounded-2xl text-center shadow-inner">
              <p className="text-[8px] text-slate-600 font-black uppercase tracking-tighter mb-1">Shell ID</p>
              <p className="text-xs font-mono font-bold text-blue-500">{currentQuestion.shell_id}</p>
            </div>
            <div className="bg-slate-950 border border-slate-800 p-3 rounded-2xl text-center shadow-inner">
              <p className="text-[8px] text-slate-600 font-black uppercase tracking-tighter mb-1">Weight</p>
              <p className="text-xs font-bold text-emerald-500">
                {shell?.weight ?? '1.0'}
              </p>
            </div>
            <div className="bg-slate-950 border border-slate-800 p-3 rounded-2xl text-center shadow-inner">
              <p className="text-[8px] text-slate-600 font-black uppercase tracking-tighter mb-1">App Lvl</p>
              <p className="text-xs font-bold text-orange-500 uppercase">{currentQuestion.application_level}</p>
            </div>
            <div className="bg-slate-950 border border-slate-800 p-3 rounded-2xl text-center shadow-inner">
              <p className="text-[8px] text-slate-600 font-black uppercase tracking-tighter mb-1">Ling Lvl</p>
              <p className="text-xs font-bold text-purple-500 uppercase">{currentQuestion.linguistic_level}</p>
            </div>
          </div>

          {/* UPLOADABLE IMAGE BOX */}
          <div className="mb-8 rounded-[2rem] border-2 border-dashed border-slate-800 bg-slate-950 min-h-[240px] flex items-center justify-center relative group overflow-hidden cursor-pointer hover:border-blue-500/50 transition-all">
            <input 
              type="file" 
              accept="image/*"
              className="absolute inset-0 opacity-0 cursor-pointer z-20" 
              onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
            />
            {currentQuestion.image_url && currentQuestion.image_url !== "None." ? (
              <img src={currentQuestion.image_url} className="max-h-64 object-contain p-4" alt="Variant" />
            ) : (
              <div className="text-center p-8 transition-transform group-hover:scale-105">
                <span className="text-3xl mb-3 block opacity-40">📤</span>
                <p className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Click to Upload Image</p>
                <p className="text-[10px] text-slate-700 italic mt-3 px-6 max-w-xs mx-auto leading-relaxed">{currentQuestion.image_desc}</p>
              </div>
            )}
          </div>

          <div className="relative mb-10">
            <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest mb-3 block">Edit Variant Content</label>
            <textarea
              key={currentQuestion.id}
              className="w-full bg-slate-950 border border-slate-800 rounded-[2rem] p-8 text-xl text-slate-100 min-h-[280px] focus:border-blue-500 outline-none font-serif shadow-2xl transition-all"
              defaultValue={currentQuestion.content}
              onChange={(e) => debouncedSave(e.target.value)}
            />
            {saveStatus && (
              <div className="absolute top-6 right-6 text-[9px] font-black uppercase text-blue-500 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20">
                {saveStatus}
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <button onClick={handleVerify} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-black py-6 rounded-2xl uppercase text-[11px] tracking-widest transition-all shadow-xl shadow-blue-900/20 active:scale-95">
              Verify & Release
            </button>
            <button onClick={handleTrash} className="bg-slate-800 px-8 rounded-2xl hover:bg-red-900/20 hover:text-red-500 transition-all font-black text-[10px] uppercase active:scale-95 border border-slate-700">
              Trash
            </button>
          </div>
        </div>

      </div>
    </main>
  );
}

export default function AdminReviewPage() {
  return (
    <Suspense fallback={<div className="p-20 text-center font-mono opacity-20 uppercase tracking-widest">Initializing Warden...</div>}>
      <WardenContent />
    </Suspense>
  );
}