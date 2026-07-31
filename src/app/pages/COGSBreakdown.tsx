import { useMemo, useState } from 'react';
import { useInventory } from '../contexts/InventoryContext';
import { useToast } from '../contexts/ToastContext';
import { useLocation, useNavigate } from 'react-router';
import { ChevronLeft, ChevronDown, ChevronRight, TrendingDown, DollarSign, ShoppingBag, Filter, Calendar } from 'lucide-react';

const Y = '#F5C10E';
const D = '#0F172A';

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(n: number) {
  return `${n.toFixed(1)}%`;
}

function fmtRangeLabel(startDate: string, endDate: string) {
  if (!startDate || !endDate) return 'No date selected';
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  if (startDate === endDate) {
    return formatter.format(new Date(startDate));
  }
  return `${formatter.format(new Date(startDate))} - ${formatter.format(new Date(endDate))}`;
}

export function COGSBreakdown() {
  const navigate = useNavigate();
  const location = useLocation();
  const { inventory } = useInventory();
  const { salesData, menuItems, cogsCategories } = useToast();
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const initialCategory = useMemo(() => new URLSearchParams(location.search).get('category') || 'all', [location.search]);
  const dateBounds = useMemo(() => {
    const sortedDates = [...new Set(salesData.map(day => day.date))].sort();
    return {
      start: sortedDates[0] || '',
      end: sortedDates[sortedDates.length - 1] || '',
    };
  }, [salesData]);
  const [draftDateRange, setDraftDateRange] = useState(() => ({ start: dateBounds.start, end: dateBounds.end }));
  const [appliedDateRange, setAppliedDateRange] = useState(() => ({ start: dateBounds.start, end: dateBounds.end }));
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);

  const visibleSalesData = salesData.filter(day => {
    if (!appliedDateRange.start || !appliedDateRange.end) return true;
    return day.date >= appliedDateRange.start && day.date <= appliedDateRange.end;
  });

  // ── Aggregate units sold per menu item across all days ─────────────────────
  const unitsSold: Record<string, number> = {};
  const revenueByMenuItem: Record<string, number> = {};
  visibleSalesData.forEach(day => {
    day.topItems.forEach(item => {
      unitsSold[item.itemName] = (unitsSold[item.itemName] || 0) + item.quantity;
      revenueByMenuItem[item.itemName] = (revenueByMenuItem[item.itemName] || 0) + item.revenue;
    });
  });

  // ── Cost per menu item + total COGS ────────────────────────────────────────
  const menuItemCosts = menuItems.map(mi => {
    const ingredientBreakdown = mi.ingredients.map(ing => {
      const invItem = inventory.find(i => i.id === ing.inventoryItemId);
      return {
        name:     invItem?.name     ?? 'Unknown',
        category: invItem?.category ?? 'Other',
        supplier: invItem?.supplier ?? 'Unknown',
        qty:      ing.quantity,
        unit:     invItem?.unit     ?? '',
        unitCost: invItem?.unitCost ?? 0,
        lineCost: ing.quantity * (invItem?.unitCost ?? 0),
      };
    });
    const costPerItem = ingredientBreakdown.reduce((s, i) => s + i.lineCost, 0);
    const sold        = unitsSold[mi.name] ?? 0;
    const totalCOGS   = costPerItem * sold;
    const totalRevenueForItem = revenueByMenuItem[mi.name] ?? 0;
    const grossProfit = totalRevenueForItem - totalCOGS;
    const cogsPercentOfRevenue = totalRevenueForItem > 0 ? (totalCOGS / totalRevenueForItem) * 100 : 0;
    return {
      id: mi.id,
      name: mi.name,
      category: mi.category,
      cogsCategoryId: mi.cogsCategoryId || 'uncategorized',
      cogsCategoryName: mi.cogsCategoryId
        ? cogsCategories.find(cat => cat.id === mi.cogsCategoryId)?.name ?? 'Uncategorized'
        : 'Uncategorized',
      costPerItem,
      sold,
      totalCOGS,
      totalRevenue: totalRevenueForItem,
      grossProfit,
      cogsPercentOfRevenue,
      ingredientBreakdown,
    };
  });

  const totalCOGS   = menuItemCosts.reduce((s, i) => s + i.totalCOGS, 0);
  const totalRevenue = visibleSalesData.reduce((s, d) => s + d.revenue, 0);
  const cogsPercent  = totalRevenue > 0 ? (totalCOGS / totalRevenue) * 100 : 0;
  const totalCovers  = visibleSalesData.reduce((s, d) => s + d.covers, 0);
  const cogsPerCover = totalCovers > 0 ? totalCOGS / totalCovers : 0;
  const grossProfit = totalRevenue - totalCOGS;
  const grossMarginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  // ── Group by COGS category (food / liquor / wine / non-alcoholic) ────────
  const categories = Object.values(
    menuItemCosts.reduce((acc, item) => {
      const categoryId = item.cogsCategoryId || 'uncategorized';
      const categoryName = item.cogsCategoryName;
      if (!acc[categoryId]) acc[categoryId] = { categoryId, category: categoryName, items: [], totalCOGS: 0, totalRevenue: 0 };
      acc[categoryId].items.push(item);
      acc[categoryId].totalCOGS += item.totalCOGS;
      acc[categoryId].totalRevenue += item.totalRevenue;
      return acc;
    }, {} as Record<string, { categoryId: string; category: string; items: typeof menuItemCosts; totalCOGS: number; totalRevenue: number }>)
  ).map(category => ({
    ...category,
    grossProfit: category.totalRevenue - category.totalCOGS,
    cogsPercentOfRevenue: category.totalRevenue > 0 ? (category.totalCOGS / category.totalRevenue) * 100 : 0,
  })).sort((a, b) => b.totalCOGS - a.totalCOGS);

  const visibleCategories = selectedCategory === 'all'
    ? categories
    : categories.filter(category => category.categoryId === selectedCategory);

  const visibleMenuItems = menuItemCosts
    .filter(item => selectedCategory === 'all' || item.cogsCategoryId === selectedCategory)
    .sort((left, right) => right.totalCOGS - left.totalCOGS);

  const hasSalesData = visibleSalesData.length > 0 && menuItems.length > 0;

  return (
    <div className="-mx-4 min-h-screen bg-[#F4F5F7]">

      {/* ── Page header ──────────────────────────────── */}
      <div className="bg-white px-4 pt-3 pb-5 border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm font-semibold text-gray-500 mb-3">
          <ChevronLeft className="w-4 h-4" />
          Dashboard
        </button>
        <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: D }}>COGS Report</h1>
        <p className="text-xs text-gray-400 mt-0.5 font-semibold uppercase tracking-wider">
          Cost of Goods Sold · {visibleSalesData.length} day{visibleSalesData.length !== 1 ? 's' : ''} · {fmtRangeLabel(appliedDateRange.start, appliedDateRange.end)}
        </p>

        {/* Summary strip */}
        <div className="grid grid-cols-2 gap-3 mt-4 md:grid-cols-4">
          {[
            { label: 'Total COGS',     value: `$${fmt(totalCOGS)}`,             Icon: DollarSign,  color: D },
            { label: '% of Revenue',   value: `${cogsPercent.toFixed(1)}%`,     Icon: TrendingDown,color: cogsPercent > 35 ? '#DC2626' : '#16A34A' },
            { label: 'Per Cover',      value: `$${cogsPerCover.toFixed(2)}`,    Icon: ShoppingBag, color: D },
            { label: 'Gross Margin',   value: fmtPct(grossMarginPercent),       Icon: ShoppingBag, color: grossMarginPercent >= 0 ? D : '#DC2626' },
          ].map(({ label, value, Icon, color }) => (
            <div key={label} className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 text-center">
              <Icon className="w-4 h-4 mx-auto mb-1.5" style={{ color: Y }} />
              <p className="text-[13px] font-black leading-none" style={{ color, fontFamily: 'var(--font-mono)' }}>{value}</p>
              <p className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider mt-1">{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_1fr_auto] lg:items-end">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="rounded-2xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
              <span className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
                <Calendar className="h-3.5 w-3.5" />
                Start date
              </span>
              <input
                type="date"
                value={draftDateRange.start}
                onChange={event => setDraftDateRange(prev => ({ ...prev, start: event.target.value }))}
                className="w-full bg-transparent text-sm font-semibold text-gray-900 outline-none"
              />
            </label>
            <label className="rounded-2xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
              <span className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
                <Calendar className="h-3.5 w-3.5" />
                End date
              </span>
              <input
                type="date"
                value={draftDateRange.end}
                onChange={event => setDraftDateRange(prev => ({ ...prev, end: event.target.value }))}
                className="w-full bg-transparent text-sm font-semibold text-gray-900 outline-none"
              />
            </label>
          </div>

          <div className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-2 text-[11px] font-semibold text-gray-500 shadow-sm">
            <Filter className="h-3.5 w-3.5" />
            <span>Category</span>
          </div>

          <button
            type="button"
            onClick={() => setAppliedDateRange(draftDateRange)}
            className="rounded-full px-4 py-2 text-sm font-bold transition hover:opacity-90"
            style={{ background: Y, color: D }}
          >
            Run Report
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
          <div className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-500">
            {fmtRangeLabel(appliedDateRange.start, appliedDateRange.end)}
          </div>
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className="rounded-full px-3 py-1.5 text-[11px] font-semibold"
            style={selectedCategory === 'all' ? { background: Y, color: D } : { background: '#FFFFFF', color: '#6B7280', border: '1px solid #E5E7EB' }}
          >
            All Categories
          </button>
          {categories.map(category => (
            <button
              key={category.categoryId}
              type="button"
              onClick={() => setSelectedCategory(category.categoryId)}
              className="rounded-full px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap"
              style={selectedCategory === category.categoryId ? { background: Y, color: D } : { background: '#FFFFFF', color: '#6B7280', border: '1px solid #E5E7EB' }}
            >
              {category.category}
            </button>
          ))}
        </div>
      </div>

      {/* ── No data state ─────────────────────────────── */}
      {!hasSalesData && (
        <div className="flex flex-col items-center py-16 px-6 text-center gap-3">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `${Y}20` }}>
            <DollarSign className="w-7 h-7" style={{ color: Y }} />
          </div>
          <p className="font-bold text-gray-600">No COGS data yet</p>
          <p className="text-sm text-gray-400">Choose a date range and run the report to load COGS data.</p>
        </div>
      )}

      {/* ── Category breakdown ───────────────────────── */}
      {hasSalesData && (
        <div className="px-4 py-4 space-y-3">
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="grid grid-cols-[1.3fr_0.9fr_0.9fr_0.9fr] gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">
              <span>POS Category</span>
              <span className="text-right">Revenue</span>
              <span className="text-right">COGS</span>
              <span className="text-right">COGS %</span>
            </div>
            <div className="divide-y divide-gray-50">
              {visibleCategories.map(category => (
                <div key={category.categoryId} className="grid grid-cols-[1.3fr_0.9fr_0.9fr_0.9fr] gap-3 px-4 py-3 text-sm text-gray-700">
                  <div>
                    <p className="font-semibold text-gray-900">{category.category}</p>
                    <p className="text-[11px] text-gray-500 mt-1">{category.items.length} menu item{category.items.length !== 1 ? 's' : ''}</p>
                  </div>
                  <p className="text-right font-semibold tabular-nums text-gray-900">${fmt(category.totalRevenue)}</p>
                  <p className="text-right font-semibold tabular-nums text-gray-900">${fmt(category.totalCOGS)}</p>
                  <p className="text-right font-semibold tabular-nums" style={{ color: category.cogsPercentOfRevenue > 35 ? '#DC2626' : D }}>
                    {fmtPct(category.cogsPercentOfRevenue)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="grid grid-cols-[1.6fr_0.8fr_0.9fr_0.9fr_0.9fr_0.5fr] gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">
              <span>Menu Item</span>
              <span className="text-right">Sold</span>
              <span className="text-right">Revenue</span>
              <span className="text-right">COGS</span>
              <span className="text-right">COGS %</span>
              <span />
            </div>
            <div className="divide-y divide-gray-50">
              {visibleMenuItems.map(item => {
                const open = expandedItemId === item.id;
                return (
                  <div key={item.id}>
                    <button
                      type="button"
                      className="grid w-full grid-cols-[1.6fr_0.8fr_0.9fr_0.9fr_0.9fr_0.5fr] gap-3 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50"
                      onClick={() => setExpandedItemId(open ? null : item.id)}
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{item.name}</p>
                        <p className="text-[11px] text-gray-500 mt-1 truncate">{item.cogsCategoryName} • ${fmt(item.costPerItem)}/item</p>
                      </div>
                      <p className="text-right font-semibold tabular-nums text-gray-900">{item.sold}</p>
                      <p className="text-right font-semibold tabular-nums text-gray-900">${fmt(item.totalRevenue)}</p>
                      <p className="text-right font-semibold tabular-nums text-gray-900">${fmt(item.totalCOGS)}</p>
                      <p className="text-right font-semibold tabular-nums" style={{ color: item.cogsPercentOfRevenue > 35 ? '#DC2626' : D }}>
                        {fmtPct(item.cogsPercentOfRevenue)}
                      </p>
                      <div className="flex justify-end text-gray-400">
                        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </div>
                    </button>

                    {open && (
                      <div className="border-t border-gray-50 bg-gray-50 px-4 py-3">
                        <div className="grid grid-cols-[1.5fr_0.8fr_0.8fr_0.9fr] gap-3 pb-2 text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">
                          <span>Ingredient</span>
                          <span className="text-right">Qty</span>
                          <span className="text-right">Unit Cost</span>
                          <span className="text-right">Line Cost</span>
                        </div>
                        <div className="space-y-2">
                          {item.ingredientBreakdown.map((ingredient, index) => (
                            <div key={`${item.id}-${ingredient.name}-${index}`} className="grid grid-cols-[1.5fr_0.8fr_0.8fr_0.9fr] gap-3 rounded-xl bg-white px-3 py-2 text-sm text-gray-700">
                              <div className="min-w-0">
                                <p className="font-medium text-gray-900 truncate">{ingredient.name}</p>
                                <p className="text-[11px] text-gray-500 truncate">{ingredient.supplier}</p>
                              </div>
                              <p className="text-right tabular-nums">{ingredient.qty} {ingredient.unit}</p>
                              <p className="text-right tabular-nums">${ingredient.unitCost.toFixed(2)}</p>
                              <p className="text-right font-semibold tabular-nums text-gray-900">${ingredient.lineCost.toFixed(3)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Grand total */}
          <div className="rounded-2xl p-4 flex items-center justify-between" style={{ background: D }}>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Gross Profit</p>
              <p className="text-xs text-slate-500 mt-0.5">{salesData.length} day period</p>
            </div>
            <p className="text-2xl font-black text-white tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
              ${fmt(grossProfit)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
