import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useInventory } from '../contexts/InventoryContext';
import { useToast } from '../contexts/ToastContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { ArrowLeft, Plus, Minus, AlertTriangle, TrendingDown, Package, TrendingUp, DollarSign, Calendar } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast as showToast } from 'sonner';

export function InventoryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { inventory, recipes, adjustInventory } = useInventory();
  const { salesData } = useToast();
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'stock' | 'price'>('stock');

  const item = inventory.find(i => i.id === id);

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Package className="w-16 h-16 text-gray-400 mb-4" />
        <p className="text-gray-500">Item not found</p>
        <Button onClick={() => navigate('/inventory')} className="mt-4">
          Back to Inventory
        </Button>
      </div>
    );
  }

  // Calculate usage from recipes (mock data for today)
  const usageByDish = recipes
    .map(recipe => {
      const ingredient = recipe.ingredients.find(ing => ing.inventoryItemId === id);
      if (!ingredient) return null;

      // Mock: assume 28 chicken sandwiches sold today
      const mockSalesCount = recipe.menuItemName.includes('Chicken') ? 28 : 
                            recipe.menuItemName.includes('Beef') ? 15 : 0;
      
      const totalUsed = ingredient.quantity * mockSalesCount;

      return {
        dishName: recipe.menuItemName,
        soldCount: mockSalesCount,
        usedAmount: totalUsed,
        unit: item.unit,
      };
    })
    .filter(usage => usage && usage.soldCount > 0);

  // Calculate 7-day trend (mock data)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const baseUsage = 15;
    const variance = Math.random() * 10 - 5;
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      usage: Math.max(0, baseUsage + variance),
    };
  });

  // Calculate variance
  const expectedUsage = 20;
  const actualUsage = usageByDish.reduce((sum, usage) => sum + (usage?.usedAmount || 0), 0);
  const variance = actualUsage - expectedUsage;

  const stockPercentage = (item.currentStock / item.parLevel) * 100;
  const isLowStock = stockPercentage < 30;

  const handleAdjustInventory = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const change = Number(formData.get('change'));
    const reason = formData.get('reason') as string;
    const type = formData.get('type') as string;

    const finalChange = type === 'remove' ? -change : change;

    adjustInventory(item.id, finalChange, reason);
    setIsAdjustDialogOpen(false);
    showToast.success(`${item.name} inventory adjusted`);
    e.currentTarget.reset();
  };

  // Combine stock and price history into unified timeline
  const stockHistory = (item.history || []).map(h => ({
    date: h.date,
    type: 'stock' as const,
    change: h.change,
    reason: h.reason,
    newStock: h.newStock,
  }));

  const priceHistory = (item.priceHistory || []).map(p => ({
    date: p.date,
    type: 'price' as const,
    oldPrice: p.oldPrice,
    newPrice: p.newPrice,
    reason: p.reason,
  }));

  const combinedHistory = [...stockHistory, ...priceHistory]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20);

  // Calculate price trend if we have history
  const priceChange = item.priceHistory && item.priceHistory.length > 0
    ? ((item.unitCost - item.priceHistory[0].oldPrice) / item.priceHistory[0].oldPrice) * 100
    : 0;

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/inventory')}
          className="mb-3"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>

        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">{item.name}</h2>
            <p className="text-sm text-gray-600 mt-1">{item.category} • {item.supplier}</p>
          </div>
          <Badge className={isLowStock ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}>
            {isLowStock ? '🟡 Low' : '🟢 OK'}
          </Badge>
        </div>
      </div>

      {/* Current Stock Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current Stock</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-4xl font-bold text-gray-900">{item.currentStock}</p>
              <p className="text-sm text-gray-500 mt-1">{item.unit}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Par Level</p>
              <p className="text-2xl font-semibold text-gray-700">{item.parLevel}</p>
            </div>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                isLowStock ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(stockPercentage, 100)}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-gray-50 rounded p-2">
              <p className="text-xs text-gray-500">Value</p>
              <p className="text-lg font-semibold text-gray-900">
                ${(item.currentStock * item.unitCost).toFixed(2)}
              </p>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <p className="text-xs text-gray-500">Unit Cost</p>
              <div className="flex items-center space-x-1">
                <p className="text-lg font-semibold text-gray-900">
                  ${item.unitCost.toFixed(2)}
                </p>
                {priceChange !== 0 && (
                  <span className={`text-xs ${priceChange > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ({priceChange > 0 ? '+' : ''}{priceChange.toFixed(1)}%)
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Breakdown Today */}
      {usageByDish.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center">
              <TrendingDown className="w-4 h-4 mr-2 text-[#2563EB]" />
              Usage Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {usageByDish.map((usage, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-sm text-gray-900">{usage?.dishName}</p>
                    <p className="text-sm font-semibold text-red-600">
                      -{usage?.usedAmount.toFixed(1)} {usage?.unit}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500">
                    {usage?.soldCount} dishes sold
                  </p>
                </div>
              ))}
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">Total Used</p>
                  <p className="text-base font-bold text-red-600">
                    -{actualUsage.toFixed(1)} {item.unit}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 7-Day Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center">
            <TrendingUp className="w-4 h-4 mr-2 text-[#2563EB]" />
            Usage Trend (7 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={last7Days}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="usage" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name={`Usage (${item.unit})`}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Variance Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center">
            <AlertTriangle className="w-4 h-4 mr-2 text-orange-500" />
            Variance Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#FEFCE8] rounded p-2">
                <p className="text-xs text-gray-600">Expected</p>
                <p className="text-lg font-semibold text-gray-900">
                  {expectedUsage} {item.unit}
                </p>
              </div>
              <div className="bg-gray-50 rounded p-2">
                <p className="text-xs text-gray-600">Actual</p>
                <p className="text-lg font-semibold text-gray-900">
                  {actualUsage.toFixed(1)} {item.unit}
                </p>
              </div>
              <div className={`rounded p-2 ${variance < 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <p className="text-xs text-gray-600">Variance</p>
                <p className={`text-lg font-semibold ${variance < 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {variance > 0 ? '+' : ''}{variance.toFixed(1)} {item.unit}
                </p>
              </div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
              <p className="text-xs font-medium text-yellow-900 mb-1">Why are we off?</p>
              <p className="text-xs text-yellow-800">
                {variance > 0 
                  ? 'Higher than expected usage - check for waste or portion control'
                  : 'Lower than expected - sales may be down or portions are smaller'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Adjust Inventory Button */}
      <Dialog open={isAdjustDialogOpen} onOpenChange={setIsAdjustDialogOpen}>
        <DialogTrigger asChild>
          <Button className="w-full bg-[#0F172A] hover:bg-[#1E293B] text-white" size="lg">
            🔄 Adjust Inventory
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle>Adjust {item.name}</DialogTitle>
            <DialogDescription>Add or remove stock and record the reason for the adjustment</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdjustInventory} className="space-y-4">
            <div>
              <Label>Action Type</Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <label className="relative flex items-center justify-center p-3 border-2 border-gray-300 rounded-lg cursor-pointer has-[:checked]:border-green-500 has-[:checked]:bg-green-50">
                  <input type="radio" name="type" value="add" className="sr-only" required />
                  <div className="text-center">
                    <Plus className="w-6 h-6 mx-auto mb-1 text-green-600" />
                    <p className="text-sm font-medium">Add Stock</p>
                  </div>
                </label>
                <label className="relative flex items-center justify-center p-3 border-2 border-gray-300 rounded-lg cursor-pointer has-[:checked]:border-red-500 has-[:checked]:bg-red-50">
                  <input type="radio" name="type" value="remove" className="sr-only" required />
                  <div className="text-center">
                    <Minus className="w-6 h-6 mx-auto mb-1 text-red-600" />
                    <p className="text-sm font-medium">Remove Stock</p>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <Label htmlFor="change">Amount ({item.unit})</Label>
              <Input
                id="change"
                name="change"
                type="number"
                step="0.01"
                required
                placeholder={`Enter amount in ${item.unit}`}
              />
            </div>

            <div>
              <Label htmlFor="reason">Reason</Label>
              <select
                id="reason"
                name="reason"
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
              >
                <option value="">Select reason...</option>
                <option value="Delivery received">Delivery received</option>
                <option value="Waste/spoilage">Waste/spoilage</option>
                <option value="Transfer">Transfer</option>
                <option value="Count adjustment">Count adjustment</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsAdjustDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-[#0F172A] hover:bg-[#1E293B] text-white">
                Adjust Inventory
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* History - Combined Stock & Price Changes */}
      {combinedHistory.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center">
                <Calendar className="w-4 h-4 mr-2 text-[#2563EB]" />
                Change History
              </CardTitle>
            </div>
            {/* Tabs for filtering */}
            <div className="flex space-x-2 mt-3">
              <button
                onClick={() => setActiveTab('stock')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === 'stock'
                    ? 'bg-[#FEF9C3] text-[#0F172A]'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Stock Changes ({stockHistory.length})
              </button>
              <button
                onClick={() => setActiveTab('price')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === 'price'
                    ? 'bg-green-100 text-green-900'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Price Changes ({priceHistory.length})
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {combinedHistory
                .filter(record => activeTab === 'stock' ? record.type === 'stock' : record.type === 'price')
                .map((record, index) => (
                  <div key={index} className="flex items-start justify-between py-3 border-b last:border-0">
                    {record.type === 'stock' ? (
                      <>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <Package className="w-4 h-4 text-[#2563EB]" />
                            <p className="text-sm font-medium text-gray-900">{record.reason}</p>
                          </div>
                          <p className="text-xs text-gray-500 ml-6 mt-1">
                            {new Date(record.date).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              year: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <p className={`text-sm font-semibold ${record.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {record.change > 0 ? '+' : ''}{record.change} {item.unit}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            New: {record.newStock} {item.unit}
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <DollarSign className="w-4 h-4 text-green-600" />
                            <p className="text-sm font-medium text-gray-900">
                              {record.reason || 'Price updated'}
                            </p>
                          </div>
                          <p className="text-xs text-gray-500 ml-6 mt-1">
                            {new Date(record.date).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              year: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <div className="flex items-center space-x-1 justify-end">
                            <p className="text-xs text-gray-500 line-through">
                              ${record.oldPrice.toFixed(2)}
                            </p>
                            <span className="text-xs text-gray-400">→</span>
                            <p className="text-sm font-semibold text-gray-900">
                              ${record.newPrice.toFixed(2)}
                            </p>
                          </div>
                          <p className={`text-xs mt-0.5 ${
                            record.newPrice > record.oldPrice ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {record.newPrice > record.oldPrice ? '+' : ''}
                            {((record.newPrice - record.oldPrice) / record.oldPrice * 100).toFixed(1)}%
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              
              {((activeTab === 'stock' && stockHistory.length === 0) || 
                (activeTab === 'price' && priceHistory.length === 0)) && (
                <div className="text-center py-8 text-gray-500 text-sm">
                  No {activeTab} changes recorded yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
