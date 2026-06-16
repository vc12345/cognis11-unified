'use client';

import { useState, Suspense } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, ArrowRight, KeyRound } from 'lucide-react';

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const intent = searchParams.get('intent') || 'course';
  const plan = searchParams.get('plan') || 'foundational';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [wrongPassword, setWrongPassword] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const syncLocalStorage = (session: any) => {
    if (session) {
      localStorage.setItem('supabase.auth.token', JSON.stringify({
        currentSession: session,
        expiresAt: session.expires_at
      }));
    }
  };

  const handleRegistrationFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setWrongPassword(false);

    try {
      // 1. Attempt Sign In first (Seamless returning user flow)
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      
      if (signInData.session) {
        syncLocalStorage(signInData.session);
        
        // Write course plan to profile BEFORE redirecting
        if (intent === 'course' && (plan === 'foundational' || plan === 'supplemental')) {
          await supabase.from('profiles').update({ course_type: plan }).eq('id', signInData.session.user.id);
        }

        if (intent === 'course' || plan === 'free') {
          router.push('/profile?triggerOnboarding=true&intent=' + intent);
        } else if (intent === 'diagnostic') {
          const supportAmount = plan === 'one-off' ? '29' : '89';
          const response = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              intent: 'diagnostic', plan: plan || 'one-off', amount: supportAmount, 
              userId: signInData.session.user.id, email: signInData.session.user.email 
            })
          });
          const data = await response.json();
          if (data.url) window.location.href = data.url;
          else router.push('/profile?triggerOnboarding=true&intent=' + intent);
        } else {
          router.push('/profile?triggerOnboarding=true');
        }
        return;
      }

      // 2. If Sign In fails, execute Sign Up logic
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password
      }); // Notice: PIN payload completely removed

      if (signUpError) {
        if (signUpError.message.includes('already registered') || signUpError.message.includes('Invalid login')) {
          setMessage('Account exists. Invalid password.');
          setWrongPassword(true);
        } else {
          setMessage(signUpError.message);
        }
        setLoading(false);
        return;
      }

      if (signUpData.session) {
        syncLocalStorage(signUpData.session);
        
        // Write course plan to profile BEFORE redirecting
        if (intent === 'course' && (plan === 'foundational' || plan === 'supplemental')) {
          await supabase.from('profiles').update({ course_type: plan }).eq('id', signUpData.session.user.id);
        }

        if (intent === 'course' || plan === 'free') {
          router.push('/profile?triggerOnboarding=true&intent=' + intent);
        } else if (intent === 'diagnostic') {
          const supportAmount = plan === 'one-off' ? '29' : '89';
          const response = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              intent: 'diagnostic', plan: plan || 'one-off', amount: supportAmount, 
              userId: signUpData.session.user.id, email: signUpData.session.user.email 
            })
          });
          const data = await response.json();
          if (data.url) window.location.href = data.url;
          else router.push('/profile?triggerOnboarding=true&intent=' + intent);
        } else {
          router.push('/profile?triggerOnboarding=true');
        }
      } else {
        setMessage('A confirmation link has been sent to your inbox.');
        setLoading(false);
      }
    } catch (err: any) {
      setMessage(err.message || 'Authentication sequence failed.');
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      setMessage('Please enter your email to recover password.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setMessage(error.message);
    } else {
      setMessage('Recovery protocol dispatched to email.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#FAFAF6] text-[#1B3A5C] px-6 py-12 font-sans antialiased selection:bg-amber-200">
      <div className="max-w-md w-full mx-auto my-auto py-10">
        <form onSubmit={handleRegistrationFlow} className="bg-white border border-[#E5E3DD] rounded-2xl p-8 md:p-10 shadow-2xl">
          <div className="space-y-1 mb-6">
            <h2 className="text-xl font-bold font-serif">Configure Account Gateway</h2>
            <p className="text-xs text-slate-400">Initialize access details for secure performance profiling.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Account Identity</label>
              <input type="email" placeholder="parent@domain.com" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-[#FAF9F6] border border-[#E5E3DD] px-4 py-3 rounded-xl text-sm text-[#1B3A5C] outline-none focus:border-[#1B3A5C] transition-all" />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Passphrase Lock</label>
              <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-[#FAF9F6] border border-[#E5E3DD] px-4 py-3 rounded-xl text-sm text-[#1B3A5C] outline-none focus:border-[#1B3A5C] transition-all" />
            </div>

            {message && (
              <div className={`p-4 rounded-lg text-xs leading-relaxed border ${wrongPassword ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                {message}
              </div>
            )}

            <div className="pt-2 space-y-3">
              <button type="submit" disabled={loading} className="w-full bg-[#1B3A5C] hover:bg-slate-800 text-white py-3.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Process Verification'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>

              {wrongPassword && (
                <button type="button" onClick={handlePasswordReset} className="w-full bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 py-3 rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 mt-2">
                  <KeyRound className="w-4 h-4" /> Trigger Password Recovery
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      <footer className="max-w-md w-full mx-auto text-center text-[9px] tracking-widest text-slate-400 uppercase font-bold mt-auto pt-8">
        Secured Unified Authentication Architecture
      </footer>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAFAF6] flex items-center justify-center text-xs tracking-widest text-slate-400">LOADING_GATEWAY...</div>}>
      <RegisterPageContent />
    </Suspense>
  );
}