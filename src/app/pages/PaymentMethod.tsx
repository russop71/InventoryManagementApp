import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { CreditCard, Plus, Trash2, Check, Crown } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

interface PaymentCard {
  id: string;
  type: 'visa' | 'mastercard' | 'amex';
  last4: string;
  expiry: string;
  isDefault: boolean;
  holderName: string;
}

type BillingPeriod = 'monthly' | 'bi-weekly' | 'yearly';

interface PlanOption {
  period: BillingPeriod;
  price: number;
  displayName: string;
  savingsPercent?: number;
}

export function PaymentMethod() {
  const { accountId } = useAuth();
  const [cards, setCards] = useState<PaymentCard[]>([]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<BillingPeriod>('monthly');
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);

  const trialStorageKey = useMemo(() => {
    return accountId ? `zestiq:account:${accountId}:trial-ends-at` : 'zestiq:trial-ends-at';
  }, [accountId]);

  useEffect(() => {
    const stored = localStorage.getItem(trialStorageKey);
    setTrialEndsAt(stored);
  }, [trialStorageKey]);

  const planOptions: PlanOption[] = [
    {
      period: 'bi-weekly',
      price: 49.99,
      displayName: 'Bi-Weekly',
    },
    {
      period: 'monthly',
      price: 99.00,
      displayName: 'Monthly',
    },
    {
      period: 'yearly',
      price: 999.00,
      displayName: 'Yearly',
      savingsPercent: 16,
    },
  ];

  const currentPlanOption = planOptions.find(p => p.period === currentPlan);

  const handleAddCard = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newCard: PaymentCard = {
      id: Date.now().toString(),
      type: 'visa',
      last4: (formData.get('cardNumber') as string).slice(-4),
      expiry: formData.get('expiry') as string,
      isDefault: cards.length === 0,
      holderName: formData.get('holderName') as string
    };

    setCards([...cards, newCard]);
    setIsDialogOpen(false);
    toast.success('Payment method added successfully');
    e.currentTarget.reset();
  };

  const handleSetDefault = (cardId: string) => {
    setCards(cards.map(card => ({
      ...card,
      isDefault: card.id === cardId
    })));
    toast.success('Default payment method updated');
  };

  const handleDeleteCard = (cardId: string) => {
    if (confirm('Remove this payment method?')) {
      setCards(cards.filter(card => card.id !== cardId));
      toast.success('Payment method removed');
    }
  };

  const getCardIcon = (type: string) => {
    const baseClass = "w-10 h-7 rounded flex items-center justify-center text-white text-xs font-bold";
    switch (type) {
      case 'visa':
        return <div className={`${baseClass} bg-[#F5C10E]`}>VISA</div>;
      case 'mastercard':
        return <div className={`${baseClass} bg-red-600`}>MC</div>;
      case 'amex':
        return <div className={`${baseClass} bg-[#0F172A]`}>AMEX</div>;
      default:
        return <CreditCard className="w-10 h-7" />;
    }
  };

  const handleChangePlan = (period: BillingPeriod) => {
    setCurrentPlan(period);
    setIsPlanDialogOpen(false);
    toast.success(`Plan changed to ${period} billing`);
  };

  const handleStartFreeTrial = () => {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 14);
    const endIso = end.toISOString();
    localStorage.setItem(trialStorageKey, endIso);
    setTrialEndsAt(endIso);
    toast.success('Your 14-day free trial is now active');
  };

  const isTrialActive = Boolean(trialEndsAt) && new Date(trialEndsAt as string).getTime() > Date.now();

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Payment Methods</h2>
          <p className="text-sm text-gray-600 mt-1">Manage your payment cards & billing</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-[#0F172A] hover:bg-[#1E293B] text-white">
              <Plus className="w-4 h-4 mr-1" />
              Add Card
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[calc(100vw-2rem)]">
            <DialogHeader>
              <DialogTitle>Add Payment Method</DialogTitle>
              <DialogDescription>
                Enter your card details below
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddCard} className="space-y-4">
              <div>
                <Label htmlFor="holderName">Cardholder Name</Label>
                <Input
                  id="holderName"
                  name="holderName"
                  required
                  placeholder="John Smith"
                />
              </div>

              <div>
                <Label htmlFor="cardNumber">Card Number</Label>
                <Input
                  id="cardNumber"
                  name="cardNumber"
                  required
                  placeholder="1234 5678 9012 3456"
                  maxLength={19}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="expiry">Expiry Date</Label>
                  <Input
                    id="expiry"
                    name="expiry"
                    required
                    placeholder="MM/YY"
                    maxLength={5}
                  />
                </div>
                <div>
                  <Label htmlFor="cvv">CVV</Label>
                  <Input
                    id="cvv"
                    name="cvv"
                    required
                    placeholder="123"
                    maxLength={4}
                    type="password"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-[#0F172A] hover:bg-[#1E293B] text-white">
                  Add Card
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-[#F5C10E]/40 bg-gradient-to-br from-[#FEFCE8] to-[#FEF9C3]">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span>Free Trial</span>
            {isTrialActive && (
              <Badge className="bg-green-100 text-green-800 border-green-300">
                Active
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-700">
            Start with a 14-day free trial to explore AI ordering, forecasting, and inventory workflows before choosing a paid plan.
          </p>
          {isTrialActive && trialEndsAt ? (
            <p className="text-sm font-semibold text-[#0F172A]">
              Trial ends on {new Date(trialEndsAt).toLocaleDateString()}.
            </p>
          ) : (
            <Button onClick={handleStartFreeTrial} className="bg-[#0F172A] hover:bg-[#1E293B] text-white">
              Start Free Trial
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">Professional Plan</h3>
              <p className="text-sm text-gray-600">
                ${currentPlanOption?.price.toFixed(2)}/{currentPlan === 'bi-weekly' ? 'bi-weekly' : currentPlan} • Billed {currentPlan}
              </p>
            </div>
            <Badge className="bg-green-100 text-green-800">Active</Badge>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">Next billing date: April 1, 2026</p>
            <Dialog open={isPlanDialogOpen} onOpenChange={setIsPlanDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                >
                  Change Plan
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[calc(100vw-2rem)]">
                <DialogHeader>
                  <DialogTitle>Choose Your Plan</DialogTitle>
                  <DialogDescription>
                    Select the billing period that works best for you
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 pt-2 max-h-[60vh] overflow-y-auto">
                  {planOptions.map((plan) => {
                    const isCurrentPlan = plan.period === currentPlan;
                    const monthlyEquivalent = plan.period === 'yearly' 
                      ? plan.price / 12 
                      : plan.period === 'bi-weekly'
                      ? (plan.price * 26) / 12
                      : plan.price;

                    return (
                      <button
                        key={plan.period}
                        onClick={() => handleChangePlan(plan.period)}
                        className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                          isCurrentPlan
                            ? 'border-[#F5C10E] bg-[#FEFCE8]'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-base text-gray-900">
                              {plan.displayName}
                            </h3>
                            {plan.savingsPercent && (
                              <Badge className="bg-green-100 text-green-800 border-green-300 text-xs">
                                <Crown className="w-3 h-3 mr-1" />
                                Save {plan.savingsPercent}%
                              </Badge>
                            )}
                            {isCurrentPlan && (
                              <Badge className="bg-[#FEF9C3] text-[#1E3A5F] border-[#F5C10E]/50 text-xs">
                                <Check className="w-3 h-3 mr-1" />
                                Current
                              </Badge>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-gray-900">
                              ${plan.price.toFixed(2)}
                            </p>
                          </div>
                        </div>
                        <div className="text-xs text-gray-600">
                          {plan.period === 'yearly' && `Just $${monthlyEquivalent.toFixed(2)}/month`}
                          {plan.period === 'bi-weekly' && `≈ $${monthlyEquivalent.toFixed(2)}/month`}
                          {plan.period === 'monthly' && 'Standard monthly billing'}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500 text-center">
                    All plans include AI ordering, forecasting & Toast POS integration
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Saved Cards */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900">Saved Cards</h3>
        {cards.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CreditCard className="w-12 h-12 text-gray-400 mb-4" />
              <p className="text-gray-500 text-center text-sm">
                No payment methods added yet
              </p>
            </CardContent>
          </Card>
        ) : (
          cards.map(card => (
            <Card key={card.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    {getCardIcon(card.type)}
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">•••• {card.last4}</span>
                        {card.isDefault && (
                          <Badge className="bg-[#FEF9C3] text-[#1E3A5F] text-xs">
                            <Check className="w-3 h-3 mr-1" />
                            Default
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{card.holderName}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">Exp {card.expiry}</p>
                </div>

                <div className="flex space-x-2 pt-3 border-t border-gray-100">
                  {!card.isDefault && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSetDefault(card.id)}
                      className="flex-1"
                    >
                      Set as Default
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteCard(card.id)}
                    className={card.isDefault ? 'flex-1' : ''}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Billing History */}
      <Card>
        <CardHeader>
          <CardTitle>Billing History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { date: 'Mar 1, 2026', amount: '$99.00', status: 'Paid' },
            { date: 'Feb 1, 2026', amount: '$99.00', status: 'Paid' },
            { date: 'Jan 1, 2026', amount: '$99.00', status: 'Paid' }
          ].map((invoice, index) => (
            <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <div>
                <p className="font-medium text-sm">{invoice.date}</p>
                <p className="text-xs text-gray-600">{invoice.status}</p>
              </div>
              <div className="flex items-center space-x-3">
                <span className="font-semibold">{invoice.amount}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => toast.info('Invoice download coming soon')}
                >
                  Download
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}