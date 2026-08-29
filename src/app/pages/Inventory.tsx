import { useMemo, useState } from 'react';
import { parseInventoryCountCsv, buildInventoryUpdates } from '../utils/inventoryImport';
import type { InventoryCount } from '../utils/inventoryCounts';
import { useNavigate } from 'react-router';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock3,
  DollarSign,
  Download,
  Filter,
  GitMerge,
  Package,
  Plus,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { useInventory } from '../contexts/InventoryContext';
import { useAuth } from '../contexts/AuthContext';
import {
  getLatestDraftInventoryCount,
  isInventoryCountFinalized,
  summarizeInventoryCount,
} from '../utils/inventoryCountWorkflow.js';

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
  const { user } = useAuth();
  const { inventory, inventoryCounts, addInventoryItem, updateInventoryItem, deleteInventoryCount, deleteInventoryItems, mergeInventoryItems } = useInventory();
  const canManageCounts = ['Owner', 'Admin', 'Manager', 'BOH Manager', 'FOH Manager'].includes(user?.role || '');
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
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [mergeTargetId, setMergeTargetId] = useState('');

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
  const selectedInventoryItems = inventory.filter(item => selectedItemIds.includes(item.id));
  const allFilteredSelected = filteredItems.length > 0 && filteredItems.every(item => selectedItemIds.includes(item.id));

  const toggleInventorySelection = (id: string, checked: boolean) => {
    setSelectedItemIds(current => checked ? Array.from(new Set([...current, id])) : current.filter(itemId => itemId !== id));
    if (checked && !mergeTargetId) setMergeTargetId(id);
    if (!checked && mergeTargetId === id) setMergeTargetId('');
  };

  const toggleAllInventorySelection = (checked: boolean) => {
    setSelectedItemIds(current => checked
      ? Array.from(new Set([...current, ...filteredItems.map(item => item.id)]))
      : current.filter(id => !filteredItems.some(item => item.id === id)));
    if (checked && !mergeTargetId) setMergeTargetId(filteredItems[0]?.id || '');
  };

  const handleBulkDelete = () => {
    if (!selectedItemIds.length || !window.confirm(`Delete ${selectedItemIds.length} selected inventory item${selectedItemIds.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
    deleteInventoryItems(selectedItemIds);
    setSelectedItemIds([]);
    setMergeTargetId('');
  };

  const handleMergeSelected = () => {
    const primaryId = mergeTargetId || selectedItemIds[0];
    if (selectedItemIds.length < 2 || !primaryId) return;
    const primary = inventory.find(item => item.id === primaryId);
    if (!window.confirm(`Merge ${selectedItemIds.length} selected items into “${primary?.name || 'the selected item'}”? On-hand stock, supplier options and history will be kept together.`)) return;
    const result = mergeInventoryItems(selectedItemIds, primaryId);
    if (!result.success) { window.alert(result.error || 'Those items could not be merged.'); return; }
    setSelectedItemIds([]);
    setMergeTargetId('');
  };

  const totalValue = inventory.reduce((sum, item) => sum + item.currentStock * item.unitCost, 0);
  const lowStockItems = inventory.filter(item => getStatus(item.currentStock, item.parLevel) === 'low-stock').length;
  const outItems = inventory.filter(item => getStatus(item.currentStock, item.parLevel) === 'out-of-stock').length;
  const wasteValue = inventory.reduce((sum, item) => sum + Math.max(0, item.currentStock - item.parLevel) * item.unitCost, 0);
  const countRows: InventoryCount[] = [...inventoryCounts].sort((left, right) => {
    const statusDifference = Number(isInventoryCountFinalized(left)) - Number(isInventoryCountFinalized(right));
    if (statusDifference !== 0) return statusDifference;
    const leftDate = new Date(left.updatedAt || left.finalizedAt || left.countDate).getTime();
    const rightDate = new Date(right.updatedAt || right.finalizedAt || right.countDate).getTime();
    return rightDate - leftDate;
  });
  const activeDraftCount = getLatestDraftInventoryCount(countRows);

  const selectedCountRow = countRows.find(row => row.id === selectedCountId) ?? null;
  const selectedCountSummary = summarizeInventoryCount(selectedCountRow);
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
    navigate(activeDraftCount ? `/app/inventory/counts/${activeDraftCount.id}` : '/app/inventory/counts/new');
  };

  const handleDeleteCount = (countId: string) => {
    const count = countRows.find(row => row.id === countId);
    if (!canManageCounts || !window.confirm(`Delete “${count?.description || 'this inventory count'}”? This cannot be recovered.`)) return;
    deleteInventoryCount(countId);
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
              {activeDraftCount ? <Clock3 className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
              {activeDraftCount ? 'Resume count' : 'Start count'}
            </button>
          </div>

          {activeDraftCount && (
            <button
              type="button"
              onClick={() => navigate(`/app/inventory/counts/${activeDraftCount.id}`)}
              className="mt-3 flex w-full flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-left sm:flex-row sm:items-center sm:justify-between"
            >
              <div><p className="text-sm font-black text-amber-950">Inventory count in progress</p><p className="mt-1 text-xs text-amber-800">{activeDraftCount.description} · {summarizeInventoryCount(activeDraftCount).completedItems}/{summarizeInventoryCount(activeDraftCount).totalItems} items counted</p></div>
              <span className="shrink-0 text-xs font-black text-amber-900 underline">Resume where you left off</span>
            </button>
          )}

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
            <div className="hidden grid-cols-[0.9fr_1.4fr_0.8fr_0.8fr_auto] bg-gray-50 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 sm:grid">
              <div>Status</div><div>Count</div><div className="text-right">Progress</div><div className="text-right">Value</div><div className="text-right">Actions</div>
            </div>
            <div className="divide-y divide-gray-100 bg-white">
              {countRows.map(row => {
                const isActive = selectedCountRow?.id === row.id;
                const finalized = isInventoryCountFinalized(row);
                const rowSummary = summarizeInventoryCount(row);
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
                    className={`grid w-full gap-3 px-4 py-4 text-left text-sm transition-colors sm:grid-cols-[0.9fr_1.4fr_0.8fr_0.8fr_auto] sm:items-center ${isActive ? 'bg-amber-50/70' : 'hover:bg-gray-50'}`}
                  >
                    <div><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black ${finalized ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>{finalized ? <CheckCircle2 className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}{finalized ? 'Finalized' : 'Draft'}</span></div>
                    <div className="min-w-0"><p className="break-words font-black text-gray-900">{row.description}</p><p className="mt-1 text-xs text-gray-500">{row.countDate}{finalized && row.finalizedBy ? ` · ${row.finalizedBy}` : ''}</p></div>
                    <div className="sm:text-right"><p className="font-black text-gray-800">{rowSummary.completedItems}/{rowSummary.totalItems}</p><p className="text-[10px] text-gray-500">{rowSummary.progressPercent.toFixed(0)}% counted</p></div>
                    <div className="font-semibold text-gray-700 sm:text-right" style={{ fontFamily: 'var(--font-mono)' }}>{fmtVal(rowSummary.countedValue)}</div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <button type="button" onClick={(event) => { event.stopPropagation(); setSelectedCountId(row.id); navigate(`/app/inventory/counts/${row.id}`); }} className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-bold text-gray-700">{finalized ? 'View' : 'Resume'}</button>
                      {canManageCounts && <button type="button" onClick={(event) => { event.stopPropagation(); handleDeleteCount(row.id); }} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-bold text-rose-700">Delete</button>}
                    </div>
                  </div>
                );
              })}
              {countRows.length === 0 && <div className="px-4 py-10 text-center"><p className="text-sm font-bold text-gray-700">No inventory counts yet</p><p className="mt-1 text-xs text-gray-500">Start a mobile count to establish an accurate inventory baseline.</p></div>}
            </div>
          </div>

          {selectedCountId && selectedCountRow && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="grid grid-cols-2 gap-2 border-b border-slate-100 bg-slate-50 p-3 sm:grid-cols-4">
                <CountDetail label="Expected" value={fmtVal(selectedCountSummary.expectedValue)} />
                <CountDetail label="Counted" value={fmtVal(selectedCountSummary.countedValue)} />
                <CountDetail label="Variance" value={`${selectedCountSummary.varianceValue > 0 ? '+' : ''}${fmtVal(selectedCountSummary.varianceValue)}`} warning={selectedCountSummary.varianceValue < 0} />
                <CountDetail label="Shortage" value={fmtVal(selectedCountSummary.lossValue)} warning={selectedCountSummary.lossValue > 0} />
              </div>
              <div className="divide-y divide-slate-100 md:hidden">
                {spreadsheetItems.map(item => {
                  const quantityVariance = item.counted - item.hypothetical;
                  const dollarVariance = quantityVariance * item.unitCost;
                  return (
                    <button key={item.itemId} type="button" onClick={() => navigate(`/app/inventory/${item.itemId}`)} className="w-full p-4 text-left">
                      <p className="break-words text-sm font-black leading-snug text-slate-900">{item.name}</p>
                      <p className="mt-1 break-words text-[11px] text-slate-500">{item.storageArea || 'Unassigned'} · {item.unit}</p>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs"><div><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Expected</p><p className="mt-1 font-black">{item.hypothetical.toFixed(2)}</p></div><div><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Counted</p><p className="mt-1 font-black">{item.counted.toFixed(2)}</p></div><div className="text-right"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Variance</p><p className={`mt-1 font-black ${dollarVariance < 0 ? 'text-rose-700' : dollarVariance > 0 ? 'text-emerald-700' : 'text-slate-600'}`}>{quantityVariance > 0 ? '+' : ''}{quantityVariance.toFixed(2)} · {dollarVariance > 0 ? '+' : ''}{fmtVal(dollarVariance)}</p></div></div>
                    </button>
                  );
                })}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <div className="min-w-[820px]">
                  <div className="grid grid-cols-[1.95fr_0.8fr_0.8fr_0.9fr_0.75fr_0.8fr] bg-white px-4 py-3 text-[10px] font-black uppercase tracking-[0.24em] text-gray-400">
                    <div>Inventory item / prep</div>
                    <div className="text-right">Previous</div>
                    <div className="text-right">Expected</div>
                    <div className="text-right">Counted</div>
                    <div className="text-right">Variance</div>
                    <div className="text-right">Value</div>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {spreadsheetItems.map(item => {
                      const variance = item.counted - item.hypothetical;
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
                              <p className="break-words text-sm font-semibold text-gray-900">{item.name}</p>
                              <p className="mt-0.5 break-words text-xs text-gray-500">{item.storageArea || 'Unassigned'} · {item.unit} · {statusMeta.label}</p>
                            </div>
                          </div>
                          <div className="text-right text-sm font-semibold text-gray-500">{Number(item.previousCounted ?? item.hypothetical).toFixed(2)}</div>
                          <div className="text-right text-sm font-semibold text-gray-500">{item.hypothetical.toFixed(2)}</div>
                          <div className="text-right text-sm font-semibold text-gray-900">{item.counted.toFixed(2)}</div>
                          <div className={`text-right text-sm font-semibold ${variance < 0 ? 'text-rose-600' : variance === 0 ? 'text-gray-600' : 'text-emerald-600'}`}>
                            {variance > 0 ? `+${variance.toFixed(2)}` : variance.toFixed(2)}
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
        <div className="flex items-center gap-3"><button type="button" onClick={() => toggleAllInventorySelection(!allFilteredSelected)} className="text-[11px] font-black text-slate-700 underline underline-offset-2">{allFilteredSelected ? 'Clear visible' : 'Select all visible'}</button><button className="flex items-center gap-1 text-[11px] font-bold text-gray-500"><SlidersHorizontal className="h-3 w-3" />Sort: A–Z</button></div>
      </div>

      {selectedItemIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-amber-100 bg-amber-50 px-4 py-3">
          <p className="mr-auto text-sm font-black text-slate-900">{selectedItemIds.length} selected</p>
          {selectedItemIds.length > 1 && (
            <>
              <label className="text-xs font-bold text-slate-600">Keep
                <select value={mergeTargetId || selectedItemIds[0]} onChange={event => setMergeTargetId(event.target.value)} className="ml-2 rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-900">
                  {selectedInventoryItems.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <button type="button" onClick={handleMergeSelected} className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-black text-slate-900"><GitMerge className="h-3.5 w-3.5" />Merge items</button>
            </>
          )}
          <button type="button" onClick={handleBulkDelete} className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2 text-xs font-black text-white"><Trash2 className="h-3.5 w-3.5" />Delete selected</button>
          <button type="button" onClick={() => { setSelectedItemIds([]); setMergeTargetId(''); }} className="px-2 py-2 text-xs font-bold text-slate-600 underline">Clear</button>
        </div>
      )}

      <div className="hidden grid-cols-[28px_minmax(180px,1fr)_64px_64px_80px_58px_18px] border-b border-gray-100 bg-gray-50 px-4 py-2 md:grid">
        <label className="flex items-center justify-center"><input aria-label="Select all visible inventory items" type="checkbox" checked={allFilteredSelected} onChange={event => toggleAllInventorySelection(event.target.checked)} className="h-4 w-4" /></label>
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
                className="grid cursor-pointer grid-cols-[28px_minmax(0,1fr)_18px] items-center px-4 py-3 transition-colors hover:bg-gray-50 md:grid-cols-[28px_minmax(180px,1fr)_64px_64px_80px_58px_18px]"
              >
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    aria-label={`Select ${item.name}`}
                    checked={selectedItemIds.includes(item.id)}
                    onChange={event => toggleInventorySelection(item.id, event.target.checked)}
                    className="h-4 w-4"
                    onClick={(event) => event.stopPropagation()}
                  />
                </div>
                <div className="flex min-w-0 items-center gap-2.5 pr-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-100 bg-white shadow-sm">
                    <Package className="h-[18px] w-[18px] text-gray-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="break-words text-[13px] font-bold leading-tight text-gray-900 md:truncate">{item.name}</p>
                    <p className="mt-0.5 break-words text-[10px] text-gray-400 md:truncate">{item.category} · {item.supplier}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5 md:hidden"><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">On hand {item.currentStock} {item.unit}</span><span className="rounded-full px-2 py-1 text-[10px] font-black" style={{ background: bg, color }}>{label}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">${item.unitCost.toFixed(2)} / {item.unit}</span></div>
                  </div>
                </div>
                <p className="hidden text-right text-[11px] text-gray-500 tabular-nums md:block">{item.parLevel} <span className="text-[10px] text-gray-400">{item.unit}</span></p>
                <p className="hidden text-right text-[11px] font-bold tabular-nums md:block" style={{ color: status === 'out-of-stock' ? '#DC2626' : status === 'low-stock' ? '#92400E' : '#374151' }}>
                  {item.currentStock} <span className="text-[10px] font-normal text-gray-400">{item.unit}</span>
                </p>
                <div className="hidden justify-end md:flex">
                  <span className="rounded-full px-2 py-1 text-[9px] font-black whitespace-nowrap" style={{ background: bg, color }}>
                    {label}
                  </span>
                </div>
                <p className="hidden text-right text-[11px] font-semibold text-gray-700 tabular-nums md:block" style={{ fontFamily: 'var(--font-mono)' }}>${item.unitCost.toFixed(2)}</p>
                <ChevronRight className="h-3.5 w-3.5 justify-self-end text-gray-300" />
              </div>
            );
          })
        )}
      </div>

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

function CountDetail({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return <div className="rounded-xl bg-white p-2"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p><p className={`mt-1 break-words text-sm font-black ${warning ? 'text-rose-700' : 'text-slate-800'}`}>{value}</p></div>;
}
