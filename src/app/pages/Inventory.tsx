import { useEffect, useMemo, useState } from 'react';
import { parseInventoryCountCsv, buildInventoryUpdates } from '../utils/inventoryImport';
import { createInventoryCount, loadInventoryCounts, saveInventoryCounts, type InventoryCount } from '../utils/inventoryCounts';
import { useNavigate } from 'react-router';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  DollarSign,
  Download,
  Filter,
  Package,
  Plus,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { useInventory } from '../contexts/InventoryContext';

const Y = '#F5C10E';
const D = '#0F172A';

type Status = 'in-stock' | 'low-stock' | 'out-of-stock';

function getStatus(current: number, par: number): Status {
  if (current <= 0) return 'out-of-stock';
  if (current < par * 0.5) return 'low-stock';
  return 'in-stock';
}

const STATUS: Record<Status, { label: string; bg: string; color: string }> = {
  'in-stock': { label: 'In Stock', bg: '#DCFCE7', color: '#166534' },
  'low-stock': { label: 'Low Stock', bg: '#FEF9C3', color: '#854D0E' },
  'out-of-stock': { label: 'Out of Stock', bg: '#FEE2E2', color: '#991B1B' },
};

export function Inventory() {
  const navigate = useNavigate();
  const { inventory, addInventoryItem, updateInventoryItem } = useInventory();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'low-stock' | 'out-of-stock'>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', category: '', supplier: '', unit: 'ea', parLevel: '10', currentStock: '0', unitCost: '0' });
  const [importError, setImportError] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<'last-month' | 'this-month' | 'last-7-days' | 'today' | 'custom'>('last-month');
  const [showRangeMenu, setShowRangeMenu] = useState(false);
  const [customStart, setCustomStart] = useState('2026-06-01');
  const [customEnd, setCustomEnd] = useState('2026-06-28');
  const [selectedCountId, setSelectedCountId] = useState('');
  const [showAddCountDialog, setShowAddCountDialog] = useState(false);
  const [newCountDescription, setNewCountDescription] = useState('');
  const [newCountDate, setNewCountDate] = useState(() => new Date().toISOString().slice(0, 10));

  const handleAddItem = () => {
    const trimmedName = newItem.name.trim();
    if (!trimmedName) return;

    addInventoryItem({
      name: trimmedName,
      category: newItem.category.trim() || 'General',
      supplier: newItem.supplier.trim() || 'Supplier',
      currentStock: Number(newItem.currentStock) || 0,
      parLevel: Number(newItem.parLevel) || 0,
      unit: newItem.unit.trim() || 'ea',
      unitCost: Number(newItem.unitCost) || 0,
      storageArea: 'Unassigned',
    });

    setNewItem({ name: '', category: '', supplier: '', unit: 'ea', parLevel: '10', currentStock: '0', unitCost: '0' });
    setShowAddDialog(false);
  };

  const handleImportCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const rows = parseInventoryCountCsv(text);
    if (rows.length === 0) {
      setImportError('No usable rows were found in the CSV.');
      return;
    }

    const updates = buildInventoryUpdates(inventory, rows);
    updates.forEach(entry => {
      updateInventoryItem(entry.id, entry.updates);
    });

    setImportError(null);
    event.target.value = '';
  };

  const handleExportCsv = () => {
    const rows = inventory.map(item => [item.name, item.currentStock, item.parLevel, item.unitCost, item.supplier, item.category].join(','));
    const blob = new Blob([['name,currentStock,parLevel,unitCost,supplier,category', ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'inventory-export.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return inventory.filter(item => {
      const matchesQuery = !query || `${item.name} ${item.category} ${item.supplier}`.toLowerCase().includes(query);
      const status = getStatus(item.currentStock, item.parLevel);
      const matchesTab = activeTab === 'all' ? true : activeTab === 'low-stock' ? status === 'low-stock' : status === 'out-of-stock';
      return matchesQuery && matchesTab;
    });
  }, [activeTab, inventory, search]);

  const totalValue = inventory.reduce((sum, item) => sum + item.currentStock * item.unitCost, 0);
  const lowStockItems = inventory.filter(item => getStatus(item.currentStock, item.parLevel) === 'low-stock').length;
  const outItems = inventory.filter(item => getStatus(item.currentStock, item.parLevel) === 'out-of-stock').length;
  const wasteValue = inventory.reduce((sum, item) => sum + Math.max(0, item.currentStock - item.parLevel) * item.unitCost, 0);
  const [countRows, setCountRows] = useState<InventoryCount[]>(() => loadInventoryCounts());

  useEffect(() => {
    const syncCounts = () => {
      const stored = loadInventoryCounts();
      if (stored.length > 0) {
        setCountRows(stored);
        return;
      }

      const initialCount = createInventoryCount(inventory, {
        id: 'current',
        countDate: 'Live inventory count',
        description: 'Current count',
        locked: 'Yes',
      });
      setCountRows([initialCount]);
      saveInventoryCounts([initialCount]);
    };

    syncCounts();
    window.addEventListener('inventory-counts-updated', syncCounts);
    return () => window.removeEventListener('inventory-counts-updated', syncCounts);
  }, [inventory]);

  const selectedCountRow = countRows.find(row => row.id === selectedCountId) ?? null;
  const spreadsheetItems = selectedCountRow?.entries?.length
    ? selectedCountRow.entries
    : filteredItems.map(item => ({
        id: item.id,
        itemId: item.id,
        name: item.name,
        hypothetical: item.currentStock,
        sales: 0,
        counted: item.currentStock,
        unit: item.unit,
        parLevel: item.parLevel,
        unitCost: item.unitCost,
        value: item.currentStock * item.unitCost,
        status: getStatus(item.currentStock, item.parLevel),
      }));
  const detailValue = spreadsheetItems.reduce((sum, item) => sum + item.value, 0);
  const detailCountedUnits = spreadsheetItems.reduce((sum, item) => sum + item.counted, 0);
  const detailParUnits = spreadsheetItems.reduce((sum, item) => sum + item.parLevel, 0);
  const detailVariance = detailCountedUnits - detailParUnits;
  const detailLowCountItems = spreadsheetItems.filter(item => item.status === 'low-stock').length;
  const detailOutCountItems = spreadsheetItems.filter(item => item.status === 'out-of-stock').length;

  const tabs = [
    { key: 'all', label: 'All Items', count: null as number | null },
    { key: 'low-stock', label: 'Low Stock', count: lowStockItems },
    { key: 'out-of-stock', label: 'Out of Stock', count: outItems },
  ] as const;

  const fmtVal = (value: number) => (value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${value.toFixed(0)}`);

  const rangeOptions = [
    { key: 'last-month', label: 'Last month', description: 'Review the previous 30 days' },
    { key: 'this-month', label: 'This month', description: 'Current month to date' },
    { key: 'last-7-days', label: 'Last 7 days', description: 'Recent activity snapshot' },
    { key: 'today', label: 'Today', description: 'Current day counts' },
    { key: 'custom', label: 'Custom range', description: 'Pick your own dates' },
  ] as const;

  const selectedRangeLabel = rangeOptions.find(option => option.key === selectedRange)?.label ?? 'Last month';

  const handleAddCount = () => {
    navigate('/app/inventory/counts/new');
  };

  const handleDeleteCount = (countId: string) => {
    const nextCounts = countRows.filter(row => row.id !== countId);
    setCountRows(nextCounts);
    saveInventoryCounts(nextCounts);
    if (selectedCountId === countId) {
      setSelectedCountId('');
    }
  };

  return (
    <div className="-mx-4 min-h-screen bg-white">
      <div className="px-4 pt-2 pb-5">
        <div className="rounded-[28px] border border-gray-200 bg-[#FCFCFD] p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-[24px] font-black tracking-tight" style={{ color: D }}>INVENTORY COUNTS</h1>
            </div>
            <button
              type="button"
              onClick={handleAddCount}
              className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-[#0F172A] shadow-sm"
              style={{ background: Y }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add count
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowRangeMenu(prev => !prev)}
                className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700"
              >
                {selectedRangeLabel}
                <ChevronDown className="h-4 w-4" />
              </button>
              {showRangeMenu && (
                <div className="absolute left-0 top-full z-20 mt-2 w-72 rounded-2xl border border-gray-200 bg-white p-2 shadow-xl">
                  {rangeOptions.map(option => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => {
                        setSelectedRange(option.key);
                        setShowRangeMenu(false);
                      }}
                      className="flex w-full flex-col items-start rounded-xl px-3 py-2 text-left transition-colors hover:bg-gray-50"
                    >
                      <span className="text-sm font-semibold text-gray-900">{option.label}</span>
                      <span className="text-xs text-gray-500">{option.description}</span>
                    </button>
                  ))}
                  {selectedRange === 'custom' && (
                    <div className="mt-2 grid gap-2 border-t border-gray-100 pt-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500">
                        From
                        <input
                          type="date"
                          value={customStart}
                          onChange={event => setCustomStart(event.target.value)}
                          className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                        />
                      </label>
                      <label className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500">
                        To
                        <input
                          type="date"
                          value={customEnd}
                          onChange={event => setCustomEnd(event.target.value)}
                          className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleExportCsv} className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm">
                <Download className="mr-2 h-4 w-4" style={{ color: Y }} />
                Export
              </button>
              <button className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm">
                <ClipboardList className="h-4 w-4" style={{ color: Y }} />
                Count view
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200">
            <div className="grid grid-cols-[1.4fr_0.8fr_1.2fr_0.6fr] bg-gray-50 px-4 py-3 text-[10px] font-black uppercase tracking-[0.24em] text-gray-400">
              <div>Count date</div>
              <div className="text-right">Value</div>
              <div>Description</div>
              <div className="text-right">Actions</div>
            </div>
            <div className="divide-y divide-gray-100 bg-white">
              {countRows.map(row => {
                const isActive = selectedCountRow?.id === row.id;
                return (
                  <div
                    key={row.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedCountId(current => (current === row.id ? '' : row.id))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedCountId(current => (current === row.id ? '' : row.id));
                      }
                    }}
                    className={`grid w-full grid-cols-[1.4fr_0.8fr_1.2fr_auto] items-center px-4 py-3 text-left text-sm transition-colors ${isActive ? 'bg-amber-50/70' : 'hover:bg-gray-50'}`}
                  >
                    <div className="font-semibold text-gray-900">{row.countDate}</div>
                    <div className="text-right font-semibold text-gray-700" style={{ fontFamily: 'var(--font-mono)' }}>{fmtVal(row.value)}</div>
                    <div className="text-gray-500">{row.description}</div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedCountId(row.id);
                          navigate(`/app/inventory/counts/${row.id}`);
                        }}
                        className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteCount(row.id);
                        }}
                        className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {selectedCountId && selectedCountRow && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <div className="min-w-[860px]">
                  <div className="grid grid-cols-[1.95fr_0.8fr_0.8fr_0.9fr_0.75fr_0.8fr] bg-white px-4 py-3 text-[10px] font-black uppercase tracking-[0.24em] text-gray-400">
                    <div>Inventory item / prep</div>
                    <div className="text-right">Hypothetical</div>
                    <div className="text-right">Actual count</div>
                    <div className="text-right">Amount</div>
                    <div className="text-right">Usage</div>
                    <div className="text-right">Value</div>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {spreadsheetItems.map(item => {
                      const usage = item.hypothetical - item.counted;
                      const statusMeta = STATUS[item.status];
                      return (
                        <button
                          key={item.itemId}
                          type="button"
                          onClick={() => navigate(`/app/inventory/${item.itemId}`)}
                          className="grid w-full grid-cols-[1.95fr_0.8fr_0.8fr_0.9fr_0.75fr_0.8fr] items-center px-4 py-3 text-left transition-colors hover:bg-gray-50"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-100 bg-gray-50">
                              <Package className="h-[18px] w-[18px] text-gray-400" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-gray-900">{item.name}</p>
                              <p className="mt-0.5 text-xs text-gray-500">{item.unit} · {statusMeta.label}</p>
                            </div>
                          </div>
                          <div className="text-right text-sm font-semibold text-gray-500">{item.hypothetical.toFixed(2)}</div>
                          <div className="text-right text-sm font-semibold text-gray-900">{item.counted.toFixed(2)}</div>
                          <div className="text-right text-sm font-semibold text-gray-700">{item.counted.toFixed(2)} {item.unit}</div>
                          <div className={`text-right text-sm font-semibold ${usage < 0 ? 'text-rose-600' : usage === 0 ? 'text-gray-600' : 'text-emerald-600'}`}>
                            {usage > 0 ? `+${usage.toFixed(2)}` : usage.toFixed(2)}
                          </div>
                          <div className="text-right text-sm font-semibold text-gray-700" style={{ fontFamily: 'var(--font-mono)' }}>{fmtVal(item.value)}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        <div className="mt-4">
          <p className="mb-2 text-[12px] font-black uppercase tracking-[0.28em] text-gray-500">Inventory</p>
        </div>
        <div className="mt-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search items..."
              className="h-10 w-full rounded-xl border-0 bg-gray-100 pl-9 pr-4 text-sm text-gray-800 placeholder:text-gray-400 outline-none"
            />
          </div>
          <button className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white shrink-0" aria-label="Filter">
            <Filter className="h-4 w-4 text-gray-600" />
          </button>
          <button onClick={() => setShowAddDialog(true)} className="flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-bold shrink-0" style={{ background: Y, color: D }}>
            <Plus className="h-4 w-4" />
            Add Item
          </button>
        </div>

      </div>

      <div className="border-b border-gray-100">
        <div className="flex items-center gap-1 overflow-x-auto px-4">
          {tabs.map(tab => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="relative flex items-center gap-1.5 py-3 px-3 text-[12px] font-bold whitespace-nowrap shrink-0 transition-colors"
                style={{ color: active ? D : '#9CA3AF' }}
              >
                {tab.label}
                {tab.count !== null && tab.count > 0 && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black" style={{ background: active ? Y : '#F3F4F6', color: active ? D : '#9CA3AF' }}>
                    {tab.count}
                  </span>
                )}
                {active && <span className="absolute bottom-0 left-3 right-3 h-[2.5px] rounded-full" style={{ background: Y }} />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-50">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}</p>
        <button className="flex items-center gap-1 text-[11px] font-bold text-gray-500">
          <SlidersHorizontal className="h-3 w-3" />
          Sort: A–Z
        </button>
      </div>

      <div className="grid px-4 py-2 bg-gray-50 border-b border-gray-100" style={{ gridTemplateColumns: '1fr 64px 64px 80px 58px 18px' }}>
        {(['ITEM', 'PAR LEVEL', 'ON HAND', 'STATUS', 'UNIT COST', ''] as const).map((header, index) => (
          <p key={header} className="text-[9px] font-black uppercase tracking-widest text-gray-400" style={{ textAlign: index === 0 ? 'left' : 'right' }}>
            {header}
          </p>
        ))}
      </div>

      <div className="divide-y divide-gray-50">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
              <Package className="h-7 w-7 text-gray-300" />
            </div>
            <p className="text-sm font-bold text-gray-500">No items found</p>
          </div>
        ) : (
          filteredItems.map(item => {
            const status = getStatus(item.currentStock, item.parLevel);
            const { label, bg, color } = STATUS[status];
            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/app/inventory/${item.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(`/app/inventory/${item.id}`);
                  }
                }}
                className="grid cursor-pointer items-center px-4 py-3 transition-colors hover:bg-gray-50"
                style={{ gridTemplateColumns: '28px 1fr 64px 64px 80px 58px 18px' }}
              >
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    onClick={(event) => event.stopPropagation()}
                  />
                </div>
                <div className="flex min-w-0 items-center gap-2.5 pr-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-100 bg-white shadow-sm">
                    <Package className="h-[18px] w-[18px] text-gray-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold leading-tight text-gray-900">{item.name}</p>
                    <p className="mt-0.5 truncate text-[10px] text-gray-400">{item.category} · {item.supplier}</p>
                  </div>
                </div>
                <p className="text-right text-[11px] text-gray-500 tabular-nums">{item.parLevel} <span className="text-[10px] text-gray-400">{item.unit}</span></p>
                <p className="text-right text-[11px] font-bold tabular-nums" style={{ color: status === 'out-of-stock' ? '#DC2626' : status === 'low-stock' ? '#92400E' : '#374151' }}>
                  {item.currentStock} <span className="text-[10px] font-normal text-gray-400">{item.unit}</span>
                </p>
                <div className="flex justify-end">
                  <span className="rounded-full px-2 py-1 text-[9px] font-black whitespace-nowrap" style={{ background: bg, color }}>
                    {label}
                  </span>
                </div>
                <p className="text-right text-[11px] font-semibold text-gray-700 tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>${item.unitCost.toFixed(2)}</p>
                <ChevronRight className="h-3.5 w-3.5 justify-self-end text-gray-300" />
              </div>
            );
          })
        )}
      </div>

      {showAddCountDialog && (
        <div className="mx-4 mb-4 rounded-3xl border border-gray-200 bg-gray-50 p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <input value={newCountDescription} onChange={event => setNewCountDescription(event.target.value)} placeholder="Count description" className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm" />
            <input type="date" value={newCountDate} onChange={event => setNewCountDate(event.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm" />
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={handleAddCount} className="rounded-xl bg-[#0F172A] px-4 py-2 text-sm font-semibold text-white">Save count</button>
            <button onClick={() => setShowAddCountDialog(false)} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700">Cancel</button>
          </div>
        </div>
      )}

      {showAddDialog && (
        <div className="mx-4 mb-4 rounded-3xl border border-gray-200 bg-gray-50 p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <input value={newItem.name} onChange={event => setNewItem(prev => ({ ...prev, name: event.target.value }))} placeholder="Item name" className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm" />
            <input value={newItem.category} onChange={event => setNewItem(prev => ({ ...prev, category: event.target.value }))} placeholder="Category" className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm" />
            <input value={newItem.supplier} onChange={event => setNewItem(prev => ({ ...prev, supplier: event.target.value }))} placeholder="Supplier" className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm" />
            <input value={newItem.unit} onChange={event => setNewItem(prev => ({ ...prev, unit: event.target.value }))} placeholder="Unit" className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm" />
            <input type="number" value={newItem.currentStock} onChange={event => setNewItem(prev => ({ ...prev, currentStock: event.target.value }))} placeholder="On hand" className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm" />
            <input type="number" value={newItem.parLevel} onChange={event => setNewItem(prev => ({ ...prev, parLevel: event.target.value }))} placeholder="Par level" className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm" />
            <input type="number" step="0.01" value={newItem.unitCost} onChange={event => setNewItem(prev => ({ ...prev, unitCost: event.target.value }))} placeholder="Unit cost" className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm" />
          </div>
          {importError && <p className="mt-2 text-sm text-red-600">{importError}</p>}
          <div className="mt-3 flex gap-2">
            <button onClick={handleAddItem} className="rounded-xl bg-[#0F172A] px-4 py-2 text-sm font-semibold text-white">Save item</button>
            <button onClick={() => setShowAddDialog(false)} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700">Cancel</button>
          </div>
        </div>
      )}

      <div className="mt-2 border-t border-gray-100 px-4 py-4">
        <div className="flex items-center justify-center rounded-2xl bg-[#0F172A] px-4 py-3 text-[12px] font-bold text-white shadow-sm">
          <ClipboardList className="mr-2 h-4 w-4" />
          Inventory
        </div>
      </div>
    </div>
  );
}
