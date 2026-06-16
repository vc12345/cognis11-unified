'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { Brain, Loader2, ArrowRight, ShieldAlert } from 'lucide-react';

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

  // =================================================================
  // THE BRIDGE: Syncs Next.js session tokens down to Vanilla HTML
  // =================================================================
  useEffect(() => {
    const checkAndSyncSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // Write out the token format the Vanilla JavaScript app expects
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const match = url.match(/https:\/\/(.*?)\.supabase\.co/);
        if (match && match[1]) {
          localStorage.setItem(`sb-${match[1]}-auth-token`, JSON.stringify(session));
        }

        // UNIFIED ROUTE: Send everyone straight to the Central Control Hub
        router.push('/profile');
      }
    };
    checkAndSyncSession();
  }, [supabase, router]);

  const handleAuth = async (type: 'LOGIN' | 'SIGNUP') => {
    setLoading(true);
    setMessage('');

    if (type === 'SIGNUP' && !isSigningUp) {
      setIsSigningUp(true);
      setLoading(false);
      return;
    }

    if (type === 'SIGNUP' && signUpPin.length !== 3) {
      setMessage('A 3-digit Parent Lock PIN is mandatory for registration.');
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
              test_credits: 0 
            }
          }
        });

    if (error) {
      setMessage(error.message);
      setLoading(false);
    } else {
      if (data.session || type === 'LOGIN') {
        if (data.session) {
          const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
          const match = url.match(/https:\/\/(.*?)\.supabase\.co/);
          if (match && match[1]) {
            localStorage.setItem(`sb-${match[1]}-auth-token`, JSON.stringify(data.session));
          }
        }
        setMessage('Access verified. Connecting to Control Hub...');
        router.push('/profile');
      } else {
        setMessage('Verification link transmitted to your inbox.');
        setIsSigningUp(false);
        setSignUpPin('');
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#FAFAF6] text-[#1B3A5C] px-6 py-12 font-sans antialiased selection:bg-amber-200">
      
      {/* Elegant Subdued Header */}
      <header className="max-w-md w-full mx-auto flex items-center justify-between border-b border-[#E5E3DD] pb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-[#1B3A5C]" />
          <span className="text-sm font-black tracking-[0.2em] font-mono">COGNIS11</span>
        </div>
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Gateway Access</span>
      </header>

      {/* Main Authentication Card Container */}
      <div className="max-w-md w-full mx-auto my-auto py-12">
        <div className="bg-white border border-[#E5E3DD] rounded-2xl p-8 md:p-10 shadow-sm space-y-6">
          
          <div className="text-center md:text-left space-y-1">
            <h2 className="text-2xl font-bold font-serif">
              {isSigningUp ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p className="text-sm text-slate-400">
              {isSigningUp ? 'Register your unified platform identity.' : 'Sign in to access your subscriptions.'}
            </p>
          </div>

          <div className="space-y-4">
            {/* Input fields */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Account Email</label>
              <input 
                type="email" 
                placeholder="e.g. parent@domain.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full bg-white border border-[#E5E3DD] px-4 py-3 rounded-lg text-sm outline-none focus:border-[#1B3A5C] transition-all disabled:opacity-50 text-[#1B3A5C]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Passphrase</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full bg-white border border-[#E5E3DD] px-4 py-3 rounded-lg text-sm outline-none focus:border-[#1B3A5C] transition-all disabled:opacity-50 text-[#1B3A5C]"
              />
            </div>

            {/* Parent PIN Field for Registration */}
            {isSigningUp && (
              <div className="bg-[#FAF9F6] p-4 border border-[#E5E3DD] rounded-xl space-y-2 animate-fadeIn">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-amber-800">Create 3-Digit Parent PIN</label>
                <input 
                  type="password" 
                  maxLength={3} 
                  placeholder="000" 
                  value={signUpPin}
                  onChange={(e) => setSignUpPin(e.target.value.replace(/\D/g, ''))}
                  disabled={loading}
                  className="w-full bg-white border border-[#E5E3DD] py-2 rounded-lg text-center text-base tracking-[0.5em] font-bold outline-none focus:border-[#1B3A5C] text-[#1B3A5C]"
                />
                <p className="text-[10px] text-slate-400 leading-normal">
                  This PIN prevents students from bypassing test flows or editing billing tokens.
                </p>
              </div>
            )}
            
            {/* Error/Status Notifications */}
            {message && (
              <div className="flex items-start gap-2 bg-slate-50 border border-[#E5E3DD] text-xs font-medium p-3.5 rounded-lg text-slate-600 leading-relaxed">
                <ShieldAlert className="w-4 h-4 text-[#1B3A5C] shrink-0 mt-0.5" />
                <span>{message}</span>
              </div>
            )}

            {/* Button Actions */}
            <div className="pt-2 space-y-3">
              {!isSigningUp ? (
                <>
                  <button 
                    onClick={() => handleAuth('LOGIN')} 
                    disabled={loading || !email || !password} 
                    className="w-full bg-[#1B3A5C] text-white py-4 font-bold text-xs uppercase tracking-wider hover:bg-slate-800 rounded-lg transition-all disabled:opacity-40 shadow-sm flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
                    {!loading && <ArrowRight className="w-4 h-4" />}
                  </button>
                  <button 
                    onClick={() => handleAuth('SIGNUP')} 
                    className="w-full bg-transparent text-slate-400 text-[10px] font-bold uppercase tracking-widest hover:text-[#1B3A5C] transition-colors py-2 text-center"
                  >
                    Create New Account (Free Base Program)
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => handleAuth('SIGNUP')} 
                    disabled={loading} 
                    className="w-full bg-[#1B3A5C] text-white py-4 font-bold text-xs uppercase tracking-wider hover:bg-slate-800 rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Registration'}
                  </button>
                  <button 
                    onClick={() => { setIsSigningUp(false); setSignUpPin(''); setMessage(''); }} 
                    className="w-full bg-transparent text-slate-400 text-[10px] font-bold uppercase tracking-widest hover:text-slate-600 transition-colors py-1 text-center"
                  >
                    Cancel Registration
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Authoritative, clean enterprise footer */}
      <footer className="max-w-md w-full mx-auto text-center text-[9px] tracking-widest text-slate-400 uppercase font-medium">
        Secured Unified Authentication Architecture
      </footer>
    </div>
  );
}