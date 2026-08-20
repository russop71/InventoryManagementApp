import { useCallback, useEffect, useState } from 'react';
import { Check, CreditCard, Download, ExternalLink, LockKeyhole, Receipt, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../utils/api';

type BillingPlan = 'monthly';

interface BillingDetails {
  configured: boolean;
  additionalLocationPriceConfigured: boolean;
  customerCreated: boolean;
  customerEmail?: string | null;
  plan: BillingPlan | null;
  status: string;
  additionalLocationQuantity: number;
  subscriptionStartedAt: string | null;
  currentPeriodEnd: string | null;
  billingFrequency: {
    interval: string;
    intervalCount: number;
  } | null;
  paymentMethods: Array<{
    id: string;
    brand: string;
    last4: string;
    expMonth: number | null;
    expYear: number | null;
    holderName: string | null;
  }>;
  payments: Array<{
    id: string;
    number: string | null;
    date: string | null;
    amount: number;
    currency: string;
    status: string;
    hostedInvoiceUrl: string | null;
    invoicePdf: string | null;
  }>;
}

const PLANS: Array<{ id: BillingPlan; name: string; price: string; detail: string }> = [
  { id: 'monthly', name: 'ZestIQ Premium', price: 'CAD $249.99', detail: 'Per month · one location included · no free trial' },
];

function formatDate(value: string | null) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleDateString();
}

function formatFrequency(frequency: BillingDetails['billingFrequency']) {
  if (!frequency) return 'Not started';
  if (frequency.intervalCount === 1) return `Every ${frequency.interval}`;
  return `Every ${frequency.intervalCount} ${frequency.interval}s`;
}

function statusClass(status: string) {
  if (status === 'active') return 'bg-green-100 text-green-800';
  if (status === 'past_due' || status === 'unpaid') return 'bg-red-100 text-red-800';
  return 'bg-slate-100 text-slate-700';
}

export function PaymentMethod() {
  const { user, accountId, accountName, locations } = useAuth();
  const isOwner = user?.role === 'Owner';
  const [billing, setBilling] = useState<BillingDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [locationCount, setLocationCount] = useState(Math.max(1, locations.length));

  const loadBilling = useCallback(async () => {
    if (!accountId || !isOwner) return;
    setIsLoading(true);
    try {
      const payload = await apiRequest<{ billing: BillingDetails }>(`/api/v1/accounts/${encodeURIComponent(accountId)}/billing`);
      setBilling(payload.billing);
      setLocationCount(Math.max(1, locations.length, 1 + Number(payload.billing.additionalLocationQuantity || 0)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load billing');
    } finally {
      setIsLoading(false);
    }
  }, [accountId, isOwner, locations.length]);

  useEffect(() => {
    void loadBilling();
    const checkout = new URLSearchParams(window.location.search).get('checkout');
    if (checkout === 'success') toast.success('Subscription checkout completed. Billing details will update shortly.');
    if (checkout === 'cancelled') toast.info('Checkout was cancelled. No payment was taken.');
  }, [loadBilling]);

  const openCheckout = async (plan: BillingPlan) => {
    if (!accountId) return;
    setIsLoading(true);
    try {
      const result = await apiRequest<{ url: string }>(`/api/v1/accounts/${encodeURIComponent(accountId)}/billing/checkout`, {
        method: 'POST',
        body: JSON.stringify({ plan, locationCount }),
      });
      window.location.assign(result.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to start secure checkout');
      setIsLoading(false);
    }
  };

  const openPortal = async () => {
    if (!accountId) return;
    setIsLoading(true);
    try {
      const result = await apiRequest<{ url: string }>(`/api/v1/accounts/${encodeURIComponent(accountId)}/billing/portal`, {
        method: 'POST',
      });
      window.location.assign(result.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to open billing portal');
      setIsLoading(false);
    }
  };

  if (!isOwner) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="py-8">
          <LockKeyhole className="mb-3 h-8 w-8 text-amber-700" />
          <h2 className="text-xl font-bold text-slate-950">Company owner access required</h2>
          <p className="mt-2 text-sm text-slate-600">Only the company Owner can see subscriptions, payment history, payment methods, and renewal dates.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Owner control center</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950">Subscription & billing</h2>
          <p className="mt-1 text-sm text-slate-600">{accountName} · Stripe-secured payments</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={isLoading} onClick={() => void loadBilling()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          {billing?.customerCreated && (
            <Button type="button" disabled={isLoading} onClick={() => void openPortal()} className="bg-[#0F172A] text-white hover:bg-[#1E293B]">
              Manage in Stripe <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {billing && !billing.configured && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-4 text-sm text-amber-900">
            Secure billing screens are ready, but Stripe keys and plan price IDs still need to be connected before customers can subscribe.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-slate-400">Status</p>
            <Badge className={`mt-2 capitalize ${statusClass(billing?.status || 'not configured')}`}>{(billing?.status || 'not configured').replaceAll('_', ' ')}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-slate-400">Subscription started</p>
            <p className="mt-2 font-semibold text-slate-900">{formatDate(billing?.subscriptionStartedAt || null)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-slate-400">Billing frequency</p>
            <p className="mt-2 font-semibold capitalize text-slate-900">{formatFrequency(billing?.billingFrequency || null)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-slate-400">Next renewal</p>
            <p className="mt-2 font-semibold text-slate-900">{formatDate(billing?.currentPeriodEnd || null)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subscription plan</CardTitle>
        </CardHeader>
        <CardContent className="grid max-w-md gap-3">
          {PLANS.map(plan => {
            const current = billing?.plan === plan.id;
            return (
              <div key={plan.id} className={`rounded-2xl border-2 p-4 ${current ? 'border-[#F5C10E] bg-[#FEFCE8]' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-slate-950">{plan.name}</p>
                  {current && <Badge className="bg-[#F5C10E] text-[#0F172A]"><Check className="mr-1 h-3 w-3" />Current</Badge>}
                </div>
                <p className="mt-3 text-2xl font-extrabold text-slate-950">{plan.price}</p>
                <p className="mt-1 text-sm text-slate-500">{plan.detail}</p>
                <div className="mt-4 rounded-xl bg-slate-50 p-3">
                  <Label htmlFor="subscription-location-count">Total locations</Label>
                  <Input
                    id="subscription-location-count"
                    className="mt-2"
                    type="number"
                    min={Math.max(1, locations.length)}
                    max={100}
                    value={locationCount}
                    onChange={event => setLocationCount(Math.max(Math.max(1, locations.length), Math.min(100, Number(event.target.value) || 1)))}
                    disabled={current}
                  />
                  <p className="mt-2 text-xs text-slate-500">Each location after the first adds CAD $100/month.</p>
                  <p className="mt-2 text-lg font-extrabold text-slate-950">
                    CAD ${(249.99 + Math.max(0, locationCount - 1) * 100).toFixed(2)}/month
                  </p>
                </div>
                <Button
                  type="button"
                  className="mt-4 w-full bg-[#0F172A] text-white hover:bg-[#1E293B]"
                  disabled={isLoading || current || !billing?.configured || (locationCount > 1 && !billing?.additionalLocationPriceConfigured)}
                  onClick={() => void openCheckout(plan.id)}
                >
                  {current ? 'Manage subscription in Stripe' : `Subscribe for CAD $${(249.99 + Math.max(0, locationCount - 1) * 100).toFixed(2)}/month`}
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Payment information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(billing?.paymentMethods || []).length > 0 ? billing?.paymentMethods.map(method => (
            <div key={method.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
              <div>
                <p className="font-semibold capitalize text-slate-950">{method.brand} •••• {method.last4}</p>
                <p className="mt-1 text-sm text-slate-500">{method.holderName || billing?.customerEmail || 'Company payment method'}</p>
              </div>
              <p className="text-sm text-slate-600">
                Expires {method.expMonth?.toString().padStart(2, '0')}/{method.expYear}
              </p>
            </div>
          )) : (
            <p className="py-5 text-center text-sm text-slate-500">No Stripe payment method is attached yet.</p>
          )}
          <p className="text-xs text-slate-500">Only card brand, last four digits, and expiry are displayed. zestIQ never stores full card numbers or security codes.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> Payment history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(billing?.payments || []).length > 0 ? billing?.payments.map(payment => (
            <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
              <div>
                <p className="font-semibold text-slate-950">{payment.number || 'Stripe invoice'}</p>
                <p className="mt-1 text-sm text-slate-500">{formatDate(payment.date)} · <span className="capitalize">{payment.status}</span></p>
              </div>
              <div className="flex items-center gap-3">
                <p className="font-bold text-slate-950">{payment.currency} {payment.amount.toFixed(2)}</p>
                {(payment.invoicePdf || payment.hostedInvoiceUrl) && (
                  <a
                    href={payment.invoicePdf || payment.hostedInvoiceUrl || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="mr-2 h-4 w-4" /> Invoice
                  </a>
                )}
              </div>
            </div>
          )) : (
            <p className="py-5 text-center text-sm text-slate-500">Payment history will appear here after the first Stripe invoice.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
