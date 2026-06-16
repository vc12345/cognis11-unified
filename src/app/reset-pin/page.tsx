'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { Lock, Loader2, ArrowLeft, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function ResetPinPage() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 3) return;
    setLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    // Entering '000' safely disables the PIN lock by setting it back to null
    const finalPin = pin === '000' ? null : pin;

    const { error } = await supabase
      .from('profiles')
      .update({ user_pin: finalPin })
      .eq('id', user.id);

    if (error) {
      setMessage('Failed to update PIN parameters.');
      setLoading(false);
    } else {
      router.push('/account');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF6] text-[#1B3A5C] flex flex-col items-center justify-center px-6">
      <div className="absolute top-8 left-8">
        <Link href="/account" className="text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-[#1B3A5C] transition-colors flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Cancel & Return
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-[#E5E3DD] rounded-2xl max-w-sm w-full p-8 shadow-xl space-y-5">
        <div className="flex items-center gap-2 text-blue-600">
          <ShieldCheck className="w-6 h-6 text-[#1B3A5C]" />
          <h3 className="font-bold font-serif text-xl text-[#1B3A5C]">Configure Security Lock</h3>
        </div>
        
        <p className="text-xs text-slate-500 leading-relaxed">
          Enter a 3-digit numerical code to secure your child's telemetry data. 
          <br/><br/>
          <span className="font-bold text-amber-600">To disable an existing lock, enter 000.</span>
        </p>

        <div className="space-y-1">
          <input 
            type="password" 
            maxLength={3} 
            placeholder="000"
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
            disabled={loading}
            className="w-full bg-[#FAF9F6] border border-[#E5E3DD] py-3.5 rounded-xl text-center text-2xl font-bold tracking-[0.5em] text-[#1B3A5C] outline-none focus:border-[#1B3A5C] transition-all"
          />
          {message && <p className="text-[11px] font-bold text-rose-600 text-center pt-1">{message}</p>}
        </div>

        <button 
          type="submit" 
          disabled={loading || pin.length !== 3}
          className="w-full bg-[#1B3A5C] hover:bg-slate-800 text-white py-3.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save & Secure Account'}
        </button>
      </form>
    </div>
  );
}