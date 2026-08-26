import { FormEvent, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { ShieldCheck, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../utils/api';
import { ZestIQBrand } from '../components/ZestIQBrand';

type MfaStatus = { required: boolean; verified: boolean; canEnroll: boolean; factors: Array<{ id: string; type: string; status: string }> };
type Enrollment = { id: string; qrCode: string; uri: string };

export function Mfa() {
  const { isAuthenticated, mfaRequired, completeMfa, refreshSession, logout } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [qrFailed, setQrFailed] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    void apiRequest<MfaStatus>('/api/v1/auth/mfa/status').then(setStatus).catch(error => toast.error(error.message));
  }, [isAuthenticated]);

  if (isAuthenticated === null) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (status?.verified) return <Navigate to="/app" replace />;

  const startEnrollment = async () => {
    setBusy(true);
    setQrFailed(false);
    try {
      setEnrollment(await apiRequest<Enrollment>('/api/v1/auth/mfa/enroll', { method: 'POST' }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to set up two-step verification');
    } finally { setBusy(false); }
  };

  const copyManualSetupLink = async () => {
    if (!enrollment?.uri) return;
    try {
      await navigator.clipboard.writeText(enrollment.uri);
      toast.success('Setup link copied. Add it in your authenticator app manually.');
    } catch {
      toast.error('Could not copy the setup link. Please try the QR code again.');
    }
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

  const skipForNow = async () => {
    setBusy(true);
    try {
      await refreshSession();
      toast.success('Two-step verification is temporarily skipped.');
      navigate('/app', { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to skip two-step verification right now');
    } finally { setBusy(false); }
  };

  const hasExistingFactor = Boolean(status?.factors.some(factor => factor.type === 'totp'));
  const canSetUp = status?.canEnroll === true;
  const setupOptional = !mfaRequired;

  return <main className="grid min-h-screen place-items-center bg-[#F5C10E] p-5"><section className="w-full max-w-md rounded-[30px] bg-white p-7 shadow-2xl sm:p-9"><ZestIQBrand markClassName="h-12 w-12 rounded-xl" wordmarkClassName="text-2xl" /><div className="mt-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0B1220] text-[#F5C10E]"><ShieldCheck /></div><h1 className="mt-4 text-3xl font-black tracking-tight text-[#0B1220]">Protect your account</h1><p className="mt-2 text-sm leading-6 text-slate-600">{setupOptional ? 'Set up two-step verification now to protect your ZestIQ access. It is optional during the current rollout.' : 'Two-step verification is required for this account.'}</p>{!status ? <p className="mt-7 text-sm text-slate-500">Checking account security…</p> : !canSetUp ? <p className="mt-7 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Two-step verification can be set up by company owners, administrators, and ZestIQ platform administrators.</p> : !enrollment && !hasExistingFactor ? <button type="button" disabled={busy} onClick={startEnrollment} className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0B1220] font-black text-white disabled:opacity-50"><Smartphone className="h-4 w-4 text-[#F5C10E]" />Set up authenticator app</button> : <form onSubmit={verify} className="mt-7 space-y-4">{enrollment?.qrCode && <><p className="text-sm font-bold text-[#0B1220]">Scan this QR code with Google Authenticator, Microsoft Authenticator, 1Password, or another authenticator app.</p><div className="flex justify-center rounded-2xl border border-slate-200 bg-white p-4">{qrFailed ? <div className="flex h-48 w-48 flex-col items-center justify-center text-center text-sm text-slate-600"><p>The QR image could not load.</p><Button type="button" variant="outline" className="mt-3" onClick={() => void copyManualSetupLink()}>Copy manual setup link</Button></div> : <img src={enrollment.qrCode} alt="ZestIQ authenticator QR code" onError={() => setQrFailed(true)} className="h-48 w-48" />}</div><button type="button" onClick={() => void copyManualSetupLink()} className="w-full text-sm font-bold text-slate-600 underline">Can’t scan? Copy a manual setup link</button></>} {hasExistingFactor && !enrollment && <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">An authenticator is already enrolled. Enter its current code below.</p>}<label className="block text-sm font-black text-slate-700">Six-digit code<input autoFocus inputMode="numeric" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-4 text-center text-xl font-black tracking-[.35em] outline-none focus:border-[#F5C10E]" /></label><button disabled={busy || code.length !== 6} className="h-12 w-full rounded-xl bg-[#0B1220] font-black text-white disabled:opacity-50">Verify and continue</button></form>}{setupOptional && <button type="button" disabled={busy} onClick={skipForNow} className="mt-4 w-full text-sm font-black text-slate-600 underline disabled:opacity-50">Skip for now</button>}<button type="button" onClick={logout} className="mt-5 w-full text-sm font-bold text-slate-500 underline">Sign out</button></section></main>;
}
