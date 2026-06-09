'use client';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function ResetPinPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const triggerResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // Directs the email click through the server exchange router to fully hydrate the session cookies
      redirectTo: `${window.location.origin}/api/auth/callback?next=/update-pin`,
    });

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage('Security confirmation link dispatched to your inbox.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-white text-zinc-900 px-6 py-12 font-mono">
      <header className="max-w-md w-full mx-auto flex items-center justify-between border-b border-zinc-200 pb-4">
        <span className="text-sm font-black tracking-[0.2em] text-zinc-900">COGNIS11</span>
        <span className="text-[10px] text-zinc-400 tracking-wider">PIN_RECOVERY</span>
      </header>

      <div className="max-w-xs w-full mx-auto my-auto py-16 space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-xs font-bold uppercase tracking-wider">Reconfigure Lock Code</h2>
          <p className="text-[9px] text-zinc-400 uppercase">Requires out-of-band email clearance</p>
        </div>

        <form onSubmit={triggerResetRequest} className="space-y-4">
          <div className="space-y-1">
            <span className="text-[9px] uppercase tracking-widest text-zinc-400 block font-bold">Account_Email</span>
            <input 
              type="email" required placeholder="user@domain.com" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent border-b border-zinc-200 py-2 outline-none text-sm placeholder:text-zinc-300 focus:border-zinc-900 transition rounded-none text-zinc-900"
            />
          </div>

          {message && <p className="text-[10px] uppercase text-zinc-500 text-center tracking-wide font-bold">* {message}</p>}

          <button type="submit" disabled={loading} className="w-full bg-zinc-900 text-white py-3 font-bold text-xs uppercase tracking-widest hover:bg-zinc-800 transition">
            {loading ? 'Transmitting...' : 'Send Recovery Link'}
          </button>
        </form>
      </div>

      <footer className="max-w-md w-full mx-auto text-center text-[9px] text-zinc-400 uppercase">
        Verification Protocols Enforced
      </footer>
    </div>
  );
}