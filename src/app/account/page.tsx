'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LogOut, Mail, CreditCard, Trash2, ShieldAlert, Loader2, CheckCircle2, Lock } from 'lucide-react';
import Link from 'next/link';

interface UserProfile {
  id: string;
  course_type: 'foundational' | 'supplemental' | null;
  course_subscription: boolean;
  test_credits: number;
  user_pin: string | null;
}

export default function AccountManagementPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [pinActionLoading, setPinActionLoading] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const router = useRouter();

  useEffect(() => {
    async function loadAccountData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/register'); // ISSUE 3 FIX
      
      setUserEmail(user.email ?? null);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileData) setProfile(profileData as UserProfile);
      setLoading(false);
    }
    loadAccountData();
  }, [router, supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/register'); // ISSUE 3 FIX
  };

  // ISSUE 6 FIX: Server-side secure deletion
  const handleDeleteAccount = async () => {
    const confirmed = window.confirm("Are you entirely sure? This action is irreversible and deletes all metrics, purchases, and tokens.");
    if (!confirmed || !profile) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id })
      });
      if (res.ok) {
        await supabase.auth.signOut();
        router.push('/register');
      } else {
        alert("Failed to securely erase account.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  // ISSUE 5 FIX: PIN Email Link
  const handleRequestPinReset = async () => {
    if (!userEmail) return;
    setPinActionLoading(true);
    
    // Sends a secure auth link to their email, returning them directly to the reset-pin page
    const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
      redirectTo: `${window.location.origin}/reset-pin`,
    });

    if (!error) {
      alert("A secure PIN setup link has been dispatched to your email address.");
    } else {
      alert("Failed to dispatch email link.");
    }
    setPinActionLoading(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-mono text-xs tracking-widest text-slate-400">LOADING_ACCOUNT...</div>;

  const hasValidPin = profile?.user_pin && profile.user_pin !== '000';

  return (
    <div className="min-h-screen bg-[#FAFAF6] text-[#1B3A5C] font-sans px-6 py-12">
      <div className="max-w-xl mx-auto space-y-8">
        <header className="flex items-center gap-4 border-b border-[#E5E3DD] pb-6">
          <Link href="/profile" className="p-2 border border-[#E5E3DD] rounded-lg bg-white hover:bg-slate-50 transition-colors"><ArrowLeft className="w-4 h-4 text-slate-400" /></Link>
          <h1 className="text-xl font-bold font-serif">Account & Security Settings</h1>
        </header>

        <div className="bg-white border border-[#E5E3DD] rounded-xl p-6 shadow-sm space-y-6">
          
          <div className="space-y-1 pb-4 border-b border-[#E5E3DD]">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Primary Identity</span>
            <div className="flex items-center gap-3 text-sm font-medium"><Mail className="w-4 h-4 text-slate-400" /> {userEmail}</div>
          </div>

          {/* ISSUE 5 FIX: PIN UI Panel */}
          <div className="space-y-3 pb-4 border-b border-[#E5E3DD]">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Parental Verification Lock</span>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-sm font-medium">
                <Lock className="w-4 h-4 text-slate-400" />
                {hasValidPin ? (
                  <span className="text-emerald-600 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> PIN Recorded Active</span>
                ) : (
                  <span className="text-amber-600 flex items-center gap-1.5"><ShieldAlert className="w-4 h-4" /> PIN Not Configured</span>
                )}
              </div>
              <button 
                onClick={handleRequestPinReset}
                disabled={pinActionLoading}
                className="text-[10px] font-bold uppercase tracking-widest bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-md transition-colors flex items-center gap-2"
              >
                {pinActionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : hasValidPin ? 'Reset PIN via Email' : 'Set PIN via Email'}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed max-w-sm">Required to view analytical telemetry and prevent students from accessing system settings.</p>
          </div>

          <div className="space-y-4 pt-2">
            <button onClick={handleLogout} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border border-[#E5E3DD] rounded-lg hover:border-slate-300 transition-colors">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Secure Sign Out</span>
              <LogOut className="w-4 h-4 text-slate-400" />
            </button>

            <button onClick={handleDeleteAccount} disabled={actionLoading} className="w-full flex items-center justify-between px-4 py-3 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
              <span className="text-xs font-bold uppercase tracking-wider text-red-600">{actionLoading ? 'Purging Systems...' : 'Permanently Delete Account'}</span>
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>

            <a 
                href="https://billing.stripe.com/p/login/test_3cIfZj0ybgFcejO20agUM00" 
                target="_blank" 
                className="bg-[#1B3A5C] hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider py-3 px-5 rounded-lg transition-all inline-flex items-center gap-2 shadow-sm"
                >
                Manage Billing & Cancel
            </a>

          </div>
        </div>
      </div>
    </div>
  );
}