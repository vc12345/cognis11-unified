'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function PINGuard({ children }: { children: React.ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('cognis_unlocked') === 'true') setIsUnlocked(true);
  }, []);

  const verifyPin = async () => {
    setLoading(true);
    const res = await fetch('/api/verify-pin', {
      method: 'POST',
      body: JSON.stringify({ pin })
    });
    
    if (res.ok) {
      sessionStorage.setItem('cognis_unlocked', 'true');
      setIsUnlocked(true);
    } else {
      alert('Access Denied');
      setPin('');
    }
    setLoading(false);
  };

  if (!isUnlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white font-mono">
        <div className="w-64 space-y-6 text-center">
          <h2 className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">Parent Lock Gate</h2>
          <input 
            type="password" maxLength={3} value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            className="w-full text-center text-2xl tracking-[1em] border-b border-zinc-200 outline-none py-2"
          />
          <button onClick={verifyPin} disabled={loading} className="w-full bg-zinc-900 text-white py-2 text-[10px] uppercase tracking-widest font-bold">
            {loading ? 'Verifying...' : 'Unlock Telemetry'}
          </button>
          <div className="pt-2">
            <Link href="/reset-pin" className="text-[9px] text-zinc-400 uppercase tracking-widest underline decoration-zinc-200 hover:text-zinc-900">
              Forgot Parent PIN?
            </Link>
          </div>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}