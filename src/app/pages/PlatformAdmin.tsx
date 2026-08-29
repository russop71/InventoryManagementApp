import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Building2, CheckCircle2, ClipboardCheck, CreditCard, ExternalLink, Loader2, MapPin, Plus, RefreshCw, ShieldCheck, TrendingUp, UserCheck, Users } from 'lucide-react';
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
    schedulingPriceConfigured: boolean;
    schedulingEnabled: boolean;
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
  onboarding: { clientProfile?: ClientOnboardingDetails; status?: string };
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

interface ClientOnboardingDetails {
  legalName?: string;
  billingEmail?: string;
  phone?: string;
  billingPhone?: string;
  businessAddress?: string;
  billingAddress?: string;
  primaryManager?: string;
  primaryManagerEmail?: string;
  locationCount?: string;
  posSystem?: string;
  supplierAccounts?: string;
  taxSettings?: string;
  currency?: string;
  foodCostTarget?: string;
  labourTarget?: string;
  orderingDays?: string;
  importStatus?: string;
  schedulingEnabled?: boolean;
  privacyAccepted?: boolean;
  termsAccepted?: boolean;
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(value);
}

function daysSince(value: string | null | undefined) {
  if (!value) return Number.POSITIVE_INFINITY;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
}

function healthFor(client: ClientSummary) {
  const inactiveDays = daysSince(client.lastActive);
  let score = 0;
  if (client.billing.status === 'active') score += 35;
  if (client.activeUserCount > 0) score += 20;
  if (client.actionCount30Days >= 10) score += 25;
  else if (client.actionCount30Days > 0) score += 12;
  if (inactiveDays <= 7) score += 20;
  else if (inactiveDays <= 14) score += 8;
  if (!client.owner) score = Math.min(score, 35);
  const label = score >= 75 ? 'Healthy' : score >= 45 ? 'Needs attention' : 'At risk';
  const tone = score >= 75 ? 'bg-emerald-100 text-emerald-800' : score >= 45 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800';
  return { score, label, tone, inactiveDays };
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
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [selectedClientUser, setSelectedClientUser] = useState<ClientDetail['users'][number] | null>(null);

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

  const executive = useMemo(() => {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 86_400_000;
    const activeOrCollecting = clients.filter(client => ['active', 'past_due', 'unpaid'].includes(client.billing.status));
    const estimatedMrr = activeOrCollecting.reduce((total, client) => {
      const locationCount = Math.max(1, client.locationCount);
      const schedulingCharge = client.billing.schedulingEnabled ? 49.99 : 0;
      return total + 249.99 + Math.max(0, locationCount - 1) * 199 + schedulingCharge;
    }, 0);
    const health = clients.map(client => ({ client, ...healthFor(client) }));
    const actionItems = [
      ...clients.filter(client => ['past_due', 'unpaid'].includes(client.billing.status)).map(client => ({ client, title: 'Payment needs attention', detail: `${client.name} is ${client.billing.status.replace('_', ' ')}. Review the Stripe subscription and contact the owner.`, tone: 'text-red-700 bg-red-50 border-red-200' })),
      ...clients.filter(client => client.billing.status === 'not_configured').map(client => ({ client, title: 'Billing is not configured', detail: `${client.name} has no active subscription. Create a checkout link when the client is ready.`, tone: 'text-amber-800 bg-amber-50 border-amber-200' })),
      ...clients.filter(client => !client.owner).map(client => ({ client, title: 'Owner required', detail: `${client.name} does not have a company owner assigned.`, tone: 'text-red-700 bg-red-50 border-red-200' })),
      ...health.filter(item => item.inactiveDays >= 14 && Number.isFinite(item.inactiveDays)).map(item => ({ client: item.client, title: 'Client may need outreach', detail: `${item.client.name} has not been active for ${item.inactiveDays} days.`, tone: 'text-amber-800 bg-amber-50 border-amber-200' })),
    ].slice(0, 6);
    const recentClients = clients.filter(client => {
      const created = new Date(client.createdAt).getTime();
      return !Number.isNaN(created) && created >= thirtyDaysAgo;
    });
    const readyForActivation = clients.filter(client => client.owner && client.locationCount > 0 && client.billing.status !== 'active').length;
    const renewalsDue = clients.filter(client => {
      if (!client.billing.currentPeriodEnd) return false;
      const end = new Date(client.billing.currentPeriodEnd).getTime();
      return end >= now && end <= now + 90 * 86_400_000;
    }).length;
    return { estimatedMrr, health, actionItems, recentClients: recentClients.length, readyForActivation, renewalsDue, atRisk: health.filter(item => item.label === 'At risk').length };
  }, [clients]);

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
          onboardingDetails: {
            legalName: String(formData.get('legalName') || '').trim(),
            billingEmail: String(formData.get('billingEmail') || '').trim(),
            phone: String(formData.get('phone') || '').trim(),
            billingPhone: String(formData.get('billingPhone') || '').trim(),
            businessAddress: String(formData.get('businessAddress') || '').trim(),
            billingAddress: String(formData.get('billingAddress') || '').trim(),
            primaryManager: String(formData.get('primaryManager') || '').trim(),
            primaryManagerEmail: String(formData.get('primaryManagerEmail') || '').trim(),
            locationCount: String(formData.get('locationCount') || '1'),
            posSystem: String(formData.get('posSystem') || '').trim(),
            supplierAccounts: String(formData.get('supplierAccounts') || '').trim(),
            taxSettings: String(formData.get('taxSettings') || '').trim(),
            currency: String(formData.get('currency') || 'CAD'),
            foodCostTarget: String(formData.get('foodCostTarget') || '30'),
            labourTarget: String(formData.get('labourTarget') || '30'),
            orderingDays: String(formData.get('orderingDays') || '').trim(),
            importStatus: String(formData.get('importStatus') || '').trim(),
            schedulingEnabled: formData.get('schedulingEnabled') === 'on',
            privacyAccepted: formData.get('privacyAccepted') === 'on',
            termsAccepted: formData.get('termsAccepted') === 'on',
          },
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

  const saveClientProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedClient) return;
    const formData = new FormData(event.currentTarget);
    setIsLoading(true);
    try {
      await apiRequest(`/api/v1/platform/accounts/${encodeURIComponent(selectedClient.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          companyName: String(formData.get('companyName') || '').trim(),
          ownerName: String(formData.get('ownerName') || '').trim(),
          ownerEmail: String(formData.get('ownerEmail') || '').trim(),
          onboardingDetails: {
            legalName: String(formData.get('legalName') || '').trim(), billingEmail: String(formData.get('billingEmail') || '').trim(), phone: String(formData.get('phone') || '').trim(), billingPhone: String(formData.get('billingPhone') || '').trim(), businessAddress: String(formData.get('businessAddress') || '').trim(), billingAddress: String(formData.get('billingAddress') || '').trim(), primaryManager: String(formData.get('primaryManager') || '').trim(), primaryManagerEmail: String(formData.get('primaryManagerEmail') || '').trim(), locationCount: String(formData.get('locationCount') || '1'), posSystem: String(formData.get('posSystem') || '').trim(), supplierAccounts: String(formData.get('supplierAccounts') || '').trim(), taxSettings: String(formData.get('taxSettings') || '').trim(), currency: String(formData.get('currency') || 'CAD'), foodCostTarget: String(formData.get('foodCostTarget') || ''), labourTarget: String(formData.get('labourTarget') || ''), orderingDays: String(formData.get('orderingDays') || '').trim(), importStatus: String(formData.get('importStatus') || '').trim(), schedulingEnabled: formData.get('schedulingEnabled') === 'on', privacyAccepted: formData.get('privacyAccepted') === 'on', termsAccepted: formData.get('termsAccepted') === 'on',
          },
        }),
      });
      toast.success('Client account details saved');
      setIsEditingClient(false);
      await openClient(selectedClient.id);
      await loadClients();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save client account');
    } finally { setIsLoading(false); }
  };

  const saveClientUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedClient || !selectedClientUser) return;
    const formData = new FormData(event.currentTarget);
    setIsLoading(true);
    try {
      await apiRequest(`/api/v1/platform/accounts/${encodeURIComponent(selectedClient.id)}/users/${encodeURIComponent(selectedClientUser.id)}`, {
        method: 'PUT',
        body: JSON.stringify({ name: String(formData.get('name') || '').trim(), email: String(formData.get('email') || '').trim(), role: String(formData.get('role') || ''), status: String(formData.get('status') || '') }),
      });
      toast.success('Client user permissions updated');
      setSelectedClientUser(null);
      await openClient(selectedClient.id);
      await loadClients();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update this client user');
    } finally { setIsLoading(false); }
  };

  const resetClientUserPassword = async () => {
    if (!selectedClient || !selectedClientUser) return;
    setIsLoading(true);
    try {
      await apiRequest(`/api/v1/platform/accounts/${encodeURIComponent(selectedClient.id)}/users/${encodeURIComponent(selectedClientUser.id)}/password-reset`, { method: 'POST' });
      toast.success(`Password reset email sent to ${selectedClientUser.email}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to send a password reset');
    } finally { setIsLoading(false); }
  };

  const deleteClientUser = async () => {
    if (!selectedClient || !selectedClientUser || !window.confirm(`Remove ${selectedClientUser.name} from ${selectedClient.name}? They will no longer be able to sign in.`)) return;
    setIsLoading(true);
    try {
      await apiRequest(`/api/v1/platform/accounts/${encodeURIComponent(selectedClient.id)}/users/${encodeURIComponent(selectedClientUser.id)}`, { method: 'DELETE' });
      toast.success('Client user removed');
      setSelectedClientUser(null);
      await openClient(selectedClient.id);
      await loadClients();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to remove this client user');
    } finally { setIsLoading(false); }
  };

  const createPaymentLink = async (plan: BillingPlan) => {
    if (!selectedClient) return;
    setIsLoading(true);
    try {
      const result = await apiRequest<{ url: string }>(`/api/v1/platform/accounts/${encodeURIComponent(selectedClient.id)}/billing/checkout`, {
        method: 'POST',
        body: JSON.stringify({ plan, locationCount: billableLocationCount, schedulingEnabled: selectedClient.onboarding?.clientProfile?.schedulingEnabled === true, commitmentAccepted: true }),
      });
      setPaymentLink(result.url);
      toast.success('Secure Stripe checkout link created for this client');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create Stripe checkout');
    } finally {
      setIsLoading(false);
    }
  };

  const saveSchedulingModule = async (enabled: boolean) => {
    if (!selectedClient) return;
    setIsLoading(true);
    try {
      await apiRequest(`/api/v1/platform/accounts/${encodeURIComponent(selectedClient.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ onboardingDetails: { schedulingEnabled: enabled } }),
      });
      toast.success(enabled ? 'Labour & Scheduling enabled for this client' : 'Labour & Scheduling turned off for this client');
      await openClient(selectedClient.id);
      await loadClients();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update the Scheduling module');
    } finally { setIsLoading(false); }
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
          <p className="mt-1 text-sm text-slate-600">Your operating view of growth, client health, revenue and platform risk. Client passwords and full card details are never exposed.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={isLoading} onClick={() => void loadClients()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
            <DialogTrigger asChild>
              <Button type="button" className="bg-[#0F172A] text-white hover:bg-[#1E293B]"><Plus className="mr-2 h-4 w-4" /> New client</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create a client company</DialogTitle>
                <DialogDescription>This creates an isolated workspace and emails the client owner a secure invitation.</DialogDescription>
              </DialogHeader>
              <form onSubmit={inviteClient} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><Label htmlFor="client-company">Restaurant name</Label><Input id="client-company" name="companyName" required /></div>
                  <div><Label htmlFor="client-legal">Legal business name</Label><Input id="client-legal" name="legalName" /></div>
                  <div><Label htmlFor="client-owner">Owner name</Label><Input id="client-owner" name="ownerName" required /></div>
                  <div><Label htmlFor="client-email">Owner email</Label><Input id="client-email" name="ownerEmail" type="email" required /></div>
                  <div><Label htmlFor="client-manager">Primary manager</Label><Input id="client-manager" name="primaryManager" /></div>
                  <div><Label htmlFor="client-manager-email">Manager email</Label><Input id="client-manager-email" name="primaryManagerEmail" type="email" /></div>
                  <div><Label htmlFor="client-billing">Billing email</Label><Input id="client-billing" name="billingEmail" type="email" /></div>
                  <div><Label htmlFor="client-locations">Locations</Label><Input id="client-locations" name="locationCount" type="number" min="1" defaultValue="1" /></div>
                  <div><Label htmlFor="client-phone">Business phone</Label><Input id="client-phone" name="phone" type="tel" /></div>
                  <div><Label htmlFor="client-billing-phone">Billing phone</Label><Input id="client-billing-phone" name="billingPhone" type="tel" /></div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="client-business-address">Business address</Label><Input id="client-business-address" name="businessAddress" /></div><div><Label htmlFor="client-address">Billing address</Label><Input id="client-address" name="billingAddress" /></div></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><Label htmlFor="client-pos">POS system</Label><Input id="client-pos" name="posSystem" placeholder="Toast, TouchBistro, Lightspeed…" /></div>
                  <div><Label htmlFor="client-suppliers">Suppliers / account numbers</Label><Input id="client-suppliers" name="supplierAccounts" placeholder="Supplier names or account numbers" /></div>
                  <div><Label htmlFor="client-tax">Tax settings</Label><Input id="client-tax" name="taxSettings" placeholder="e.g. HST 13%" /></div>
                  <div><Label htmlFor="client-currency">Currency</Label><select id="client-currency" name="currency" defaultValue="CAD" className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"><option>CAD</option><option>USD</option></select></div>
                  <div><Label htmlFor="client-food-target">Food cost target %</Label><Input id="client-food-target" name="foodCostTarget" type="number" min="0" max="100" defaultValue="30" /></div>
                  <div><Label htmlFor="client-labour-target">Labour target %</Label><Input id="client-labour-target" name="labourTarget" type="number" min="0" max="100" defaultValue="30" /></div>
                </div>
                  <div><Label htmlFor="client-ordering">Ordering days</Label><Input id="client-ordering" name="orderingDays" placeholder="e.g. Monday, Thursday" /></div>
                  <div><Label htmlFor="client-imports">Data import status</Label><Input id="client-imports" name="importStatus" placeholder="Inventory, recipes, menu, sales history…" /></div>
                  <label className="flex items-start gap-3 rounded-xl border border-[#F5C10E] bg-[#FEF9C3] p-3 text-sm sm:col-span-2"><Checkbox name="schedulingEnabled" className="mt-0.5" /><span><span className="block font-bold text-slate-950">Add Labour & Scheduling — CAD $49.99/month</span><span className="mt-1 block text-slate-600">Optional module. Leave it off for ZestIQ Basic; it can be enabled later from this client account.</span></span></label>
                <label className="flex gap-2 text-sm text-slate-700"><Checkbox name="privacyAccepted" /> Privacy acknowledgement received</label>
                <label className="flex gap-2 text-sm text-slate-700"><Checkbox name="termsAccepted" /> Agreement and 12-month billing terms discussed</label>
                <Button type="submit" disabled={isLoading} className="w-full bg-[#0F172A] text-white hover:bg-[#1E293B]">
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Create & invite owner
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <section className="overflow-hidden rounded-3xl bg-[#0F172A] p-5 text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#F5C10E]">CEO action centre</p>
            <h3 className="mt-1 text-2xl font-extrabold">What needs your attention today</h3>
            <p className="mt-1 max-w-2xl text-sm text-slate-300">Prioritized account, revenue and adoption signals—without opening a client’s operational workspace.</p>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-3"><p className="text-xs uppercase tracking-wide text-slate-300">Accounts at risk</p><p className="mt-1 text-2xl font-extrabold text-[#F5C10E]">{executive.atRisk}</p></div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {executive.actionItems.length ? executive.actionItems.map(item => (
            <button key={`${item.title}-${item.client.id}`} type="button" onClick={() => void openClient(item.client.id)} className="flex items-start gap-3 rounded-2xl bg-white/10 p-4 text-left transition hover:bg-white/15">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#F5C10E]" />
              <span><span className="block font-bold">{item.title}</span><span className="mt-1 block text-sm text-slate-300">{item.detail}</span></span>
            </button>
          )) : <div className="flex items-center gap-3 rounded-2xl bg-emerald-500/15 p-4 text-emerald-100"><CheckCircle2 className="h-5 w-5" />No urgent billing or client-health issues right now.</div>}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Estimated contracted MRR', value: formatCurrency(executive.estimatedMrr), icon: TrendingUp, note: 'Active + collection-risk accounts' },
          { label: 'Active subscriptions', value: metrics.activeSubscriptions, icon: CreditCard, note: `${executive.renewalsDue} renewal${executive.renewalsDue === 1 ? '' : 's'} in 90 days` },
          { label: 'Client companies', value: metrics.companies, icon: Building2, note: `${executive.recentClients} added in 30 days` },
          { label: '30-day product activity', value: metrics.actions, icon: Activity, note: `${metrics.users} client users` },
        ].map(metric => (
          <Card key={metric.label}><CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FEF9C3] text-[#0F172A]"><metric.icon className="h-5 w-5" /></div>
            <div><p className="text-2xl font-bold text-slate-950">{metric.value}</p><p className="text-xs text-slate-500">{metric.label}</p><p className="mt-1 text-[11px] text-slate-400">{metric.note}</p></div>
          </CardContent></Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2"><CardHeader><CardTitle>Client health & product adoption</CardTitle><p className="text-sm text-slate-500">A practical health signal based on subscription state, active users, recent use and last activity.</p></CardHeader><CardContent className="space-y-2">
          {executive.health.length ? executive.health.sort((a, b) => a.score - b.score).map(item => (
            <button type="button" key={item.client.id} onClick={() => void openClient(item.client.id)} className="grid w-full gap-3 rounded-2xl border border-slate-200 p-3 text-left transition hover:border-[#F5C10E] sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
              <div><p className="font-semibold text-slate-950">{item.client.name}</p><p className="mt-1 text-xs text-slate-500">{item.client.activeUserCount}/{item.client.userCount} active users · {item.client.actionCount30Days} actions in 30 days · {item.inactiveDays === Infinity ? 'No recent activity' : `active ${item.inactiveDays === 0 ? 'today' : `${item.inactiveDays}d ago`}`}</p></div>
              <Badge className={item.tone}>{item.label}</Badge><span className="text-sm font-bold text-slate-700">{item.score}/100</span>
            </button>
          )) : <p className="py-6 text-sm text-slate-500">Client health will appear as soon as accounts are created.</p>}
        </CardContent></Card>
        <div className="space-y-4">
          <Card><CardHeader><CardTitle className="text-base">Growth & activation</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">New client companies</span><span className="font-bold">{executive.recentClients} <span className="font-normal text-slate-400">last 30 days</span></span></div>
            <div className="flex justify-between"><span className="text-slate-500">Ready for activation</span><span className="font-bold">{executive.readyForActivation}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Paying subscriptions</span><span className="font-bold">{metrics.activeSubscriptions}</span></div>
            <p className="rounded-xl bg-[#FEF9C3] p-3 text-xs text-slate-700">Use this area to see where clients are in the journey: created, checkout sent, paid and actively using ZestIQ.</p>
          </CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Security & platform safeguards</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-slate-600">
            <p className="flex gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" /><span>Client workspaces are isolated by company account.</span></p>
            <p className="flex gap-2"><CreditCard className="h-4 w-4 shrink-0 text-emerald-600" /><span>Card details stay in Stripe; ZestIQ only displays safe payment metadata.</span></p>
            <p className="flex gap-2"><UserCheck className="h-4 w-4 shrink-0 text-emerald-600" /><span>CEO access is separate from restaurant manager access.</span></p>
          </CardContent></Card>
        </div>
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
              <div className="mt-4 grid gap-2 text-xs text-slate-600 sm:grid-cols-5">
                <span>{client.activeUserCount}/{client.userCount} active users</span>
                <span>{client.locationCount} locations</span>
                <span>{client.actionCount30Days} actions / 30 days</span>
                <span>Last active: {formatDate(client.lastActive)}</span>
                <span className="font-semibold">Health: {healthFor(client).score}/100</span>
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

              <div className="rounded-2xl border border-[#F5C10E] bg-[#FFFCED] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="font-semibold text-slate-950">Client app access</p><p className="mt-1 text-sm text-slate-600">ZestIQ Basic keeps inventory, recipes, purchasing, invoices, reporting and AI. The CAD $49.99/month add-on unlocks labour tracking, manager scheduling and ZestEmployee across every location.</p></div>
                  <Badge className={selectedClient.onboarding?.clientProfile?.schedulingEnabled === true ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}>{selectedClient.onboarding?.clientProfile?.schedulingEnabled === true ? 'Enabled' : 'Not included'}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" disabled={isLoading || selectedClient.onboarding?.clientProfile?.schedulingEnabled === true} onClick={() => void saveSchedulingModule(true)} className="bg-[#0F172A] text-white hover:bg-[#1E293B]">Enable add-on +$49.99</Button>
                  <Button type="button" size="sm" variant="outline" disabled={isLoading || selectedClient.onboarding?.clientProfile?.schedulingEnabled !== true} onClick={() => void saveSchedulingModule(false)}>Remove add-on</Button>
                </div>
                <p className="mt-3 text-xs text-slate-500">Access changes immediately for the client. If a Stripe subscription already exists, update its Scheduling line item in Stripe so billing matches access.</p>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="font-semibold text-slate-950">Secure billing setup</p>
                <p className="mt-1 text-sm text-slate-500">ZestIQ Basic is CAD $249.99/month for the first location. Each additional location is CAD $199/month. Scheduling is a CAD $49.99/month account add-on and covers every location only when selected. There is no free trial.</p>
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
                  <p className="mt-2 font-bold text-slate-950">CAD ${(249.99 + Math.max(0, billableLocationCount - 1) * 199 + (selectedClient.onboarding?.clientProfile?.schedulingEnabled === true ? 49.99 : 0)).toFixed(2)}/month</p>
                  <p className="mt-1 text-xs text-slate-500">Scheduling: {selectedClient.onboarding?.clientProfile?.schedulingEnabled === true ? 'CAD $49.99/month, covering every location' : 'not included'}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {PLANS.map(plan => <Button key={plan.id} type="button" size="sm" variant="outline" disabled={isLoading || !commitmentConfirmed || !selectedClient.billing.configured || selectedClient.billing.customerCreated || (billableLocationCount > 1 && !selectedClient.billing.additionalLocationPriceConfigured) || (selectedClient.onboarding?.clientProfile?.schedulingEnabled === true && !selectedClient.billing.schedulingPriceConfigured)} onClick={() => void createPaymentLink(plan.id)}>{plan.label}</Button>)}
                </div>
                {selectedClient.billing.customerCreated && <p className="mt-3 text-xs text-slate-500">This client already has Stripe billing. Use Stripe to manage its existing subscription rather than creating a duplicate.</p>}
                {!selectedClient.billing.configured && <p className="mt-3 text-xs text-amber-700">Connect Stripe keys and price IDs before creating payment links.</p>}
                {selectedClient.onboarding?.clientProfile?.schedulingEnabled === true && !selectedClient.billing.schedulingPriceConfigured && <p className="mt-3 text-xs text-amber-700">Add the CAD $49.99 monthly Scheduling price ID in Stripe/Vercel before creating this checkout link.</p>}
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
                  <div className="mt-3 space-y-2">{selectedClient.users.map(member => <button key={member.id} type="button" onClick={() => setSelectedClientUser(member)} className="w-full rounded-xl bg-slate-50 p-3 text-left transition hover:bg-amber-50"><p className="text-sm font-medium">{member.name} · {member.role}</p><p className="text-xs text-slate-500">{member.email} · {member.status}</p></button>)}</div>
                  <p className="mt-3 text-xs text-slate-500">Click a user to manage access, permissions, or sign-in help.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="flex items-center gap-2 font-semibold"><MapPin className="h-4 w-4" /> Locations</p>
                  <div className="mt-3 space-y-2">{selectedClient.locations.map(location => <div key={location.id} className="rounded-xl bg-slate-50 p-3 text-sm font-medium">{location.name}</div>)}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="flex items-center gap-2 font-semibold text-slate-950"><ClipboardCheck className="h-4 w-4" /> Client onboarding record</p><Button type="button" size="sm" variant="outline" onClick={() => setIsEditingClient(value => !value)}>{isEditingClient ? 'Close edit' : 'Edit client details'}</Button></div>
                {(() => {
                  const details = selectedClient.onboarding?.clientProfile || {};
                  const checks = [
                    ['Owner invited', Boolean(selectedClient.users.some(member => member.role === 'Owner'))],
                    ['Location plan confirmed', Boolean(details.locationCount || selectedClient.locations.length)],
                    ['POS selected', Boolean(details.posSystem)],
                    ['Suppliers collected', Boolean(details.supplierAccounts)],
                    ['Operational targets set', Boolean(details.foodCostTarget && details.labourTarget)],
                    ['Data imports scoped', Boolean(details.importStatus)],
                    ['Privacy acknowledged', details.privacyAccepted === true],
                    ['Agreement discussed', details.termsAccepted === true],
                    ['Billing active', selectedClient.billing.status === 'active'],
                  ];
                  const complete = checks.filter(([, done]) => done).length;
                  return <><p className="mt-1 text-sm text-slate-500">{complete}/{checks.length} onboarding checks complete</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{checks.map(([label, done]) => <div key={label} className={`rounded-xl p-3 text-sm ${done ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{done ? '✓' : '○'} {label}</div>)}</div><div className="mt-4 grid gap-2 text-sm sm:grid-cols-2"><p><span className="text-slate-500">Legal name:</span> {details.legalName || 'Not added'}</p><p><span className="text-slate-500">Business phone:</span> {details.phone || 'Not added'}</p><p><span className="text-slate-500">Business address:</span> {details.businessAddress || 'Not added'}</p><p><span className="text-slate-500">Billing:</span> {details.billingEmail || 'Not added'}</p><p><span className="text-slate-500">POS:</span> {details.posSystem || 'Not selected'}</p><p><span className="text-slate-500">Targets:</span> food {details.foodCostTarget || '—'}% · labour {details.labourTarget || '—'}%</p></div>{isEditingClient && <form onSubmit={saveClientProfile} className="mt-5 grid gap-3 border-t pt-4 sm:grid-cols-2"><div><Label>Restaurant name</Label><Input name="companyName" defaultValue={selectedClient.name} required /></div><div><Label>Legal name</Label><Input name="legalName" defaultValue={details.legalName || ''} /></div><div><Label>Owner name</Label><Input name="ownerName" defaultValue={selectedClient.users.find(user => user.role === 'Owner')?.name || ''} /></div><div><Label>Owner sign-in email</Label><Input name="ownerEmail" type="email" defaultValue={selectedClient.users.find(user => user.role === 'Owner')?.email || ''} /></div><div><Label>Business phone</Label><Input name="phone" type="tel" defaultValue={details.phone || ''} /></div><div><Label>Billing phone</Label><Input name="billingPhone" type="tel" defaultValue={details.billingPhone || ''} /></div><div><Label>Business address</Label><Input name="businessAddress" defaultValue={details.businessAddress || ''} /></div><div><Label>Billing address</Label><Input name="billingAddress" defaultValue={details.billingAddress || ''} /></div><div><Label>Billing email</Label><Input name="billingEmail" type="email" defaultValue={details.billingEmail || ''} /></div><div><Label>Primary manager</Label><Input name="primaryManager" defaultValue={details.primaryManager || ''} /></div><div><Label>Manager email</Label><Input name="primaryManagerEmail" type="email" defaultValue={details.primaryManagerEmail || ''} /></div><div><Label>Locations</Label><Input name="locationCount" type="number" min="1" defaultValue={details.locationCount || selectedClient.locations.length || 1} /></div><div><Label>POS</Label><Input name="posSystem" defaultValue={details.posSystem || ''} /></div><div><Label>Supplier accounts</Label><Input name="supplierAccounts" defaultValue={details.supplierAccounts || ''} /></div><div><Label>Tax settings</Label><Input name="taxSettings" defaultValue={details.taxSettings || ''} /></div><div><Label>Currency</Label><Input name="currency" defaultValue={details.currency || 'CAD'} /></div><div><Label>Food cost target %</Label><Input name="foodCostTarget" type="number" defaultValue={details.foodCostTarget || ''} /></div><div><Label>Labour target %</Label><Input name="labourTarget" type="number" defaultValue={details.labourTarget || ''} /></div><div><Label>Ordering days</Label><Input name="orderingDays" defaultValue={details.orderingDays || ''} /></div><div><Label>Import status</Label><Input name="importStatus" defaultValue={details.importStatus || ''} /></div><label className="flex items-center gap-2 text-sm"><Checkbox name="privacyAccepted" defaultChecked={details.privacyAccepted === true} /> Privacy acknowledgement</label><label className="flex items-center gap-2 text-sm"><Checkbox name="termsAccepted" defaultChecked={details.termsAccepted === true} /> Agreement discussed</label><Button type="submit" disabled={isLoading} className="sm:col-span-2 bg-[#0F172A] text-white">Save client details</Button></form>}</>;
                })()}
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
      <Dialog open={Boolean(selectedClientUser)} onOpenChange={open => { if (!open) setSelectedClientUser(null); }}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          {selectedClientUser && <><DialogHeader><DialogTitle>Manage client user</DialogTitle><DialogDescription>Platform-only access support for {selectedClient?.name}. Changes take effect on the user’s next request.</DialogDescription></DialogHeader><form onSubmit={saveClientUser} className="space-y-4"><div className="rounded-2xl bg-slate-50 p-3 text-sm"><p className="font-semibold text-slate-900">Last sign-in</p><p className="mt-1 text-slate-500">{formatDate(selectedClientUser.lastLogin)}</p></div><div><Label htmlFor="client-user-name">Full name</Label><Input id="client-user-name" name="name" className="mt-2" defaultValue={selectedClientUser.name} required /></div><div><Label htmlFor="client-user-email">Sign-in email</Label><Input id="client-user-email" name="email" type="email" className="mt-2" defaultValue={selectedClientUser.email} required /></div><div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="client-user-role">Permissions</Label><select id="client-user-role" name="role" defaultValue={selectedClientUser.role} className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"><option>Owner</option><option>Admin</option><option>Manager</option><option>BOH Manager</option><option>FOH Manager</option><option>Staff</option></select></div><div><Label htmlFor="client-user-status">Account access</Label><select id="client-user-status" name="status" defaultValue={selectedClientUser.status} className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"><option>Active</option><option>Inactive</option></select></div></div><div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><p className="font-semibold">Support tools</p><p className="mt-1">Send a password reset if the client cannot sign in. Set an account to Inactive to pause access without deleting their record.</p></div><div className="flex flex-wrap justify-between gap-2 border-t pt-4"><Button type="button" variant="outline" disabled={isLoading} onClick={() => void resetClientUserPassword()}>Send password reset</Button><Button type="button" variant="destructive" disabled={isLoading} onClick={() => void deleteClientUser()}>Delete user</Button><div className="ml-auto flex gap-2"><Button type="button" variant="outline" onClick={() => setSelectedClientUser(null)}>Cancel</Button><Button type="submit" disabled={isLoading} className="bg-[#0F172A] text-white hover:bg-[#1E293B]">Save permissions</Button></div></div></form></>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
