import { FormEvent, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { ShieldCheck, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../utils/api';
import { ZestIQBrand } from '../components/ZestIQBrand';

type MfaStatus = { required: boolean; verified: boolean; factors: Array<{ id: string; type: string; status: string }> };
type Enrollment = { id: string; qrCode: string; uri: string };

export function Mfa() {
  const { isAuthenticated, mfaRequired, completeMfa, logout } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !mfaRequired) return;
    void apiRequest<MfaStatus>('/api/v1/auth/mfa/status').then(setStatus).catch(error => toast.error(error.message));
  }, [isAuthenticated, mfaRequired]);

  if (isAuthenticated === null) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!mfaRequired) return <Navigate to="/app" replace />;

  const startEnrollment = async () => {
    setBusy(true);
    try {
      setEnrollment(await apiRequest<Enrollment>('/api/v1/auth/mfa/enroll', { method: 'POST' }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to set up two-step verification');
    } finally { setBusy(false); }
  };

  const verify = async (event: FormEvent) => {
    event.preventDefault();
    const factorId = enrollment?.id || status?.factors.find(factor => factor.type === 'totp')?.id;
    if (!factorId) return toast.error('Set up an authenticator app first');
    setBusy(true);
    try {
      await completeMfa(factorId, code);
      toast.success('Two-step verification is active');
      navigate('/app', { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'That code did not work. Try the newest code.');
    } finally { setBusy(false); }
  };

  return <main className="grid min-h-screen place-items-center bg-[#F5C10E] p-5"><section className="w-full max-w-md rounded-[30px] bg-white p-7 shadow-2xl sm:p-9"><ZestIQBrand markClassName="h-12 w-12 rounded-xl" wordmarkClassName="text-2xl" /><div className="mt-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0B1220] text-[#F5C10E]"><ShieldCheck /></div><h1 className="mt-4 text-3xl font-black tracking-tight text-[#0B1220]">Protect your account</h1><p className="mt-2 text-sm leading-6 text-slate-600">Two-step verification is required for ZestIQ owners, admins and platform administrators.</p>{!enrollment && !status?.factors.length ? <button type="button" disabled={busy} onClick={startEnrollment} className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0B1220] font-black text-white disabled:opacity-50"><Smartphone className="h-4 w-4 text-[#F5C10E]" />Set up authenticator app</button> : <form onSubmit={verify} className="mt-7 space-y-4">{enrollment?.qrCode && <><p className="text-sm font-bold text-[#0B1220]">Scan this QR code with Google Authenticator, Microsoft Authenticator, 1Password, or another authenticator app.</p><div className="flex justify-center rounded-2xl border border-slate-200 bg-white p-4"><img src={enrollment.qrCode} alt="ZestIQ authenticator QR code" className="h-48 w-48" /></div></>}<label className="block text-sm font-black text-slate-700">Six-digit code<input autoFocus inputMode="numeric" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-4 text-center text-xl font-black tracking-[.35em] outline-none focus:border-[#F5C10E]" /></label><button disabled={busy || code.length !== 6} className="h-12 w-full rounded-xl bg-[#0B1220] font-black text-white disabled:opacity-50">Verify and continue</button></form>}<button type="button" onClick={logout} className="mt-5 w-full text-sm font-bold text-slate-500 underline">Sign out</button></section></main>;
}
