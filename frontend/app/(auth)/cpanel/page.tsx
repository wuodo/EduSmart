"use client";
import React from 'react';

async function postJson(path: string, body: any) {
  console.log('Making cpanel login request:', { path, body });
  const res = await fetch(`/api/cpanel${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  console.log('Response status:', res.status);
  const data = await res.json().catch(()=>({}));
  console.log('Response data:', data);
  if (!res.ok) throw new Error((data as any)?.error || `Login failed (${res.status})`);
  return data;
}

export default function CpanelLogin() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [otpCode, setOtpCode] = React.useState('');
  const [challengeId, setChallengeId] = React.useState<string | null>(null);
  const [awaitingOtp, setAwaitingOtp] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); 
    setError(null); 
    setLoading(true);
    console.log('Form submitted with:', { email, password });
    
    try {
      const result = await postJson('/login', { email, password });
      if (result?.requiresOtp) {
        setAwaitingOtp(true);
        setChallengeId(String(result.challengeId || ''));
        setPassword('');
        return;
      }
      
      // Set authentication cookies manually
      document.cookie = 'isAuthenticated=true; path=/; max-age=604800'; // 7 days
      document.cookie = 'role=super_admin; path=/; max-age=604800';
      
      // Small delay to ensure cookies are set
      setTimeout(() => {
        window.location.href = '/cpanel/dashboard';
      }, 100);
    } catch (e: any) {
      console.error('Login error:', e);
      setError(e.message);
    } finally { 
      setLoading(false); 
    }
  }

  async function onVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!challengeId || !otpCode.trim()) {
      setError('Enter verification code');
      return;
    }
    setLoading(true);
    try {
      const result = await postJson('/login/verify-otp', { email, challengeId, code: otpCode.trim() });
      if (!result?.success) throw new Error('Verification failed');
      document.cookie = 'isAuthenticated=true; path=/; max-age=604800';
      document.cookie = 'role=super_admin; path=/; max-age=604800';
      setTimeout(() => {
        window.location.href = '/cpanel/dashboard';
      }, 100);
    } catch (e: any) {
      setError(e.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#000000' }}>
      <div className="w-full max-w-md bg-white rounded border border-gray-200 p-6 shadow">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">EduSmart Cpanel</h1>
        <p className="text-sm text-gray-600 mb-6">Super admin login</p>
        {error && <div className="mb-4 text-sm bg-rose-50 text-rose-700 border border-rose-200 rounded p-2">{error}</div>}
        <form onSubmit={awaitingOtp ? onVerifyOtp : onSubmit} className="space-y-3">
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" className="w-full border border-gray-300 rounded px-3 py-2" required />
          {!awaitingOtp ? (
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" className="w-full border border-gray-300 rounded px-3 py-2" required />
          ) : (
            <input value={otpCode} onChange={e=>setOtpCode(e.target.value)} placeholder="Verification code" className="w-full border border-gray-300 rounded px-3 py-2" required />
          )}
          <button disabled={loading} className="w-full bg-btnblue text-white rounded px-4 py-2 hover:opacity-90 disabled:opacity-70">{loading ? (awaitingOtp ? 'Verifying…' : 'Signing in…') : (awaitingOtp ? 'Verify code' : 'Sign in')}</button>
        </form>
      </div>
    </div>
  );
}


