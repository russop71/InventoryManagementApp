import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Link } from 'react-router';
import { useAuth, type AccountLocation } from '../contexts/AuthContext';
import { apiRequest } from '../utils/api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';

export function AccountLocations() {
  const { user, accountId, locations, addLocation, updateLocation, setLocationArchived } = useAuth();
  const canManage = user?.role === 'Owner' || user?.role === 'Admin';
  const [name, setName] = useState('');
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [archived, setArchived] = useState<AccountLocation[]>([]);
  const [archiveError, setArchiveError] = useState('');
  const [archiveTarget, setArchiveTarget] = useState<AccountLocation | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    setNames(Object.fromEntries(locations.map(location => [location.id, location.name])));
  }, [locations]);

  useEffect(() => {
    let cancelled = false;
    setArchived([]);
    setArchiveError('');
    if (canManage && accountId) {
      apiRequest<{ locations: AccountLocation[] }>(`/api/v1/accounts/${encodeURIComponent(accountId)}/locations/archived`)
        .then(result => { if (!cancelled) setArchived(result.locations); })
        .catch(() => { if (!cancelled) setArchiveError('Archived locations could not be loaded.'); });
    }
    return () => { cancelled = true; };
  }, [accountId, canManage, reload]);

  const run = async (action: () => Promise<void>, message: string) => {
    if (busy || !canManage) return;
    setBusy(true);
    try {
      await action();
      toast.success(message);
      setReload(value => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update locations');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Locations</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600">
          {canManage ? 'Add, rename or archive your restaurant locations.' : 'Only owners and admins can add, rename or archive locations.'}
        </p>
        {locations.map(location => (
          <div key={location.id} className="rounded-xl border border-slate-200 p-3">
            <Label htmlFor={`location-${location.id}`}>Location name</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              <Input id={`location-${location.id}`} className="min-w-0 flex-1 basis-48" maxLength={120}
                value={names[location.id] ?? location.name} disabled={!canManage || busy}
                onChange={event => setNames(current => ({ ...current, [location.id]: event.target.value }))} />
              {canManage && <>
                <Button variant="outline" disabled={busy || (names[location.id] ?? location.name).trim().length < 2 || (names[location.id] ?? location.name).trim() === location.name}
                  onClick={() => void run(() => updateLocation(location.id, names[location.id]), 'Location name updated')}>Save name</Button>
                <Button variant="outline" disabled={busy || locations.length <= 1}
                  aria-label={`Archive ${location.name}`} onClick={() => setArchiveTarget(location)}>Archive</Button>
              </>}
            </div>
          </div>
        ))}
        {canManage && <>
          {locations.length === 1 && <p className="text-xs text-slate-500">Your last active location cannot be archived.</p>}
          <form className="space-y-2" onSubmit={event => {
            event.preventDefault();
            if (name.trim().length < 2) return;
            void run(async () => { await addLocation(name); setName(''); }, 'Location added');
          }}>
            <Label htmlFor="new-location-name">Add a location</Label>
            <div className="flex flex-wrap gap-2">
              <Input id="new-location-name" className="min-w-0 flex-1 basis-48" value={name} minLength={2} maxLength={120}
                disabled={busy} onChange={event => setName(event.target.value)} placeholder="Example: Downtown" required />
              <Button type="submit" disabled={busy || name.trim().length < 2}>Add location</Button>
            </div>
          </form>
          <p className="text-sm text-slate-600">Payment is required for each additional location. Complete payment for a location add-on before adding or restoring an extra active location. An already-paid unused location allowance can be used without paying twice.</p>
          {user?.role === 'Owner' ? <Link className="inline-block font-semibold text-primary underline" to="/app/payment-method">Review subscription &amp; payment</Link> : <p className="text-sm text-slate-600">Ask your account owner to arrange payment for an additional location.</p>}
          <p className="text-xs text-slate-500">Archiving does not cancel paid add-ons or change your bill. Review subscription changes separately.</p>
          <div className="space-y-2 border-t pt-4">
            <h3 className="font-semibold">Archived locations</h3>
            <p className="text-xs text-slate-500">Records and staff assignments are preserved. Restore a location to access its inventory, invoices and reports again.</p>
            {archiveError ? <div role="alert" className="text-sm text-red-700">{archiveError} <Button variant="outline" size="sm" onClick={() => setReload(value => value + 1)}>Retry</Button></div>
              : archived.length === 0 && <p className="text-sm text-slate-500">No archived locations.</p>}
            {archived.map(location => <div key={location.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3">
              <span>{location.name}</span><Button variant="outline" disabled={busy} aria-label={`Restore ${location.name}`}
                onClick={() => void run(() => setLocationArchived(location.id, false), 'Location restored')}>Restore</Button>
            </div>)}
          </div>
        </>}
        <Dialog open={!!archiveTarget} onOpenChange={open => { if (!open && !busy) setArchiveTarget(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Archive {archiveTarget?.name}?</DialogTitle>
              <DialogDescription>This removes the location from daily work and the location switcher. No inventory, invoices, schedules or reports are deleted. Staff with access only to this location will need another assignment. You can restore it here later, subject to your active location allowance. Your subscription charges will not change.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" disabled={busy} onClick={() => setArchiveTarget(null)}>Cancel</Button>
              <Button disabled={busy || locations.length <= 1} onClick={() => {
                if (!archiveTarget) return;
                void run(async () => { await setLocationArchived(archiveTarget.id, true); setArchiveTarget(null); }, 'Location archived — records preserved');
              }}>{busy ? 'Archiving…' : 'Archive location'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
