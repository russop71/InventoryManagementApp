import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, CreditCard, ExternalLink, Loader2, MapPin, Plus, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../utils/api';

type BillingPlan = 'monthly';

interface ClientSummary {
  id: string;
  slug: string;
  name: string;
  createdAt: string;
  owner: { name: string; email: string } | null;
  userCount: number;
  activeUserCount: number;
  locationCount: number;
  actionCount30Days: number;
  lastActive: string | null;
  billing: {
    configured: boolean;
    additionalLocationPriceConfigured: boolean;
    customerCreated: boolean;
    plan: BillingPlan | null;
    status: string;
    additionalLocationQuantity: number;
    currentPeriodEnd: string | null;
  };
}

interface ClientDetail {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  users: Array<{ id: string; name: string; email: string; role: string; status: string; lastLogin: string }>;
  locations: Array<{ id: string; name: string }>;
  billing: ClientSummary['billing'] & {
    customerEmail?: string | null;
    subscriptionStartedAt: string | null;
    billingFrequency: { interval: string; intervalCount: number } | null;
    paymentMethods: Array<{ id: string; brand: string; last4: string; expMonth: number | null; expYear: number | null }>;
    payments: Array<{ id: string; number: string | null; date: string | null; amount: number; currency: string; status: string; hostedInvoiceUrl: string | null }>;
  };
}

const PLANS: Array<{ id: BillingPlan; label: string }> = [
  { id: 'monthly', label: 'Create Premium payment link' },
];

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString();
}

function billingStatusClass(status: string) {
  if (status === 'active') return 'bg-green-100 text-green-800';
  if (status === 'past_due' || status === 'unpaid') return 'bg-red-100 text-red-800';
  return 'bg-slate-100 text-slate-700';
}

export function PlatformAdmin() {
  const { user } = useAuth();
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [paymentLink, setPaymentLink] = useState('');
  const [billableLocationCount, setBillableLocationCount] = useState(1);
  const [commitmentConfirmed, setCommitmentConfirmed] = useState(false);

  const loadClients = useCallback(async () => {
    if (!user?.platformAdmin) return;
    setIsLoading(true);
    try {
      const result = await apiRequest<{ clients: ClientSummary[] }>('/api/v1/platform/accounts');
      setClients(result.clients || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load client accounts');
    } finally {
      setIsLoading(false);
    }
  }, [user?.platformAdmin]);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  const metrics = useMemo(() => ({
    companies: clients.length,
    activeSubscriptions: clients.filter(client => client.billing.status === 'active').length,
    users: clients.reduce((total, client) => total + client.userCount, 0),
    actions: clients.reduce((total, client) => total + client.actionCount30Days, 0),
  }), [clients]);

  const openClient = async (clientId: string) => {
    setIsLoading(true);
    setPaymentLink('');
    setCommitmentConfirmed(false);
    try {
      const result = await apiRequest<{ client: ClientDetail }>(`/api/v1/platform/accounts/${encodeURIComponent(clientId)}`);
      setSelectedClient(result.client);
      setBillableLocationCount(Math.max(1, result.client.locations.length, 1 + Number(result.client.billing.additionalLocationQuantity || 0)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load the client account');
    } finally {
      setIsLoading(false);
    }
  };

  const inviteClient = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setIsLoading(true);
    try {
      await apiRequest('/api/v1/platform/accounts', {
        method: 'POST',
        body: JSON.stringify({
          companyName: String(formData.get('companyName') || '').trim(),
          ownerName: String(formData.get('ownerName') || '').trim(),
          ownerEmail: String(formData.get('ownerEmail') || '').trim(),
        }),
      });
      toast.success('Client company created and its owner invitation was sent');
      setIsInviteOpen(false);
      await loadClients();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create client company');
    } finally {
      setIsLoading(false);
    }
  };

  const createPaymentLink = async (plan: BillingPlan) => {
    if (!selectedClient) return;
    setIsLoading(true);
    try {
      const result = await apiRequest<{ url: string }>(`/api/v1/platform/accounts/${encodeURIComponent(selectedClient.id)}/billing/checkout`, {
        method: 'POST',
        body: JSON.stringify({ plan, locationCount: billableLocationCount, commitmentAccepted: true }),
      });
      setPaymentLink(result.url);
      toast.success('Secure Stripe checkout link created for this client');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create Stripe checkout');
    } finally {
      setIsLoading(false);
    }
  };

  const copyPaymentLink = async () => {
    if (!paymentLink) return;
    try {
      await navigator.clipboard.writeText(paymentLink);
      toast.success('Payment link copied');
    } catch {
      toast.error('Copy failed. Open the link and copy it from your browser.');
    }
  };

  if (!user?.platformAdmin) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="py-8">
          <ShieldCheck className="mb-3 h-8 w-8 text-red-700" />
          <h2 className="text-xl font-bold text-slate-950">ZestIQ CEO access required</h2>
          <p className="mt-2 text-sm text-slate-600">This platform-level area is separate from every client company and is protected by a server-side administrator allowlist.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#A16207]">ZestIQ platform administration</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950">Client companies & billing</h2>
          <p className="mt-1 text-sm text-slate-600">CEO-only account overview. Client passwords and full card details are never exposed.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={isLoading} onClick={() => void loadClients()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
            <DialogTrigger asChild>
              <Button type="button" className="bg-[#0F172A] text-white hover:bg-[#1E293B]"><Plus className="mr-2 h-4 w-4" /> New client</Button>
            </DialogTrigger>
            <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create a client company</DialogTitle>
                <DialogDescription>This creates an isolated workspace and emails the client owner a secure invitation.</DialogDescription>
              </DialogHeader>
              <form onSubmit={inviteClient} className="space-y-4">
                <div><Label htmlFor="client-company">Company name</Label><Input id="client-company" name="companyName" required /></div>
                <div><Label htmlFor="client-owner">Owner name</Label><Input id="client-owner" name="ownerName" required /></div>
                <div><Label htmlFor="client-email">Owner email</Label><Input id="client-email" name="ownerEmail" type="email" required /></div>
                <Button type="submit" disabled={isLoading} className="w-full bg-[#0F172A] text-white hover:bg-[#1E293B]">
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Create & invite owner
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Client companies', value: metrics.companies, icon: Building2 },
          { label: 'Active subscriptions', value: metrics.activeSubscriptions, icon: CreditCard },
          { label: 'Client users', value: metrics.users, icon: Users },
          { label: '30-day app actions', value: metrics.actions, icon: ShieldCheck },
        ].map(metric => (
          <Card key={metric.label}><CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FEF9C3] text-[#0F172A]"><metric.icon className="h-5 w-5" /></div>
            <div><p className="text-2xl font-bold text-slate-950">{metric.value}</p><p className="text-xs text-slate-500">{metric.label}</p></div>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Client accounts</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {isLoading && clients.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">Loading protected client records…</p>
          ) : clients.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">No client companies yet. Create the first one above.</p>
          ) : clients.map(client => (
            <button key={client.id} type="button" onClick={() => void openClient(client.id)} className="w-full rounded-2xl border border-slate-200 p-4 text-left transition hover:border-[#F5C10E] hover:bg-[#FEFCE8]/40">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="font-bold text-slate-950">{client.name}</p><p className="mt-1 text-sm text-slate-500">{client.owner ? `${client.owner.name} · ${client.owner.email}` : 'No client owner assigned'}</p></div>
                <Badge className={`capitalize ${billingStatusClass(client.billing.status)}`}>{client.billing.status.replaceAll('_', ' ')}</Badge>
              </div>
              <div className="mt-4 grid gap-2 text-xs text-slate-600 sm:grid-cols-4">
                <span>{client.activeUserCount}/{client.userCount} active users</span>
                <span>{client.locationCount} locations</span>
                <span>{client.actionCount30Days} actions / 30 days</span>
                <span>Last active: {formatDate(client.lastActive)}</span>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedClient)} onOpenChange={open => { if (!open) { setSelectedClient(null); setPaymentLink(''); } }}>
        <DialogContent className="max-h-[90vh] max-w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-3xl">
          {selectedClient && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedClient.name}</DialogTitle>
                <DialogDescription>Created {formatDate(selectedClient.createdAt)} · client ID {selectedClient.id}</DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 sm:grid-cols-3">
                <Card><CardContent className="py-4"><p className="text-xs text-slate-400">Billing status</p><Badge className={`mt-2 capitalize ${billingStatusClass(selectedClient.billing.status)}`}>{selectedClient.billing.status.replaceAll('_', ' ')}</Badge></CardContent></Card>
                <Card><CardContent className="py-4"><p className="text-xs text-slate-400">Plan</p><p className="mt-2 font-semibold capitalize">{selectedClient.billing.plan || 'Not selected'}</p></CardContent></Card>
                <Card><CardContent className="py-4"><p className="text-xs text-slate-400">Next renewal</p><p className="mt-2 font-semibold">{formatDate(selectedClient.billing.currentPeriodEnd)}</p></CardContent></Card>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="font-semibold text-slate-950">Secure billing setup</p>
                <p className="mt-1 text-sm text-slate-500">Premium is CAD $249.99/month for one location. Each additional location is CAD $100/month. There is no free trial.</p>
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-slate-700">
                  <p className="font-semibold text-slate-950">Contract term disclosure</p>
                  <p className="mt-1">Billed monthly with a 12-month initial commitment. The subscription renews for another 12-month term unless written non-renewal notice is received at least 90 days before term end.</p>
                  <label className="mt-3 flex cursor-pointer items-start gap-2">
                    <Checkbox checked={commitmentConfirmed} onCheckedChange={checked => setCommitmentConfirmed(checked === true)} className="mt-0.5 border-slate-400 data-[state=checked]:bg-[#0F172A]" />
                    <span>I have confirmed these terms with this client before creating their checkout link.</span>
                  </label>
                </div>
                <div className="mt-3 max-w-xs">
                  <Label htmlFor="client-location-count">Total billed locations</Label>
                  <Input
                    id="client-location-count"
                    className="mt-2"
                    type="number"
                    min={Math.max(1, selectedClient.locations.length)}
                    max={100}
                    value={billableLocationCount}
                    onChange={event => setBillableLocationCount(Math.max(Math.max(1, selectedClient.locations.length), Math.min(100, Number(event.target.value) || 1)))}
                  />
                  <p className="mt-2 font-bold text-slate-950">CAD ${(249.99 + Math.max(0, billableLocationCount - 1) * 100).toFixed(2)}/month</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {PLANS.map(plan => <Button key={plan.id} type="button" size="sm" variant="outline" disabled={isLoading || !commitmentConfirmed || !selectedClient.billing.configured || selectedClient.billing.customerCreated || (billableLocationCount > 1 && !selectedClient.billing.additionalLocationPriceConfigured)} onClick={() => void createPaymentLink(plan.id)}>{plan.label}</Button>)}
                </div>
                {selectedClient.billing.customerCreated && <p className="mt-3 text-xs text-slate-500">This client already has Stripe billing. Use Stripe to manage its existing subscription rather than creating a duplicate.</p>}
                {!selectedClient.billing.configured && <p className="mt-3 text-xs text-amber-700">Connect Stripe keys and price IDs before creating payment links.</p>}
                {paymentLink && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" size="sm" onClick={() => void copyPaymentLink()} className="bg-[#0F172A] text-white hover:bg-[#1E293B]">Copy client payment link</Button>
                    <a href={paymentLink} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center rounded-md border border-slate-200 px-3 text-sm font-medium">Open checkout <ExternalLink className="ml-2 h-4 w-4" /></a>
                  </div>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="flex items-center gap-2 font-semibold"><Users className="h-4 w-4" /> Client users</p>
                  <div className="mt-3 space-y-2">{selectedClient.users.map(member => <div key={member.id} className="rounded-xl bg-slate-50 p-3"><p className="text-sm font-medium">{member.name} · {member.role}</p><p className="text-xs text-slate-500">{member.email} · {member.status}</p></div>)}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="flex items-center gap-2 font-semibold"><MapPin className="h-4 w-4" /> Locations</p>
                  <div className="mt-3 space-y-2">{selectedClient.locations.map(location => <div key={location.id} className="rounded-xl bg-slate-50 p-3 text-sm font-medium">{location.name}</div>)}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="font-semibold">Payment information</p>
                {selectedClient.billing.paymentMethods.length ? selectedClient.billing.paymentMethods.map(method => (
                  <p key={method.id} className="mt-2 text-sm capitalize text-slate-600">{method.brand} •••• {method.last4} · expires {method.expMonth}/{method.expYear}</p>
                )) : <p className="mt-2 text-sm text-slate-500">No payment method is attached.</p>}
                <p className="mt-3 text-xs text-slate-400">Full card numbers and security codes remain inside Stripe and are never returned to ZestIQ.</p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
