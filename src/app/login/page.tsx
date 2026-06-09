'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [signUpPin, setSignUpPin] = useState('');
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  const router = useRouter();

  const handleAuth = async (type: 'LOGIN' | 'SIGNUP') => {
    setLoading(true);
    setMessage('');

    if (type === 'SIGNUP' && !isSigningUp) {
      setIsSigningUp(true);
      setLoading(false);
      return;
    }

    if (type === 'SIGNUP' && signUpPin.length !== 3) {
      setMessage('Error: A 3-digit Parent Lock PIN is mandatory for registration.');
      setLoading(false);
      return;
    }
    
    const { data, error } = type === 'LOGIN' 
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: { 
              parent_pin: signUpPin,
              test_credits: 0 // Free prep registration yields exactly zero diagnostic credits
            }
          }
        });

    if (error) {
      setMessage(error.message);
      setLoading(false);
    } else {
      if (data.session || type === 'LOGIN') {
        // Post-Login Routing Switchboard
        const userMetadata = data.user?.user_metadata || data.session?.user?.user_metadata;
        
        if (!userMetadata?.target_tier) {
          // Missing parameters -> send to target calibration first
          setMessage('Success. Routing to baseline setup...');
          router.push('/profile');
        } else {
          // Existing baseline parameters -> route cleanly to the session router hub
          setMessage('Success. Connecting to assessment hub...');
          router.push('/test-initiate');
        }
      } else {
        setMessage('Verification link transmitted to inbox.');
        setIsSigningUp(false);
        setSignUpPin('');
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-white text-zinc-900 px-6 py-12 font-mono selection:bg-zinc-900 selection:text-white">
      <header className="max-w-md w-full mx-auto flex items-center justify-between border-b border-zinc-200 pb-4">
        <span className="text-sm font-black tracking-[0.2em] text-zinc-900">COGNIS11</span>
        <span className="text-[10px] text-zinc-400 tracking-wider">GATEWAY_v1.8</span>
      </header>

      <div className="max-w-xs w-full mx-auto my-auto py-16 space-y-8 relative">
        <div className="space-y-5">
          <div className="space-y-1">
            <span className="text-[9px] uppercase tracking-widest text-zinc-400 block font-bold">Account_Email</span>
            <input 
              type="email" placeholder="user@domain.com" value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="w-full bg-transparent border-b border-zinc-200 py-2 outline-none text-sm placeholder:text-zinc-300 focus:border-zinc-900 transition disabled:opacity-30 rounded-none text-zinc-900"
            />
          </div>

          <div className="space-y-1">
            <span className="text-[9px] uppercase tracking-widest text-zinc-400 block font-bold">Passphrase</span>
            <input 
              type="password" placeholder="••••••••" value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="w-full bg-transparent border-b border-zinc-200 py-2 outline-none text-sm placeholder:text-zinc-300 focus:border-zinc-900 transition disabled:opacity-30 rounded-none text-zinc-900"
            />
          </div>

          {isSigningUp && (
            <div className="space-y-1 bg-zinc-50 p-3 border border-zinc-200">
              <span className="text-[9px] uppercase tracking-widest text-zinc-500 block font-bold">Create 3-Digit Parent PIN</span>
              <input 
                type="password" maxLength={3} placeholder="000" value={signUpPin}
                onChange={(e) => setSignUpPin(e.target.value.replace(/\D/g, ''))}
                disabled={loading}
                className="w-full bg-transparent border-b border-zinc-300 py-1 outline-none text-center text-sm tracking-[0.5em] font-bold focus:border-zinc-900 transition rounded-none text-zinc-900"
              />
            </div>
          )}
          
          {message && (
            <div className="text-[10px] uppercase text-zinc-500 text-center pt-2 tracking-wide font-bold">* {message}</div>
          )}

          <div className="pt-4 space-y-2">
            {!isSigningUp ? (
              <>
                <button onClick={() => handleAuth('LOGIN')} disabled={loading} className="w-full bg-zinc-900 text-white py-3 font-bold text-xs uppercase tracking-widest hover:bg-zinc-800 transition disabled:opacity-30 shadow-sm">
                  {loading ? 'Connecting...' : 'Sign In'}
                </button>
                <button onClick={() => handleAuth('SIGNUP')} className="w-full bg-transparent text-zinc-400 text-[10px] font-bold uppercase tracking-widest hover:text-zinc-900 transition py-2 text-center">
                  Register for Free Prep Program
                </button>
              </>
            ) : (
              <>
                <button onClick={() => handleAuth('SIGNUP')} disabled={loading} className="w-full bg-zinc-900 text-white py-3 font-bold text-xs uppercase tracking-widest hover:bg-zinc-800 transition">
                  Confirm Registration
                </button>
                <button onClick={() => { setIsSigningUp(false); setSignUpPin(''); setMessage(''); }} className="w-full bg-transparent text-zinc-400 text-[10px] font-bold uppercase tracking-widest hover:text-zinc-600 transition py-1 text-center">
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <footer className="max-w-md w-full mx-auto text-center text-[9px] tracking-widest text-zinc-400 uppercase">
        Enforcing Automated Diagnostic Protocol Logs
      </footer>
    </div>
  );
}