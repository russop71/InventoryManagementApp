import { useInventory } from '../contexts/InventoryContext';
import { useToast } from '../contexts/ToastContext';
import { Link, useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { AlertTriangle, ShoppingCart, TrendingUp, ChefHat, Sparkles, Camera, TrendingDown, Activity, ChevronDown, ChevronRight, Flame, Wine, Beer, GlassWater, Coffee, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useState } from 'react';

export function Dashboard() {
  const navigate = useNavigate();
  const { inventory, orders, recipes } = useInventory();
  const { isConnected, salesData, salesCategories, menuItems } = useToast();
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [breakdownDialogOpen, setBreakdownDialogOpen] = useState(false);
  const [breakdownType, setBreakdownType] = useState<'items' | 'cost' | 'lowStock' | 'orders'>('items');

  const lowStockItems = inventory.filter(
    item => item.currentStock < item.parLevel * 0.3
  );

  const totalInventoryValue = inventory.reduce(
    (sum, item) => sum + (item.currentStock * item.unitCost),
    0
  );

  // Calculate Toast data stats
  const totalRevenue = salesData.reduce((sum, day) => sum + day.revenue, 0);
  const totalCovers = salesData.reduce((sum, day) => sum + day.covers, 0);
  const averageCheck = totalCovers > 0 ? totalRevenue / totalCovers : 0;

  // Calculate food cost percentage (COGS / Revenue)
  const totalFoodCost = totalInventoryValue;
  const foodCostPercentage = totalRevenue > 0 ? (totalFoodCost / totalRevenue) * 100 : 0;
  const totalInventoryCount = inventory.length;

  const pendingOrdersCount = orders.filter(order => order.status === 'pending').length;
  const pendingOrdersValue = orders
    .filter(order => order.status === 'pending')
    .reduce((sum, order) => sum + order.totalCost, 0);

  // Calculate COGS from menu item ingredient costs × units sold
  const cogsUnitsSold: Record<string, number> = {};
  salesData.forEach(day => day.topItems.forEach(item => {
    cogsUnitsSold[item.itemName] = (cogsUnitsSold[item.itemName] || 0) + item.quantity;
  }));
  const totalCOGS = menuItems.reduce((sum, mi) => {
    const costPerItem = mi.ingredients.reduce((s, ing) => {
      const inv = inventory.find(i => i.id === ing.inventoryItemId);
      return s + (inv ? ing.quantity * inv.unitCost : 0);
    }, 0);
    return sum + costPerItem * (cogsUnitsSold[mi.name] ?? 0);
  }, 0);
  const cogsPercent = totalRevenue > 0 ? (totalCOGS / totalRevenue) * 100 : 0;

  // Aggregate top-selling items across all POS days
  const topSellingItems = Object.values(
    salesData.flatMap(day => day.topItems).reduce((acc, item) => {
      if (!acc[item.itemName]) {
        acc[item.itemName] = { itemName: item.itemName, quantity: 0, revenue: 0 };
      }
      acc[item.itemName].quantity += item.quantity;
      acc[item.itemName].revenue  += item.revenue;
      return acc;
    }, {} as Record<string, { itemName: string; quantity: number; revenue: number }>)
  ).sort((a, b) => b.quantity - a.quantity).slice(0, 5);

  // Stock level by category
  const categoryData = inventory.reduce((acc, item) => {
    const existing = acc.find(c => c.category === item.category);
    if (existing) {
      existing.value += item.currentStock * item.unitCost;
      existing.items += 1;
    } else {
      acc.push({
        id: `cat-${item.category}-${acc.length}`,
        category: item.category,
        value: item.currentStock * item.unitCost,
        items: 1
      });
    }
    return acc;
  }, [] as { id: string; category: string; value: number; items: number }[]);

  // Format sales data for chart
  const salesChartData = [...salesData].reverse().map((day, index) => ({
    id: `${day.date}-${index}`,
    date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    revenue: day.revenue,
    covers: day.covers,
  }));

  // Usage Summary - Hypothetical vs Actual
  const usageSummary = [
    { 
      id: 'proteins',
      category: 'Proteins', 
      hypothetical: 850, 
      actual: 782,
      unit: 'lbs',
      items: [
        { name: 'Chicken Breast', hypothetical: 280, actual: 265, unit: 'lbs' },
        { name: 'Ground Beef', hypothetical: 220, actual: 198, unit: 'lbs' },
        { name: 'Salmon Fillets', hypothetical: 150, actual: 142, unit: 'lbs' },
        { name: 'Pork Tenderloin', hypothetical: 120, actual: 105, unit: 'lbs' },
        { name: 'Shrimp', hypothetical: 80, actual: 72, unit: 'lbs' }
      ]
    },
    { 
      id: 'produce',
      category: 'Produce', 
      hypothetical: 320, 
      actual: 298,
      unit: 'lbs',
      items: [
        { name: 'Romaine Lettuce', hypothetical: 85, actual: 78, unit: 'lbs' },
        { name: 'Tomatoes', hypothetical: 95, actual: 88, unit: 'lbs' },
        { name: 'Onions', hypothetical: 55, actual: 52, unit: 'lbs' },
        { name: 'Bell Peppers', hypothetical: 45, actual: 42, unit: 'lbs' },
        { name: 'Potatoes', hypothetical: 40, actual: 38, unit: 'lbs' }
      ]
    },
    { 
      id: 'dairy',
      category: 'Dairy', 
      hypothetical: 180, 
      actual: 195,
      unit: 'lbs',
      items: [
        { name: 'Whole Milk', hypothetical: 65, actual: 72, unit: 'lbs' },
        { name: 'Cheddar Cheese', hypothetical: 48, actual: 52, unit: 'lbs' },
        { name: 'Butter', hypothetical: 35, actual: 38, unit: 'lbs' },
        { name: 'Heavy Cream', hypothetical: 22, actual: 23, unit: 'lbs' },
        { name: 'Sour Cream', hypothetical: 10, actual: 10, unit: 'lbs' }
      ]
    },
    { 
      id: 'dry-goods',
      category: 'Dry Goods', 
      hypothetical: 240, 
      actual: 215,
      unit: 'lbs',
      items: [
        { name: 'All-Purpose Flour', hypothetical: 85, actual: 75, unit: 'lbs' },
        { name: 'Rice', hypothetical: 65, actual: 58, unit: 'lbs' },
        { name: 'Pasta', hypothetical: 50, actual: 45, unit: 'lbs' },
        { name: 'Sugar', hypothetical: 25, actual: 22, unit: 'lbs' },
        { name: 'Salt', hypothetical: 15, actual: 15, unit: 'lbs' }
      ]
    },
    { 
      id: 'beverages',
      category: 'Beverages', 
      hypothetical: 450, 
      actual: 468,
      unit: 'units',
      items: [
        { name: 'Coca-Cola', hypothetical: 180, actual: 188, unit: 'units' },
        { name: 'Iced Tea', hypothetical: 120, actual: 125, unit: 'units' },
        { name: 'Orange Juice', hypothetical: 85, actual: 90, unit: 'units' },
        { name: 'Coffee', hypothetical: 45, actual: 45, unit: 'units' },
        { name: 'Bottled Water', hypothetical: 20, actual: 20, unit: 'units' }
      ]
    }
  ];

  const totalHypothetical = usageSummary.reduce((sum, item) => sum + item.hypothetical, 0);
  const totalActual = usageSummary.reduce((sum, item) => sum + item.actual, 0);
  const variancePercent = ((totalActual - totalHypothetical) / totalHypothetical * 100);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategory(expandedCategory === categoryId ? null : categoryId);
  };

  const openBreakdown = (type: 'items' | 'cost' | 'lowStock' | 'orders') => {
    setBreakdownType(type);
    setBreakdownDialogOpen(true);
  };

  // Prepare breakdown data
  const categories = Array.from(new Set(inventory.map(item => item.category)));
  const itemsByCategory = categories.map(category => {
    const items = inventory.filter(item => item.category === category);
    const totalValue = items.reduce((sum, item) => sum + (item.currentStock * item.unitCost), 0);
    return {
      category,
      count: items.length,
      totalValue,
      items: items.sort((a, b) => (b.currentStock * b.unitCost) - (a.currentStock * a.unitCost))
    };
  }).sort((a, b) => b.totalValue - a.totalValue);

  const pendingOrders = orders.filter(order => order.status === 'pending');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Dashboard</h2>
          <p className="text-xs text-gray-400 mt-0.5 font-semibold uppercase tracking-wider">Real-time overview</p>
        </div>
      </div>

      {/* ── Compact 3-stat strip ─────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        {/* Food Cost % */}
        <Card
          className={`border-0 shadow-sm overflow-hidden transition-all duration-200 ${totalRevenue > 0 ? 'cursor-pointer hover:shadow-md' : ''} ${
            foodCostPercentage > 35 ? 'bg-red-950' : 'bg-[#0F172A]'
          }`}
          onClick={() => totalRevenue > 0 && openBreakdown('cost')}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Food Cost</span>
              <TrendingDown className="h-3 w-3 text-emerald-400" />
            </div>
            <div className={`text-2xl font-black tabular-nums leading-none ${
              totalRevenue > 0 ? (foodCostPercentage > 35 ? 'text-red-400' : 'text-emerald-400') : 'text-slate-600'
            }`} style={{ fontFamily: 'var(--font-mono)' }}>
              {totalRevenue > 0 ? `${foodCostPercentage.toFixed(1)}%` : '—'}
            </div>
            <p className="text-[9px] text-slate-500 mt-1.5 font-semibold leading-tight">
              {totalRevenue > 0 ? 'of revenue' : 'No POS data'}
            </p>
          </CardContent>
        </Card>

        {/* Low Stock */}
        <Card
          className={`border-0 shadow-sm overflow-hidden bg-white transition-all duration-200 ${lowStockItems.length > 0 ? 'cursor-pointer hover:shadow-md' : ''}`}
          onClick={() => lowStockItems.length > 0 && openBreakdown('lowStock')}
        >
          <div className={`h-[3px] ${lowStockItems.length > 0 ? 'bg-red-500' : 'bg-gray-100'}`} />
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Low Stock</span>
              <AlertTriangle className={`h-3 w-3 ${lowStockItems.length > 0 ? 'text-red-500' : 'text-gray-200'}`} />
            </div>
            <div className={`text-2xl font-black tabular-nums leading-none ${lowStockItems.length > 0 ? 'text-red-600' : 'text-gray-200'}`} style={{ fontFamily: 'var(--font-mono)' }}>
              {lowStockItems.length}
            </div>
            <p className="text-[9px] text-gray-400 mt-1.5 font-semibold leading-tight">Below par level</p>
          </CardContent>
        </Card>

        {/* Pending Orders */}
        <Card
          className={`border-0 shadow-sm overflow-hidden bg-white transition-all duration-200 ${pendingOrdersCount > 0 ? 'cursor-pointer hover:shadow-md' : ''}`}
          onClick={() => pendingOrdersCount > 0 && openBreakdown('orders')}
        >
          <div className={`h-[3px] ${pendingOrdersCount > 0 ? 'bg-[#F5C10E]' : 'bg-gray-100'}`} />
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Orders</span>
              <ShoppingCart className={`h-3 w-3 ${pendingOrdersCount > 0 ? 'text-[#F5C10E]' : 'text-gray-200'}`} />
            </div>
            <div className={`text-2xl font-black tabular-nums leading-none ${pendingOrdersCount > 0 ? 'text-[#0F172A]' : 'text-gray-200'}`} style={{ fontFamily: 'var(--font-mono)' }}>
              {pendingOrdersCount}
            </div>
            <p className="text-[9px] text-gray-400 mt-1.5 font-semibold leading-tight">
              ${pendingOrdersValue.toFixed(0)} pending
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── COGS card ────────────────────────────────── */}
      <button
        onClick={() => navigate('/cogs')}
        className="w-full text-left rounded-2xl p-4 shadow-md active:scale-[0.98] transition-all"
        style={{ background: '#0F172A' }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,193,14,0.15)' }}>
              <DollarSign className="w-4 h-4" style={{ color: '#F5C10E' }} />
            </div>
            <div>
              <p className="text-[13px] font-bold text-white leading-tight">Cost of Goods Sold</p>
              <p className="text-[10px] text-slate-500 font-medium">Tap to see full breakdown</p>
            </div>
          </div>
          <div className="text-right">
            <span
              className="text-[10px] font-black px-2 py-1 rounded-full"
              style={{
                background: cogsPercent > 35 ? 'rgba(220,38,38,0.2)' : 'rgba(22,163,74,0.2)',
                color: cogsPercent > 35 ? '#FCA5A5' : '#86EFAC',
              }}
            >
              {totalRevenue > 0 ? `${cogsPercent.toFixed(1)}% of rev` : 'No POS data'}
            </span>
          </div>
        </div>
        <div className="flex items-end justify-between">
          <p
            className="text-3xl font-black text-white tabular-nums"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {totalCOGS > 0
              ? `$${totalCOGS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : '—'}
          </p>
          <p className="text-[10px] text-slate-500 font-semibold pb-1">
            {salesData.length}d period · {menuItems.length} menu items
          </p>
        </div>
        {/* Mini progress bar */}
        {totalRevenue > 0 && (
          <div className="mt-3 w-full h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(cogsPercent, 100)}%`,
                background: cogsPercent > 35 ? '#EF4444' : '#F5C10E',
              }}
            />
          </div>
        )}
      </button>

      {/* ── Top Sellers from POS ─────────────────────── */}
      <Card className="border-0 shadow-sm bg-white overflow-hidden">
        <div className="h-[3px] bg-[#F5C10E]" />
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#F5C10E]/15 rounded-lg flex items-center justify-center">
                <Flame className="w-4 h-4 text-[#F5C10E]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#0F172A]">Top Sellers</p>
                <p className="text-[10px] text-gray-400 font-medium">From Toast POS</p>
              </div>
            </div>
            {salesData.length > 0 && (
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                {salesData.length}d data
              </span>
            )}
          </div>

          {topSellingItems.length === 0 ? (
            <div className="flex flex-col items-center py-6 gap-2 text-center">
              <TrendingUp className="w-8 h-8 text-gray-200" />
              <p className="text-sm font-semibold text-gray-400">No POS data yet</p>
              <p className="text-xs text-gray-400">Connect Toast POS to see your top sellers</p>
            </div>
          ) : (
            <div className="space-y-0">
              {topSellingItems.map((item, idx) => {
                const maxQty = topSellingItems[0].quantity;
                const pct = Math.round((item.quantity / maxQty) * 100);
                const rankColors = ['#F5C10E', '#F5C10E', '#9CA3AF', '#9CA3AF', '#9CA3AF'];
                return (
                  <div key={item.itemName} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                    {/* Rank */}
                    <span
                      className="text-[11px] font-black w-5 text-center shrink-0"
                      style={{ color: rankColors[idx] }}
                    >
                      {idx + 1}
                    </span>
                    {/* Name + bar */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-[#0F172A] truncate leading-tight">{item.itemName}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, background: idx < 2 ? '#F5C10E' : '#E5E7EB' }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-400 font-semibold shrink-0 tabular-nums">
                          {item.quantity} sold
                        </span>
                      </div>
                    </div>
                    {/* Revenue */}
                    <span className="text-[12px] font-black text-[#0F172A] shrink-0 tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
                      ${item.revenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Breakdown Dialog */}
      <Dialog open={breakdownDialogOpen} onOpenChange={setBreakdownDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {breakdownType === 'items' && 'Total Inventory Items'}
              {breakdownType === 'cost' && 'Food Cost Breakdown'}
              {breakdownType === 'lowStock' && 'Low Stock Items'}
              {breakdownType === 'orders' && 'Pending Orders'}
            </DialogTitle>
            <DialogDescription>
              {breakdownType === 'items' && 'All inventory items organized by category'}
              {breakdownType === 'cost' && 'How inventory contributes to food cost percentage'}
              {breakdownType === 'lowStock' && 'Items below 30% of par level'}
              {breakdownType === 'orders' && 'Orders awaiting fulfillment'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-3 pb-4">
            {breakdownType === 'items' && (
              <>
                {itemsByCategory.map(cat => (
                  <div key={cat.category} className="border rounded-lg overflow-hidden">
                    <div className="bg-[#FEFCE8] border-b border-[#F5C10E]/30 p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-[#0F172A]">{cat.category}</h3>
                          <p className="text-xs text-gray-500">{cat.count} items</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-[#0F172A]">
                            ${cat.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-gray-500">
                            {((cat.totalValue / totalInventoryValue) * 100).toFixed(1)}% of total
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="p-3 space-y-2">
                      {cat.items.map(item => (
                        <div key={item.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-100 last:border-0">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{item.name}</p>
                            <p className="text-xs text-gray-500">{item.currentStock} {item.unit} @ ${item.unitCost.toFixed(2)}/{item.unit}</p>
                          </div>
                          <p className="font-semibold text-gray-900">
                            ${(item.currentStock * item.unitCost).toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}

            {breakdownType === 'cost' && (
              <>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-green-900">Total Inventory Value</span>
                    <span className="text-lg font-bold text-green-900">
                      ${totalInventoryValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-green-900">Total Revenue (Toast POS)</span>
                    <span className="text-lg font-bold text-green-900">
                      ${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-green-300">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-semibold text-green-900">Food Cost %</span>
                      <span className="text-2xl font-bold text-green-900">{foodCostPercentage.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">By Category</p>
                  {itemsByCategory.map(cat => (
                    <div key={cat.category} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-900">{cat.category}</h3>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">
                            ${cat.totalValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </p>
                          <p className="text-xs text-gray-600">
                            {((cat.totalValue / totalRevenue) * 100).toFixed(1)}% of revenue
                          </p>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-green-500"
                          style={{ width: `${(cat.totalValue / totalInventoryValue) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {breakdownType === 'lowStock' && (
              <>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                  <p className="text-sm font-medium text-red-900">
                    {lowStockItems.length} items below 30% of par level
                  </p>
                </div>
                {lowStockItems.map(item => {
                  const stockPercentage = (item.currentStock / item.parLevel) * 100;
                  return (
                    <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{item.name}</h3>
                          <p className="text-xs text-gray-500 mt-1">{item.category} • {item.supplier}</p>
                        </div>
                        <Badge className="bg-red-100 text-red-800 border border-red-300">
                          {stockPercentage.toFixed(0)}%
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-gray-600 pt-2 border-t">
                        <div>
                          <span className="font-medium">Current:</span> {item.currentStock} {item.unit}
                        </div>
                        <div>
                          <span className="font-medium">Par:</span> {item.parLevel} {item.unit}
                        </div>
                        <div>
                          <span className="font-medium">Need:</span> {(item.parLevel - item.currentStock).toFixed(1)} {item.unit}
                        </div>
                      </div>
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${stockPercentage < 20 ? 'bg-red-500' : 'bg-yellow-500'}`}
                            style={{ width: `${stockPercentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {breakdownType === 'orders' && (
              <>
                <div className="bg-[#FEFCE8] border border-[#F5C10E]/30 rounded-lg p-3 mb-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-[#0F172A]">
                      {pendingOrders.length} pending orders
                    </p>
                    <p className="text-lg font-bold text-[#0F172A]">
                      ${pendingOrdersValue.toFixed(2)}
                    </p>
                  </div>
                </div>
                {pendingOrders.map(order => (
                  <div key={order.id} className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">Order #{order.id.slice(0, 8)}</h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(order.date).toLocaleDateString()} • {order.items.length} items
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">
                          ${order.totalCost.toFixed(2)}
                        </p>
                        <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-300 mt-1">
                          {order.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="pt-2 border-t">
                      <div className="space-y-1">
                        {order.items.map((orderItem, idx) => {
                          const invItem = inventory.find(i => i.id === orderItem.itemId);
                          return invItem ? (
                            <div key={idx} className="flex justify-between text-xs text-gray-600">
                              <span>{invItem.name}</span>
                              <span className="font-medium">{orderItem.quantity} {invItem.unit}</span>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t bg-white shrink-0">
            <Button type="button" variant="outline" onClick={() => setBreakdownDialogOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <div className="bg-red-600 rounded-2xl p-4 shadow-lg shadow-red-700/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-xl p-2">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-white text-sm">Don't Get 86'd!</p>
                <p className="text-red-100 text-xs mt-0.5">
                  {lowStockItems.length} {lowStockItems.length === 1 ? 'item' : 'items'} running low
                </p>
              </div>
            </div>
            <Link to="/inventory">
              <Button size="sm" className="bg-white text-red-600 hover:bg-red-50 font-bold shadow-none">
                Review
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Toast POS Stats */}
      {isConnected && salesData.length > 0 && (
        <Card className="bg-[#0F172A] border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Toast POS</span>
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-[10px] font-bold px-2">LIVE</Badge>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] text-slate-500 font-semibold mb-1">Revenue</p>
                <p className="text-lg font-black text-white tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
                  ${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-semibold mb-1">Covers</p>
                <p className="text-lg font-black text-white tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>{totalCovers}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-semibold mb-1">Avg Check</p>
                <p className="text-lg font-black text-white tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>${averageCheck.toFixed(0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="h-[3px] bg-[#F5C10E]" />
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="bg-[#FEFCE8] rounded-xl p-2.5 shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5 text-[#2563EB]" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-900 text-sm">AI Order Assistant</h3>
              <p className="text-xs text-gray-500 mt-0.5 mb-3">Smart ordering based on sales trends & forecasting</p>
              <Link to="/ai-orders">
                <Button className="w-full bg-[#0F172A] hover:bg-[#1E293B] text-white h-9 text-sm">
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  View AI Suggestions
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="h-[3px] bg-violet-500" />
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="bg-violet-50 rounded-xl p-2.5 shrink-0 mt-0.5">
              <ChefHat className="w-5 h-5 text-violet-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-900 text-sm">Recipe Builder</h3>
              <p className="text-xs text-gray-500 mt-0.5 mb-3">
                {recipes.length} recipes configured • Track ingredient costs
              </p>
              <Link to="/recipes">
                <Button className="w-full bg-[#0F172A] hover:bg-[#1E293B] text-white h-9 text-sm">
                  Manage Recipes
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="h-[3px] bg-teal-500" />
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="bg-teal-50 rounded-xl p-2.5 shrink-0 mt-0.5">
              <Camera className="w-5 h-5 text-teal-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-900 text-sm">Invoice Scanner</h3>
              <p className="text-xs text-gray-500 mt-0.5 mb-3">Scan invoices with AI • Automatically update inventory</p>
              <Link to="/invoice-scanner">
                <Button className="w-full bg-[#0F172A] hover:bg-[#1E293B] text-white h-9 text-sm">
                  <Camera className="w-3.5 h-3.5 mr-1.5" />
                  Scan Invoice
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="space-y-4">
        {/* Usage Summary - Hypothetical vs Actual */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center">
                <Activity className="w-5 h-5 mr-2 text-[#2563EB]" />
                Usage Summary - This Week
              </CardTitle>
              <Badge className={variancePercent > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}>
                {variancePercent > 0 ? '+' : ''}{variancePercent.toFixed(1)}% variance
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-3 pb-4 border-b border-gray-200">
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">Forecasted Usage</p>
                  <p className="text-2xl font-bold text-gray-900">{totalHypothetical.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">units</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">Actual Usage</p>
                  <p className="text-2xl font-bold text-[#0F172A]">{totalActual.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">units</p>
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="space-y-3">
                {usageSummary.map((item) => {
                  const variance = item.actual - item.hypothetical;
                  const variancePercent = (variance / item.hypothetical * 100);
                  const isOver = variance > 0;
                  const isExpanded = expandedCategory === item.id;

                  return (
                    <div key={item.id} className="space-y-2">
                      {/* Category Header - Clickable */}
                      <div 
                        className="flex items-center justify-between cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
                        onClick={() => toggleCategory(item.id)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center space-x-2">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-gray-500" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-500" />
                              )}
                              <span className="text-sm font-medium text-gray-900">{item.category}</span>
                            </div>
                            <span className="text-xs text-gray-500">
                              {item.actual} / {item.hypothetical} {item.unit}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2 relative overflow-hidden ml-6">
                            {/* Hypothetical bar (background) */}
                            <div 
                              className="absolute h-2 bg-gray-400 rounded-full"
                              style={{ width: '100%' }}
                            />
                            {/* Actual bar (overlay) */}
                            <div 
                              className={`absolute h-2 rounded-full ${
                                isOver ? 'bg-yellow-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${(item.actual / item.hypothetical * 100)}%` }}
                            />
                          </div>
                        </div>
                        <div className={`ml-3 min-w-[60px] text-right text-xs font-medium ${
                          isOver ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                          {isOver ? '+' : ''}{variance} {item.unit}
                          <div className="text-xs opacity-75">
                            ({isOver ? '+' : ''}{variancePercent.toFixed(1)}%)
                          </div>
                        </div>
                      </div>

                      {/* Expandable Items */}
                      {isExpanded && (
                        <div className="ml-6 space-y-2 pl-4 border-l-2 border-gray-200">
                          {item.items.map((subItem) => {
                            const subVariance = subItem.actual - subItem.hypothetical;
                            const subVariancePercent = (subVariance / subItem.hypothetical * 100);
                            const isSubOver = subVariance > 0;

                            return (
                              <div key={subItem.name} className="space-y-1 pb-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs font-medium text-gray-700">{subItem.name}</span>
                                      <span className="text-xs text-gray-500">
                                        {subItem.actual} / {subItem.hypothetical} {subItem.unit}
                                      </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-1.5 relative overflow-hidden">
                                      {/* Hypothetical bar (background) */}
                                      <div 
                                        className="absolute h-1.5 bg-gray-400 rounded-full"
                                        style={{ width: '100%' }}
                                      />
                                      {/* Actual bar (overlay) */}
                                      <div 
                                        className={`absolute h-1.5 rounded-full ${
                                          isSubOver ? 'bg-yellow-500' : 'bg-green-500'
                                        }`}
                                        style={{ width: `${(subItem.actual / subItem.hypothetical * 100)}%` }}
                                      />
                                    </div>
                                  </div>
                                  <div className={`ml-3 min-w-[50px] text-right text-xs ${
                                    isSubOver ? 'text-yellow-600' : 'text-green-600'
                                  }`}>
                                    {isSubOver ? '+' : ''}{subVariance}
                                    <div className="text-xs opacity-75">
                                      ({isSubOver ? '+' : ''}{subVariancePercent.toFixed(0)}%)
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center justify-center space-x-6 text-xs">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-2 bg-gray-400 rounded"></div>
                    <span className="text-gray-600">Forecasted</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-2 bg-green-500 rounded"></div>
                    <span className="text-gray-600">Under Forecast</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-2 bg-yellow-500 rounded"></div>
                    <span className="text-gray-600">Over Forecast</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Value by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" key="grid-bar" />
                  <XAxis dataKey="category" tick={{ fontSize: 12 }} key="xaxis-bar" />
                  <YAxis tick={{ fontSize: 12 }} key="yaxis-bar" />
                  <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} key="tooltip-bar" />
                  <Bar dataKey="value" fill="#3b82f6" name="Value ($)" key="bar-value" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-500 text-sm">
                No inventory data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Low Stock Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {lowStockItems.length === 0 ? (
                <p className="text-gray-500 text-center py-6 text-sm">All items are well stocked!</p>
              ) : (
                lowStockItems.map(item => {
                  const stockPercentage = (item.currentStock / item.parLevel) * 100;
                  return (
                    <div key={item.id} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                        <span className="text-sm font-medium text-gray-700">
                          {stockPercentage.toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>
                          {item.currentStock} / {item.parLevel} {item.unit}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            stockPercentage < 20 ? 'bg-red-500' : 'bg-yellow-500'
                          }`}
                          style={{ width: `${stockPercentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sales Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {salesChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={salesChartData}>
                  <CartesianGrid strokeDasharray="3 3" key="grid-line" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} key="xaxis-line" />
                  <YAxis tick={{ fontSize: 12 }} key="yaxis-line" />
                  <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} key="tooltip-line" />
                  <Line dataKey="revenue" fill="#3b82f6" name="Revenue ($)" stroke="#3b82f6" key="line-revenue" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-500 text-sm">
                No sales data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}