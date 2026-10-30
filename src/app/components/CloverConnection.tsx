import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { apiRequest } from '../utils/api';
import { Button } from './ui/button';

interface CloverStatus {
  available: boolean;
  connected?: boolean;
  reconnectRequired?: boolean;
  merchantName?: string;
  lastSync?: string | null;
  lastError?: string | null;
  syncing?: boolean;
}

export function CloverConnection({ locationId, onImport }: { locationId: string; onImport: () => void }) {
  const [status, setStatus] = useState<CloverStatus | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [confirmSync, setConfirmSync] = useState(false);
  const active = useRef(true);
  const locked = useRef(false);
  useEffect(() => {
    active.current = true;
    const controller = new AbortController();
    apiRequest<CloverStatus>(`/api/clover/status?locationId=${encodeURIComponent(locationId)}`, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) setStatus(value); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not check Clover status.'); });
    return () => { active.current = false; controller.abort(); };
  }, [locationId]);

  async function act(action: 'connect' | 'sync' | 'disconnect') {
    if (locked.current || !locationId) return;
    locked.current = true; setBusy(true); setError('');
    try {
      if (action === 'connect') {
        const result = await apiRequest<{ authorizeUrl: string }>('/api/clover/start', { method: 'POST', body: JSON.stringify({ locationId }) });
        if (!active.current) return;
        const target = new URL(result.authorizeUrl);
        if (target.origin !== 'https://www.clover.com' || target.pathname !== '/oauth/v2/authorize') throw new Error('Clover authorization could not be started.');
        window.location.assign(target.toString());
      } else if (action === 'disconnect') {
        await apiRequest('/api/clover/status', { method: 'DELETE', body: JSON.stringify({ locationId }) });
        if (!active.current) return;
        setStatus(previous => ({ ...previous!, connected: false, reconnectRequired: false, merchantName: undefined, syncing: false }));
        setConfirmDisconnect(false);
        toast.success('Automatic Clover sync stopped. Previously synced sales remain available.');
      } else {
        await apiRequest('/api/clover/sync', { method: 'POST', body: JSON.stringify({ locationId }) });
        if (!active.current) return;
        toast.success('Clover sales and menu synced successfully.');
        window.location.reload();
      }
    } catch (reason) {
      if (!active.current) return;
      const message = reason instanceof Error ? reason.message : 'Clover could not complete the request.';
      setError(message);
      if (action === 'sync') {
        const refreshed = await apiRequest<CloverStatus>(`/api/clover/status?locationId=${encodeURIComponent(locationId)}`).catch(() => null);
        if (active.current && refreshed) setStatus(refreshed);
      }
    } finally {
      locked.current = false;
      if (active.current) setBusy(false);
    }
  }

  return <div className="space-y-3">
    {!status && !error && <p role="status" className="text-sm text-slate-600">Checking Clover availability…</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {!status && error && <Button variant="outline" onClick={() => window.location.reload()}>Retry Clover status</Button>}
    {status && !status.available && <p className="text-sm text-slate-600">Clover automatic sync is not activated yet. ZestIQ must complete production setup before restaurants can authorize access. You can import a sales export now.</p>}
    {status?.available && <>
      <p role="status" className="text-sm font-semibold text-slate-800">{status.reconnectRequired ? 'Clover needs to be reconnected.' : status.connected ? `Authorized: ${status.merchantName || 'Clover restaurant'}` : 'Connect the Clover restaurant that belongs to this ZestIQ location.'}</p>
      <p className="text-xs leading-5 text-slate-600">Sign in to Clover, choose your restaurant and approve read access. Your Clover password stays with Clover. Connecting enables daily sync; your first sync replaces this location’s current POS feed.</p>
      {status.lastSync && <p className="text-xs text-slate-600">Last successful sync: {new Date(status.lastSync).toLocaleString('en-CA')}</p>}
      {status.lastError && <p className="text-sm text-amber-800">Last sync: {status.lastError}</p>}
      {status.connected ? <>
        <Button className="w-full bg-[#F58220] text-[#303A43] hover:bg-[#db711b]" disabled={busy || status.syncing} onClick={() => setConfirmSync(true)}>{busy ? 'Syncing…' : status.syncing ? 'Sync in progress…' : 'Sync Clover now'}</Button>
        {confirmSync && <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm"><p>This updates this location’s POS feed using the last seven complete calendar days from {status.merchantName || 'Clover'}. Confirm this is the correct restaurant.</p><Button className="mt-2" disabled={busy} onClick={() => void act('sync')}>Confirm and sync Clover</Button><Button variant="ghost" disabled={busy} onClick={() => setConfirmSync(false)}>Cancel</Button></div>}
      </> : <Button className="w-full bg-[#F58220] text-[#303A43] hover:bg-[#db711b]" disabled={busy} onClick={() => void act('connect')}>{busy ? 'Opening Clover…' : status.reconnectRequired ? 'Reconnect Clover securely' : 'Connect Clover securely'}</Button>}
      {(status.connected || status.reconnectRequired) && <>
        <Button className="w-full" variant="outline" disabled={busy} onClick={() => setConfirmDisconnect(true)}>Stop automatic Clover sync</Button>
        {confirmDisconnect && <div className="rounded-xl border border-slate-200 p-3 text-sm"><p>Stop automatic updates? Previously synced sales will stay available.</p><Button className="mt-2" disabled={busy} onClick={() => void act('disconnect')}>Confirm stop sync</Button><Button variant="ghost" disabled={busy} onClick={() => setConfirmDisconnect(false)}>Cancel</Button></div>}
      </>}
      <p className="text-xs leading-5 text-slate-500">Sales are item sales after discounts, before refunds; tax and tips are excluded. Guest counts are not provided by this connection. The last seven complete calendar days are refreshed each sync.</p>
    </>}
    <Button type="button" variant="outline" className="w-full" onClick={onImport}>Import Clover sales instead</Button>
  </div>;
}
