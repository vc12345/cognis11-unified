'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

export default function UpdatePINPage() {
  const [newPin, setNewPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length !== 3) {
      setError('PIN must be exactly 3 digits.');
      return;
    }

    setLoading(true);
    setError('');

    // Update the custom metadata attribute inside the secure, verified active session
    const { error: updateError } = await supabase.auth.updateUser({
      data: { parent_pin: newPin }
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
    } else {
      // Clear bypass cache so the system checks the fresh token combination instantly
      sessionStorage.removeItem('cognis_unlocked');
      router.push('/test-initiate');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white font-mono text-zinc-900 px-6">
      <div className="w-full max-w-xs space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Security Override Channels</h2>
          <h1 className="text-xs uppercase font-black tracking-wider text-zinc-900">Configure New Parent Code</h1>
        </div>

        <form onSubmit={handleUpdatePin} className="border border-zinc-200 p-5 space-y-4 bg-white shadow-sm">
          <div className="space-y-1">
            <span className="text-[9px] uppercase tracking-widest text-zinc-400 block font-bold text-center">New 3-Digit PIN</span>
            <input 
              type="password" 
              maxLength={3} 
              placeholder="000" 
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              disabled={loading}
              className="w-full text-center text-3xl tracking-[1em] outline-none py-2 border-b border-zinc-200 focus:border-zinc-900 transition font-bold text-zinc-900 rounded-none bg-transparent"
              autoFocus
            />
          </div>

          {error && (
            <div className="text-[10px] text-red-600 font-bold uppercase text-center border border-red-100 bg-red-50 p-2">
              * {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading || newPin.length !== 3} 
            className="w-full bg-zinc-900 text-white py-3 text-xs uppercase tracking-widest font-bold hover:bg-zinc-800 transition disabled:opacity-20 rounded-none shadow-sm"
          >
            {loading ? 'Securing Code...' : 'Commit New Security Code'}
          </button>
        </form>
      </div>
    </div>
  );
}