import { useState } from 'react';
import { useInventory } from '../contexts/InventoryContext';
import { useToast } from '../contexts/ToastContext';
import { useNavigate } from 'react-router';
import { ChevronLeft, ChevronDown, ChevronRight, TrendingDown, DollarSign, ShoppingBag } from 'lucide-react';

const Y = '#F5C10E';
const D = '#0F172A';

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function COGSBreakdown() {
  const navigate = useNavigate();
  const { inventory } = useInventory();
  const { salesData, menuItems } = useToast();
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  // ── Aggregate units sold per menu item across all days ─────────────────────
  const unitsSold: Record<string, number> = {};
  salesData.forEach(day => {
    day.topItems.forEach(item => {
      unitsSold[item.itemName] = (unitsSold[item.itemName] || 0) + item.quantity;
    });
  });

  // ── Cost per menu item + total COGS ────────────────────────────────────────
  const menuItemCosts = menuItems.map(mi => {
    const ingredientBreakdown = mi.ingredients.map(ing => {
      const invItem = inventory.find(i => i.id === ing.inventoryItemId);
      return {
        name:     invItem?.name     ?? 'Unknown',
        category: invItem?.category ?? 'Other',
        qty:      ing.quantity,
        unit:     invItem?.unit     ?? '',
        unitCost: invItem?.unitCost ?? 0,
        lineCost: ing.quantity * (invItem?.unitCost ?? 0),
      };
    });
    const costPerItem = ingredientBreakdown.reduce((s, i) => s + i.lineCost, 0);
    const sold        = unitsSold[mi.name] ?? 0;
    const totalCOGS   = costPerItem * sold;
    return { id: mi.id, name: mi.name, category: mi.category, costPerItem, sold, totalCOGS, ingredientBreakdown };
  });

  const totalCOGS   = menuItemCosts.reduce((s, i) => s + i.totalCOGS, 0);
  const totalRevenue = salesData.reduce((s, d) => s + d.revenue, 0);
  const cogsPercent  = totalRevenue > 0 ? (totalCOGS / totalRevenue) * 100 : 0;
  const totalCovers  = salesData.reduce((s, d) => s + d.covers, 0);
  const cogsPerCover = totalCovers > 0 ? totalCOGS / totalCovers : 0;

  // ── Group by menu category ─────────────────────────────────────────────────
  const categories = Object.values(
    menuItemCosts.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = { category: item.category, items: [], totalCOGS: 0 };
      acc[item.category].items.push(item);
      acc[item.category].totalCOGS += item.totalCOGS;
      return acc;
    }, {} as Record<string, { category: string; items: typeof menuItemCosts; totalCOGS: number }>)
  ).sort((a, b) => b.totalCOGS - a.totalCOGS);

  const hasSalesData = salesData.length > 0 && menuItems.length > 0;

  return (
    <div className="-mx-4 min-h-screen bg-[#F4F5F7]">

      {/* ── Page header ──────────────────────────────── */}
      <div className="bg-white px-4 pt-3 pb-5 border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm font-semibold text-gray-500 mb-3">
          <ChevronLeft className="w-4 h-4" />
          Dashboard
        </button>
        <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: D }}>COGS Breakdown</h1>
        <p className="text-xs text-gray-400 mt-0.5 font-semibold uppercase tracking-wider">
          Cost of Goods Sold · {salesData.length} day{salesData.length !== 1 ? 's' : ''} of data
        </p>

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { label: 'Total COGS',     value: `$${fmt(totalCOGS)}`,             Icon: DollarSign,  color: D },
            { label: '% of Revenue',   value: `${cogsPercent.toFixed(1)}%`,     Icon: TrendingDown,color: cogsPercent > 35 ? '#DC2626' : '#16A34A' },
            { label: 'Per Cover',      value: `$${cogsPerCover.toFixed(2)}`,    Icon: ShoppingBag, color: D },
          ].map(({ label, value, Icon, color }) => (
            <div key={label} className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 text-center">
              <Icon className="w-4 h-4 mx-auto mb-1.5" style={{ color: Y }} />
              <p className="text-[13px] font-black leading-none" style={{ color, fontFamily: 'var(--font-mono)' }}>{value}</p>
              <p className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider mt-1">{label}</p>
            </div>
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
          <p className="text-sm text-gray-400">Connect Toast POS and configure menu items with ingredients to see cost breakdowns.</p>
        </div>
      )}

      {/* ── Category breakdown ───────────────────────── */}
      {hasSalesData && (
        <div className="px-4 py-4 space-y-3">
          {categories.map(cat => {
            const pct  = totalCOGS > 0 ? (cat.totalCOGS / totalCOGS) * 100 : 0;
            const open = expandedCat === cat.category;
            return (
              <div key={cat.category} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {/* Category header */}
                <button
                  className="w-full flex items-center gap-3 px-4 py-4 text-left"
                  onClick={() => setExpandedCat(open ? null : cat.category)}
                >
                  {/* Color dot */}
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: Y }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-[14px] font-bold" style={{ color: D }}>{cat.category}</p>
                      <p className="text-[14px] font-black ml-2 shrink-0" style={{ color: D, fontFamily: 'var(--font-mono)' }}>
                        ${fmt(cat.totalCOGS)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: Y }} />
                      </div>
                      <span className="text-[10px] text-gray-400 font-semibold shrink-0">{pct.toFixed(0)}%</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 font-medium">{cat.items.length} menu item{cat.items.length !== 1 ? 's' : ''}</p>
                  </div>
                  {open ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                </button>

                {/* Expanded: menu items */}
                {open && (
                  <div className="border-t border-gray-50">
                    {cat.items.sort((a, b) => b.totalCOGS - a.totalCOGS).map((item, idx) => (
                      <div key={item.id} className={`px-4 py-3 ${idx < cat.items.length - 1 ? 'border-b border-gray-50' : ''}`}>
                        {/* Menu item header */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <p className="text-[13px] font-bold text-gray-900 truncate">{item.name}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {item.sold} sold · ${fmt(item.costPerItem)}/item
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[14px] font-black" style={{ color: D, fontFamily: 'var(--font-mono)' }}>
                              ${fmt(item.totalCOGS)}
                            </p>
                            <p className="text-[10px] text-gray-400">total COGS</p>
                          </div>
                        </div>

                        {/* Ingredient breakdown */}
                        <div className="bg-gray-50 rounded-xl px-3 py-2.5 space-y-1.5">
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Ingredients</p>
                          {item.ingredientBreakdown.map((ing, i) => (
                            <div key={i} className="flex items-center justify-between text-[11px]">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                                <span className="text-gray-700 font-medium truncate">{ing.name}</span>
                                <span className="text-gray-400 shrink-0">{ing.qty} {ing.unit}</span>
                              </div>
                              <span className="font-bold text-gray-700 ml-2 shrink-0 tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
                                ${ing.lineCost.toFixed(3)}
                              </span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between pt-1.5 border-t border-gray-200 mt-1">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Cost per item</span>
                            <span className="text-[12px] font-black tabular-nums" style={{ color: D, fontFamily: 'var(--font-mono)' }}>
                              ${fmt(item.costPerItem)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Grand total */}
          <div className="rounded-2xl p-4 flex items-center justify-between" style={{ background: D }}>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total COGS</p>
              <p className="text-xs text-slate-500 mt-0.5">{salesData.length} day period</p>
            </div>
            <p className="text-2xl font-black text-white tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
              ${fmt(totalCOGS)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
