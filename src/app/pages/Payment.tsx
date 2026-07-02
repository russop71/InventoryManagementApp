import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { CreditCard, Smartphone, Lock, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

type PaymentMethod = 'card' | 'apple-pay' | 'google-pay' | 'paypal' | null;

export function Payment() {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(null);
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [nameOnCard, setNameOnCard] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const subscriptionPrice = 49.99;
  const billingPeriod = 'monthly';

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\s/g, '');
    const chunks = cleaned.match(/.{1,4}/g);
    return chunks ? chunks.join(' ') : cleaned;
  };

  const formatExpiryDate = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4);
    }
    return cleaned;
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\s/g, '');
    if (value.length <= 16 && /^\d*$/.test(value)) {
      setCardNumber(value);
    }
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= 4) {
      setExpiryDate(value);
    }
  };

  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= 4 && /^\d*$/.test(value)) {
      setCvv(value);
    }
  };

  const detectCardType = (number: string) => {
    const firstDigit = number.charAt(0);
    if (firstDigit === '4') return 'visa';
    if (firstDigit === '5') return 'mastercard';
    if (firstDigit === '3') return 'amex';
    if (firstDigit === '6') return 'discover';
    return 'card';
  };

  const handlePayment = async () => {
    if (!selectedMethod) {
      toast.error('Please select a payment method');
      return;
    }

    if (selectedMethod === 'card') {
      if (!cardNumber || !expiryDate || !cvv || !nameOnCard) {
        toast.error('Please fill in all card details');
        return;
      }
      if (cardNumber.length < 13) {
        toast.error('Invalid card number');
        return;
      }
      if (expiryDate.length < 4) {
        toast.error('Invalid expiry date');
        return;
      }
      if (cvv.length < 3) {
        toast.error('Invalid CVV');
        return;
      }
    }

    setIsProcessing(true);

    // Simulate payment processing
    setTimeout(() => {
      setIsProcessing(false);
      toast.success('Payment successful! Your subscription is now active.');
      // In a real app, you would redirect to the dashboard or update the subscription status
    }, 2000);
  };

  const paymentMethods = [
    {
      id: 'apple-pay' as PaymentMethod,
      name: 'Apple Pay',
      icon: '🍎',
      description: 'Pay with Apple Pay',
      available: true,
    },
    {
      id: 'google-pay' as PaymentMethod,
      name: 'Google Pay',
      icon: 'G',
      description: 'Pay with Google Pay',
      available: true,
    },
    {
      id: 'card' as PaymentMethod,
      name: 'Credit/Debit Card',
      icon: '💳',
      description: 'Visa, Mastercard, Amex, Discover',
      available: true,
    },
    {
      id: 'paypal' as PaymentMethod,
      name: 'PayPal',
      icon: 'P',
      description: 'Pay with PayPal',
      available: true,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 pb-24">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="text-center pt-6 pb-4">
          <div className="inline-block bg-gradient-to-br from-red-600 to-red-800 text-white text-3xl font-black px-6 py-3 rounded-lg mb-4 shadow-lg">
            86
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Complete Your Subscription
          </h1>
          <p className="text-sm text-gray-600">
            Get full access to 86'D inventory management
          </p>
        </div>

        {/* Subscription Details */}
        <Card className="border-2 border-[#F5C10E]">
          <CardHeader className="bg-gradient-to-r from-[#0F172A] to-[#1E293B] text-white">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Pro Subscription</span>
              <Badge className="bg-green-500 text-white border-0">
                Save 20%
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Billing Period</span>
                <span className="font-semibold text-gray-900 capitalize">{billingPeriod}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Amount</span>
                <span className="text-2xl font-bold text-[#0F172A]">
                  ${subscriptionPrice.toFixed(2)}
                </span>
              </div>
              <div className="pt-3 border-t border-gray-200">
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center">
                    <Check className="w-4 h-4 mr-2 text-green-600" />
                    AI-powered order suggestions
                  </div>
                  <div className="flex items-center">
                    <Check className="w-4 h-4 mr-2 text-green-600" />
                    Sales forecasting & analytics
                  </div>
                  <div className="flex items-center">
                    <Check className="w-4 h-4 mr-2 text-green-600" />
                    Toast POS integration
                  </div>
                  <div className="flex items-center">
                    <Check className="w-4 h-4 mr-2 text-green-600" />
                    Unlimited inventory items
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Method Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select Payment Method</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {paymentMethods.map((method) => (
              <button
                key={method.id}
                onClick={() => setSelectedMethod(method.id)}
                disabled={!method.available}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                  selectedMethod === method.id
                    ? 'border-[#F5C10E] bg-[#FEFCE8]'
                    : 'border-gray-200 hover:border-gray-300'
                } ${!method.available ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">{method.icon}</div>
                    <div>
                      <p className="font-semibold text-gray-900">{method.name}</p>
                      <p className="text-xs text-gray-600">{method.description}</p>
                    </div>
                  </div>
                  {selectedMethod === method.id && (
                    <div className="w-6 h-6 rounded-full bg-[#0F172A] flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Card Details Form */}
        {selectedMethod === 'card' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <CreditCard className="w-5 h-5 mr-2 text-[#0F172A]" />
                Card Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Card Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Card Number
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formatCardNumber(cardNumber)}
                    onChange={handleCardNumberChange}
                    placeholder="1234 5678 9012 3456"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-transparent"
                  />
                  {cardNumber && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <CreditCard className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                </div>
              </div>

              {/* Name on Card */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name on Card
                </label>
                <input
                  type="text"
                  value={nameOnCard}
                  onChange={(e) => setNameOnCard(e.target.value)}
                  placeholder="John Doe"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-transparent"
                />
              </div>

              {/* Expiry Date and CVV */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="text"
                    value={formatExpiryDate(expiryDate)}
                    onChange={handleExpiryChange}
                    placeholder="MM/YY"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CVV
                  </label>
                  <input
                    type="text"
                    value={cvv}
                    onChange={handleCvvChange}
                    placeholder="123"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Accepted Cards */}
              <div className="flex items-center justify-center space-x-4 pt-2">
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/0/04/Visa.svg"
                  alt="Visa"
                  className="h-8 opacity-60"
                />
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg"
                  alt="Mastercard"
                  className="h-8 opacity-60"
                />
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/3/30/American_Express_logo.svg"
                  alt="American Express"
                  className="h-8 opacity-60"
                />
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/5/57/Discover_Card_logo.svg"
                  alt="Discover"
                  className="h-8 opacity-60"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Digital Wallet Instructions */}
        {(selectedMethod === 'apple-pay' || selectedMethod === 'google-pay') && (
          <Card className="bg-gradient-to-br from-[#FEFCE8] to-[#FEF9C3] border-[#F5C10E]/30">
            <CardContent className="pt-6">
              <div className="text-center space-y-3">
                <Smartphone className="w-12 h-12 mx-auto text-[#0F172A]" />
                <div>
                  <p className="font-semibold text-gray-900">
                    {selectedMethod === 'apple-pay' ? 'Apple Pay' : 'Google Pay'} Selected
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Click "Complete Payment" to proceed with{' '}
                    {selectedMethod === 'apple-pay' ? 'Apple Pay' : 'Google Pay'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* PayPal Instructions */}
        {selectedMethod === 'paypal' && (
          <Card className="bg-gradient-to-br from-[#FEFCE8] to-[#FEF9C3] border-[#F5C10E]/30">
            <CardContent className="pt-6">
              <div className="text-center space-y-3">
                <div className="text-5xl">P</div>
                <div>
                  <p className="font-semibold text-gray-900">PayPal Selected</p>
                  <p className="text-sm text-gray-600 mt-1">
                    You'll be redirected to PayPal to complete your payment
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Security Badge */}
        <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
          <Lock className="w-4 h-4" />
          <span>Secure payment processing with 256-bit encryption</span>
        </div>

        {/* Payment Button */}
        <Button
          onClick={handlePayment}
          disabled={!selectedMethod || isProcessing}
          className="w-full bg-[#0F172A] hover:bg-[#1E293B] text-white py-6 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <span className="flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Processing...
            </span>
          ) : (
            <span className="flex items-center justify-center">
              <Lock className="w-5 h-5 mr-2" />
              Complete Payment - ${subscriptionPrice.toFixed(2)}
            </span>
          )}
        </Button>

        {/* Terms */}
        <p className="text-xs text-center text-gray-500 px-4">
          By completing this purchase, you agree to our Terms of Service and Privacy Policy.
          Your subscription will automatically renew {billingPeriod}. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
