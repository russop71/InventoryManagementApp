import { useInventory } from '../contexts/InventoryContext';
import { useToast } from '../contexts/ToastContext';
import { useLabor } from '../contexts/LaborContext';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { AlertTriangle, ShoppingCart, TrendingUp, ChefHat, Sparkles, Camera, TrendingDown, Activity, ChevronDown, ChevronRight, Clock3, Flame, Wine, Beer, GlassWater, Coffee, DollarSign, UsersRound } from 'lucide-react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useState } from 'react';
import {
  getLatestDraftInventoryCount,
  getLatestFinalizedInventoryCount,
  getUnusualInventoryLosses,
  summarizeInventoryCount,
} from '../utils/inventoryCountWorkflow.js';

type SalesRangePreset = 'today' | 'this-week' | 'last-week' | 'this-month' | 'last-month' | 'custom';

export function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { inventory, orders, recipes, inventoryCounts } = useInventory();
  const { isConnected, salesData, menuItems, cogsCategories, addCogsCategory } = useToast();
  const { employees, targetLaborPercent, laborCostBreakdownForRange } = useLabor();
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [breakdownDialogOpen, setBreakdownDialogOpen] = useState(false);
  const [breakdownType, setBreakdownType] = useState<'items' | 'cost' | 'lowStock' | 'orders'>('items');
  const [newCogsCategoryName, setNewCogsCategoryName] = useState('');
  const [salesRangePreset, setSalesRangePreset] = useState<SalesRangePreset>('this-week');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [salesBreakdownOpen, setSalesBreakdownOpen] = useState(false);
  const canManageLabor = user?.role === 'Owner' || user?.role === 'Admin' || user?.role === 'Manager';
  const latestFinalizedInventoryCount = getLatestFinalizedInventoryCount(inventoryCounts);
  const activeInventoryCountDraft = getLatestDraftInventoryCount(inventoryCounts);
  const activeInventoryCountSummary = summarizeInventoryCount(activeInventoryCountDraft);
  const inventoryLossAlert = getUnusualInventoryLosses(latestFinalizedInventoryCount);

  const lowStockItems = inventory.filter(
    item => item.currentStock < item.parLevel * 0.3
  );

  const totalInventoryValue = inventory.reduce(
    (sum, item) => sum + (item.currentStock * item.unitCost),
    0
  );

  const toLocalDateKey = (value: string | Date) => {
    const date = value instanceof Date ? value : new Date(value);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getPresetDateBounds = (preset: SalesRangePreset) => {
    const referenceDate = new Date();
    const start = new Date(referenceDate);
    const end = new Date(referenceDate);

    switch (preset) {
      case 'today': {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return { startDate: toLocalDateKey(start), endDate: toLocalDateKey(end) };
      }
      case 'this-week': {
        const day = referenceDate.getDay();
        const offset = (day + 6) % 7;
        start.setDate(referenceDate.getDate() - offset);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return { startDate: toLocalDateKey(start), endDate: toLocalDateKey(end) };
      }
      case 'last-week': {
        const day = referenceDate.getDay();
        const offset = (day + 6) % 7;
        start.setDate(referenceDate.getDate() - offset - 7);
        end.setDate(start.getDate() + 6);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return { startDate: toLocalDateKey(start), endDate: toLocalDateKey(end) };
      }
      case 'this-month': {
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(referenceDate.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        return { startDate: toLocalDateKey(start), endDate: toLocalDateKey(end) };
      }
      case 'last-month': {
        start.setMonth(referenceDate.getMonth() - 1, 1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(referenceDate.getMonth(), 0);
        end.setHours(23, 59, 59, 999);
        return { startDate: toLocalDateKey(start), endDate: toLocalDateKey(end) };
      }
      case 'custom': {
        return { startDate: customStartDate, endDate: customEndDate || customStartDate };
      }
    }
  };

  const filteredSalesData = (() => {
    if (salesRangePreset === 'custom') {
      const startDate = customStartDate;
      const endDate = customEndDate || customStartDate;
      if (!startDate || !endDate) return [];
      return salesData.filter(day => day.date >= startDate && day.date <= endDate);
    }

    const { startDate, endDate } = getPresetDateBounds(salesRangePreset);
    return salesData.filter(day => day.date >= startDate && day.date <= endDate);
  })();

  // Calculate Toast data stats
  const totalRevenue = filteredSalesData.reduce((sum, day) => sum + day.revenue, 0);
  const totalCovers = filteredSalesData.reduce((sum, day) => sum + day.covers, 0);
  const averageCheck = totalCovers > 0 ? totalRevenue / totalCovers : 0;
  const chronologicalSales = [...filteredSalesData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const latestSalesDay = chronologicalSales[chronologicalSales.length - 1];
  const previousSalesDay = chronologicalSales[chronologicalSales.length - 2];
  const todaysRevenue = latestSalesDay?.revenue ?? 0;
  const todaysCovers = latestSalesDay?.covers ?? 0;
  const todaysAvgCheck = todaysCovers > 0 ? todaysRevenue / todaysCovers : 0;
  const revenueDeltaPercent = previousSalesDay && previousSalesDay.revenue > 0
    ? ((todaysRevenue - previousSalesDay.revenue) / previousSalesDay.revenue) * 100
    : 0;

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
  filteredSalesData.forEach(day => day.topItems.forEach(item => {
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

  const menuItemCogs = menuItems.map(mi => {
    const ingredientCost = mi.ingredients.reduce((sum, ing) => {
      const inv = inventory.find(i => i.id === ing.inventoryItemId);
      return sum + (inv ? ing.quantity * inv.unitCost : 0);
    }, 0);
    const sold = cogsUnitsSold[mi.name] ?? 0;
    return {
      ...mi,
      costPerItem: ingredientCost,
      sold,
      totalCOGS: ingredientCost * sold,
    };
  });

  const cogsCategoryTotals = cogsCategories.map(cat => {
    const totalCOGS = menuItemCogs.filter(mi => mi.cogsCategoryId === cat.id).reduce((sum, mi) => sum + mi.totalCOGS, 0);
    const itemCount = menuItemCogs.filter(mi => mi.cogsCategoryId === cat.id).length;
    return {
      categoryId: cat.id,
      name: cat.name,
      color: cat.color,
      totalCOGS,
      itemCount,
    };
  });

  const totalCogsCategoryCOGS = cogsCategoryTotals.reduce((sum, category) => sum + category.totalCOGS, 0);
  const cogsCategoryTotalsWithPercent = cogsCategoryTotals.map(category => ({
    ...category,
    percent: totalCogsCategoryCOGS > 0 ? (category.totalCOGS / totalCogsCategoryCOGS) * 100 : 0,
  }));

  const uncategorizedCogs = menuItemCogs.filter(mi => !mi.cogsCategoryId);

  const handleAddCogsCategory = () => {
    const name = newCogsCategoryName.trim();
    if (!name) return;
    addCogsCategory(name);
    setNewCogsCategoryName('');
  };

  const handleCategoryClick = (_: any, index: number) => {
    const categoryId = cogsCategoryTotals[index]?.categoryId;
    if (categoryId) {
      navigate(`/cogs?category=${encodeURIComponent(categoryId)}`);
    }
  };

  const handleCategoryCardClick = (categoryId: string) => {
    if (categoryId) {
      navigate(`/cogs?category=${encodeURIComponent(categoryId)}`);
    }
  };

  const handleTopSellerClick = (itemName: string) => {
    navigate(`/app/recipes?menuItem=${encodeURIComponent(itemName)}`);
  };

  const renderCogsTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload as { totalCOGS: number; percent: number };
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-lg">
        <p className="font-semibold text-slate-900">{label}</p>
        <p className="text-slate-600">COGS: ${data.totalCOGS.toFixed(2)}</p>
        <p className="text-slate-500">{data.percent.toFixed(1)}%</p>
      </div>
    );
  };

  // Aggregate top-selling items directly from raw POS sales rows
  const topSellingItems = Object.values(
    filteredSalesData.flatMap(day => day.topItems).reduce((acc, item) => {
      const normalizedName = item.itemName.trim().toLowerCase();
      if (!normalizedName) {
        return acc;
      }
      if (!acc[normalizedName]) {
        acc[normalizedName] = { itemName: item.itemName, quantity: 0, revenue: 0 };
      }
      acc[normalizedName].quantity += item.quantity;
      acc[normalizedName].revenue += item.revenue;
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
  const salesChartData = [...filteredSalesData].reverse().map((day, index) => ({
    id: `${day.date}-${index}`,
    date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    revenue: day.revenue,
    covers: day.covers,
  }));

  // Usage Summary - real raw usage from POS top items x recipe ingredient quantities
  const recipeByName = new Map(recipes.map(recipe => [recipe.menuItemName.trim().toLowerCase(), recipe]));

  const usageRows = filteredSalesData
    .map(day => {
      const dayTs = new Date(day.date).getTime();
      const categoryTotals = new Map<string, number>();
      const itemTotals = new Map<string, { category: string; name: string; unit: string; qty: number }>();

      day.topItems.forEach(soldItem => {
        const recipe = recipeByName.get(soldItem.itemName.trim().toLowerCase());
        if (!recipe) return;

        recipe.ingredients.forEach(ingredient => {
          const inv = inventory.find(i => i.id === ingredient.inventoryItemId);
          if (!inv) return;

          const usedQty = ingredient.quantity * soldItem.quantity;
          if (!Number.isFinite(usedQty)) return;

          const category = inv.category || 'Uncategorized';
          categoryTotals.set(category, (categoryTotals.get(category) || 0) + usedQty);

          const existingItem = itemTotals.get(inv.id);
          itemTotals.set(inv.id, {
            category,
            name: inv.name,
            unit: ingredient.unit || inv.unit || 'units',
            qty: (existingItem?.qty || 0) + usedQty,
          });
        });
      });

      return { dayTs, categoryTotals, itemTotals };
    })
    .filter(row => Number.isFinite(row.dayTs))
    .sort((left, right) => left.dayTs - right.dayTs);

  const currentWindow = usageRows.slice(-7);
  const previousWindow = usageRows.slice(Math.max(0, usageRows.length - 14), Math.max(0, usageRows.length - 7));

  const aggregateWindow = (rows: typeof usageRows) => {
    const byCategory = new Map<string, { total: number; items: Map<string, { name: string; unit: string; qty: number }> }>();

    rows.forEach(row => {
      row.categoryTotals.forEach((qty, category) => {
        const existing = byCategory.get(category);
        byCategory.set(category, {
          total: (existing?.total || 0) + qty,
          items: existing?.items || new Map<string, { name: string; unit: string; qty: number }>(),
        });
      });

      row.itemTotals.forEach((itemUsage, itemId) => {
        const categoryBucket = byCategory.get(itemUsage.category) || {
          total: 0,
          items: new Map<string, { name: string; unit: string; qty: number }>(),
        };
        const existingItem = categoryBucket.items.get(itemId);
        categoryBucket.items.set(itemId, {
          name: itemUsage.name,
          unit: itemUsage.unit,
          qty: (existingItem?.qty || 0) + itemUsage.qty,
        });
        byCategory.set(itemUsage.category, categoryBucket);
      });
    });

    return byCategory;
  };

  const currentAgg = aggregateWindow(currentWindow);
  const previousAgg = aggregateWindow(previousWindow);

  const categoryKeys = Array.from(new Set([...Array.from(currentAgg.keys()), ...Array.from(previousAgg.keys())]));

  const usageSummary = categoryKeys
    .map(category => {
      const currentCategory = currentAgg.get(category);
      const previousCategory = previousAgg.get(category);

      const actual = Number((currentCategory?.total || 0).toFixed(2));
      const rawHypothetical = Number((previousCategory?.total || 0).toFixed(2));
      const hypothetical = rawHypothetical > 0 ? rawHypothetical : actual;

      const itemKeys = Array.from(new Set([
        ...Array.from(currentCategory?.items.keys() || []),
        ...Array.from(previousCategory?.items.keys() || []),
      ]));

      const itemUsage = itemKeys
        .map(itemId => {
          const currentItem = currentCategory?.items.get(itemId);
          const previousItem = previousCategory?.items.get(itemId);
          const itemActual = Number((currentItem?.qty || 0).toFixed(2));
          const itemRawHyp = Number((previousItem?.qty || 0).toFixed(2));
          return {
            name: currentItem?.name || previousItem?.name || 'Unknown item',
            hypothetical: itemRawHyp > 0 ? itemRawHyp : itemActual,
            actual: itemActual,
            unit: currentItem?.unit || previousItem?.unit || 'units',
          };
        })
        .sort((left, right) => right.actual - left.actual)
        .slice(0, 5);

      return {
        id: `usage-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        category,
        hypothetical,
        actual,
        unit: itemUsage[0]?.unit || 'units',
        items: itemUsage,
      };
    })
    .filter(category => category.actual > 0 || category.hypothetical > 0)
    .sort((left, right) => right.actual - left.actual);

  const totalHypothetical = usageSummary.reduce((sum, item) => sum + item.hypothetical, 0);
  const totalActual = usageSummary.reduce((sum, item) => sum + item.actual, 0);
  const variancePercent = totalHypothetical > 0 ? ((totalActual - totalHypothetical) / totalHypothetical * 100) : 0;

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

  const salesBreakdownItems = Object.values(
    filteredSalesData.flatMap(day => day.topItems).reduce((acc, item) => {
      if (!acc[item.itemName]) {
        acc[item.itemName] = { itemName: item.itemName, quantity: 0, revenue: 0 };
      }
      acc[item.itemName].quantity += item.quantity;
      acc[item.itemName].revenue += item.revenue;
      return acc;
    }, {} as Record<string, { itemName: string; quantity: number; revenue: number }>)
  ).sort((left, right) => right.quantity - left.quantity || right.revenue - left.revenue);

  const salesRangeLabel = salesRangePreset === 'custom'
    ? (customStartDate && customEndDate ? `${customStartDate} → ${customEndDate}` : 'Custom range')
    : salesRangePreset === 'today'
      ? 'Today'
      : salesRangePreset === 'this-week'
        ? 'This week'
        : salesRangePreset === 'last-week'
          ? 'Last week'
          : salesRangePreset === 'this-month'
            ? 'This month'
            : 'Last month';
  const laborBounds = getPresetDateBounds(salesRangePreset);
  const laborBreakdown = laborBounds.startDate && laborBounds.endDate
    ? laborCostBreakdownForRange(laborBounds.startDate, laborBounds.endDate)
    : { hourly: 0, salaried: 0, total: 0 };
  const scheduledLaborCost = laborBreakdown.total;
  const scheduledLaborPercent = totalRevenue > 0 ? (laborBreakdown.total / totalRevenue) * 100 : 0;
  const hourlyLaborPercent = totalRevenue > 0 ? (laborBreakdown.hourly / totalRevenue) * 100 : 0;
  const salariedLaborPercent = totalRevenue > 0 ? (laborBreakdown.salaried / totalRevenue) * 100 : 0;
  const salariedManagerCount = employees.filter(employee => employee.active && employee.payType === 'salary').length;
  const hourlyShare = laborBreakdown.total > 0 ? (laborBreakdown.hourly / laborBreakdown.total) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Dashboard</h2>
          <p className="text-xs text-gray-400 mt-0.5 font-semibold uppercase tracking-wider">Real-time overview</p>
        </div>
      </div>

      {inventoryLossAlert.isUnusual && latestFinalizedInventoryCount && (
        <Link to={`/app/inventory/counts/${latestFinalizedInventoryCount.id}`} className="block rounded-2xl bg-rose-700 p-4 text-white shadow-lg shadow-rose-900/15 transition hover:bg-rose-800">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15"><AlertTriangle className="h-5 w-5" /></div>
              <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-100">Inventory loss alert</p><p className="mt-1 text-lg font-black">${inventoryLossAlert.totalLossValue.toFixed(2)} in unusual shortages</p><p className="mt-1 break-words text-xs text-rose-100">{inventoryLossAlert.items.slice(0, 3).map(item => item.name).join(', ')}{inventoryLossAlert.affectedItems > 3 ? ` +${inventoryLossAlert.affectedItems - 3} more` : ''}</p></div>
            </div>
            <ChevronRight className="mt-2 h-5 w-5 shrink-0" />
          </div>
        </Link>
      )}

      {activeInventoryCountDraft && (
        <Link to={`/app/inventory/counts/${activeInventoryCountDraft.id}`} className="block rounded-2xl border border-amber-200 bg-amber-50 p-4 transition hover:bg-amber-100/70">
          <div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-200/60"><Clock3 className="h-5 w-5 text-amber-900" /></div><div className="min-w-0"><p className="break-words text-sm font-black text-amber-950">Resume inventory count</p><p className="mt-1 text-xs text-amber-800">{activeInventoryCountSummary.completedItems}/{activeInventoryCountSummary.totalItems} items counted · {activeInventoryCountSummary.remainingItems} remaining</p></div></div><ChevronRight className="h-5 w-5 shrink-0 text-amber-900" /></div>
        </Link>
      )}

      {/* ── Compact 3-stat strip ─────────────────────── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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

        {canManageLabor && <Card className="cursor-pointer overflow-hidden border-0 bg-white shadow-sm transition-all duration-200 hover:shadow-md" onClick={() => navigate('/app/labor')}>
          <div className={`h-[3px] ${scheduledLaborPercent > targetLaborPercent ? 'bg-red-500' : 'bg-violet-500'}`} />
          <CardContent className="p-3">
            <div className="mb-2 flex items-center justify-between"><span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Labour</span><UsersRound className="h-3 w-3 text-violet-500" /></div>
            <div className={`text-2xl font-black tabular-nums leading-none ${scheduledLaborPercent > targetLaborPercent ? 'text-red-600' : 'text-violet-700'}`} style={{ fontFamily: 'var(--font-mono)' }}>{totalRevenue > 0 ? `${scheduledLaborPercent.toFixed(1)}%` : `$${scheduledLaborCost.toFixed(0)}`}</div>
            <p className="mt-1.5 text-[9px] font-semibold leading-tight text-gray-400">Target {targetLaborPercent}% · view schedule</p>
          </CardContent>
        </Card>}
      </div>

      <Card className="border-0 shadow-sm overflow-hidden bg-white">
        <div className="h-[3px] bg-[#F5C10E]" />
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#F5C10E]/20 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-[#9A7600]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#0F172A]">Sales</p>
                  <p className="text-[10px] text-gray-400 font-medium">Sales window • pick a range to review revenue</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSalesBreakdownOpen(true)}
                  className="rounded-full border border-gray-200 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-gray-600 hover:bg-slate-50"
                >
                  Breakdown
                </button>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {filteredSalesData.length}d data
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {([
                ['today', 'Today'],
                ['this-week', 'This week'],
                ['last-week', 'Last week'],
                ['this-month', 'This month'],
                ['last-month', 'Last month'],
                ['custom', 'Custom'],
              ] as Array<[SalesRangePreset, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setSalesRangePreset(value);
                    if (value !== 'custom') {
                      setCustomStartDate('');
                      setCustomEndDate('');
                    }
                  }}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest transition ${salesRangePreset === value ? 'bg-[#0B1220] text-[#F5C10E]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {salesRangePreset === 'custom' && (
              <div className="flex flex-wrap gap-2">
                <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-2.5 py-2 text-[11px] font-medium text-gray-600">
                  <span>From</span>
                  <Input type="date" value={customStartDate} onChange={(event) => setCustomStartDate(event.target.value)} className="h-8 w-auto min-w-[130px] border-0 bg-transparent p-0 text-[11px]" />
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-2.5 py-2 text-[11px] font-medium text-gray-600">
                  <span>To</span>
                  <Input type="date" value={customEndDate} onChange={(event) => setCustomEndDate(event.target.value)} className="h-8 w-auto min-w-[130px] border-0 bg-transparent p-0 text-[11px]" />
                </label>
              </div>
            )}
          </div>

          {filteredSalesData.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-5 text-center">
              <span className="mb-2 inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-amber-800">
                Sales
              </span>
              <p className="text-sm font-semibold text-gray-500">No sales data for this range</p>
              <p className="text-xs text-gray-400 mt-1">Choose another period or import POS data to populate this view.</p>
            </div>
          ) : (
            <>
              <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-800">Sales</p>
                    <p className="text-[11px] font-semibold text-slate-700">{salesRangeLabel}</p>
                  </div>
                  <p className="text-[11px] font-semibold text-slate-600">{filteredSalesData.length} days</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="rounded-xl border border-gray-100 p-3">
                  <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Revenue</p>
                  <p className="mt-1 text-lg font-black text-[#0F172A] tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
                    ${todaysRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                  <p className={`text-[10px] mt-1 font-semibold ${revenueDeltaPercent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {revenueDeltaPercent >= 0 ? '+' : ''}{revenueDeltaPercent.toFixed(1)}% vs prev day
                  </p>
                </div>
                <div className="rounded-xl border border-gray-100 p-3">
                  <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Covers</p>
                  <p className="mt-1 text-lg font-black text-[#0F172A] tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
                    {todaysCovers.toLocaleString('en-US')}
                  </p>
                  <p className="text-[10px] mt-1 text-gray-500 font-semibold">guest count</p>
                </div>
                <div className="rounded-xl border border-gray-100 p-3">
                  <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Avg Check</p>
                  <p className="mt-1 text-lg font-black text-[#0F172A] tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
                    ${todaysAvgCheck.toFixed(0)}
                  </p>
                  <p className="text-[10px] mt-1 text-gray-500 font-semibold">per cover</p>
                </div>
              </div>

              <div className="h-[180px] rounded-xl border border-gray-100 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={salesChartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(value) => `$${Math.round(value)}`} tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(value: number) => [`$${value.toLocaleString('en-US')}`, 'Revenue']}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Line type="monotone" dataKey="revenue" stroke="#D9A900" strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={salesBreakdownOpen} onOpenChange={setSalesBreakdownOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Sales breakdown for {salesRangeLabel}</DialogTitle>
            <DialogDescription>Every menu item sold within the selected sales window.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-2 rounded-2xl border border-gray-100 p-3">
            {salesBreakdownItems.length === 0 ? (
              <p className="text-sm text-gray-500">No items sold in this date range.</p>
            ) : (
              salesBreakdownItems.map(item => (
                <div key={item.itemName} className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.itemName}</p>
                    <p className="text-[11px] text-gray-500">{item.quantity} sold</p>
                  </div>
                  <p className="text-sm font-black text-slate-700">${item.revenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {canManageLabor && <Card className="overflow-hidden border-0 bg-[#0B1220] text-white shadow-sm">
        <div className="h-[3px] bg-[#F5C10E]" />
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-black">Labour versus sales</p>
              <p className="mt-1 text-xs text-white/45">{salesRangeLabel} · scheduled hourly labour plus prorated active salaries</p>
            </div>
            <Link to="/app/labor" className="inline-flex w-fit items-center gap-1 rounded-full border border-white/15 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#F5C10E]">Open scheduler <ChevronRight className="h-3.5 w-3.5" /></Link>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <LaborSummary label="Sales" value={`$${totalRevenue.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`} detail={`${filteredSalesData.length} day${filteredSalesData.length === 1 ? '' : 's'} in range`} />
            <LaborSummary label="Hourly labour" value={`$${laborBreakdown.hourly.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`} detail={totalRevenue > 0 ? `${hourlyLaborPercent.toFixed(1)}% of sales` : 'Waiting for sales'} />
            <LaborSummary label="Salaried labour" value={`$${laborBreakdown.salaried.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`} detail={`${salariedManagerCount} salaried team member${salariedManagerCount === 1 ? '' : 's'} · ${totalRevenue > 0 ? `${salariedLaborPercent.toFixed(1)}% of sales` : 'prorated'}`} />
            <LaborSummary label="Total labour" value={totalRevenue > 0 ? `${scheduledLaborPercent.toFixed(1)}%` : `$${laborBreakdown.total.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`} detail={`Target ${targetLaborPercent}% · ${scheduledLaborPercent > targetLaborPercent ? 'above target' : 'on target'}`} warning={totalRevenue > 0 && scheduledLaborPercent > targetLaborPercent} />
          </div>
          <div className="mt-4 rounded-2xl bg-white/5 p-3">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-white/40"><span>Labour mix</span><span>{hourlyShare.toFixed(0)}% hourly · {(100 - hourlyShare).toFixed(0)}% salaried</span></div>
            <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-[#F5C10E]" style={{ width: `${hourlyShare}%` }} /><div className="h-full flex-1 bg-white/35" /></div>
          </div>
        </CardContent>
      </Card>}

      {/* ── COGS categories bar graph ────────────────────────────────── */}
      <div className="rounded-3xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Cost of Goods Sold by Category</p>
              <p className="text-xs text-slate-500">Click a category to view a full breakdown.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="text-[10px] uppercase font-semibold tracking-widest text-slate-400">{salesData.length}d period</span>
              <span className="text-[10px] uppercase font-semibold tracking-widest text-slate-400">{menuItems.length} menu items</span>
            </div>
          </div>
        </div>

        <div className="px-4 py-6">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cogsCategoryTotalsWithPercent} margin={{ top: 10, right: 16, left: -12, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(value) => `$${Math.round(value)}`} tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                <Tooltip content={renderCogsTooltip} />
                <Bar dataKey="totalCOGS" radius={[8, 8, 0, 0]} onClick={handleCategoryClick}>
                  {cogsCategoryTotals.map((entry) => (
                    <Cell key={`cell-${entry.categoryId}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="px-4 pb-4">
          <div className="grid grid-cols-2 gap-3 mb-4">
            {cogsCategoryTotalsWithPercent.map(category => (
              <button
                key={category.categoryId}
                type="button"
                onClick={() => handleCategoryCardClick(category.categoryId)}
                className="rounded-2xl border border-gray-100 p-3 flex items-center gap-3 text-left transition hover:bg-slate-50 cursor-pointer"
              >
                <span className="w-3 h-3 rounded-full" style={{ background: category.color }} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{category.name}</p>
                  <p className="text-xs text-slate-500">${category.totalCOGS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-gray-100 p-4">
            <p className="text-sm font-semibold text-slate-900">Create COGS category</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="New category name"
                value={newCogsCategoryName}
                onChange={(e) => setNewCogsCategoryName(e.target.value)}
                className="min-w-0"
              />
              <Button type="button" onClick={handleAddCogsCategory} className="w-full sm:w-auto">
                Add Category
              </Button>
            </div>
          </div>
        </div>
      </div>

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
                <p className="text-[10px] text-gray-400 font-medium">Uses the raw item rows from the selected sales window</p>
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
              <p className="text-xs text-gray-400">Sales rows will appear here once there is transaction data in the selected range</p>
            </div>
          ) : (
            <div className="space-y-0">
              {topSellingItems.map((item, idx) => {
                const maxQty = topSellingItems[0].quantity;
                const pct = Math.round((item.quantity / maxQty) * 100);
                const rankColors = ['#F5C10E', '#F5C10E', '#9CA3AF', '#9CA3AF', '#9CA3AF'];
                return (
                  <button
                    key={item.itemName}
                    type="button"
                    onClick={() => handleTopSellerClick(item.itemName)}
                    className="w-full text-left flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0 transition hover:bg-slate-50"
                  >
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
                  </button>
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
                <p className="font-bold text-white text-sm">Low Stock</p>
                <p className="text-red-100 text-xs mt-0.5">
                  {lowStockItems.length} {lowStockItems.length === 1 ? 'item' : 'items'} running low
                </p>
              </div>
            </div>
            <Link to="/app/inventory">
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
              <Sparkles className="w-5 h-5 text-[#B58B00]" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-900 text-sm">AI Order Assistant</h3>
              <p className="text-xs text-gray-500 mt-0.5 mb-3">Smart ordering based on sales trends & forecasting</p>
              <Link to="/app/orders">
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
              <Link to="/app/recipes">
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
              <Link to="/app/invoice-scanner">
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
                <Activity className="w-5 h-5 mr-2 text-[#B58B00]" />
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
                  const safeHypothetical = item.hypothetical > 0 ? item.hypothetical : 1;
                  const variancePercent = (variance / safeHypothetical * 100);
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
                              style={{ width: `${(item.actual / safeHypothetical * 100)}%` }}
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
                            const safeSubHypothetical = subItem.hypothetical > 0 ? subItem.hypothetical : 1;
                            const subVariancePercent = (subVariance / safeSubHypothetical * 100);
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
                                        style={{ width: `${(subItem.actual / safeSubHypothetical * 100)}%` }}
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

function LaborSummary({ label, value, detail, warning = false }: { label: string; value: string; detail: string; warning?: boolean }) {
  return <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><p className="text-[9px] font-black uppercase tracking-widest text-white/40">{label}</p><p className={`mt-2 break-words text-xl font-black tabular-nums ${warning ? 'text-red-300' : 'text-white'}`} style={{ fontFamily: 'var(--font-mono)' }}>{value}</p><p className={`mt-1 text-[10px] font-semibold leading-4 ${warning ? 'text-red-200/75' : 'text-white/40'}`}>{detail}</p></div>;
}
