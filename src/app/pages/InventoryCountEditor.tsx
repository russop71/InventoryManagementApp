import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  Clock3,
  MapPin,
  Save,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useInventory } from '../contexts/InventoryContext';
import { createInventoryCount, type InventoryCount, type InventoryCountEntry } from '../utils/inventoryCounts';
import {
  getLatestFinalizedInventoryCount,
  isInventoryCountEntryComplete,
  isInventoryCountFinalized,
  summarizeInventoryCount,
} from '../utils/inventoryCountWorkflow.js';
import { convertQuantity, formatUnitLabel, getCompatibleUnits } from '../utils/unitConversion';

const Y = '#F5C10E';
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function formatCurrency(value: number) {
  return value.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
}

function entryStorageArea(entry: InventoryCountEntry) {
  return entry.storageArea?.trim() || 'Unassigned';
}

function entryKey(entry: InventoryCountEntry) {
  return entry.entryId || `${entry.itemId}::${entryStorageArea(entry)}`;
}

export function InventoryCountEditor() {
  const navigate = useNavigate();
  const { countId } = useParams();
  const { user } = useAuth();
  const {
    inventory,
    inventoryCounts,
    storageAreas,
    isLocationLoaded,
    saveInventoryCount,
    finalizeInventoryCount,
    deleteInventoryCount,
  } = useInventory();
  const initializedRoute = useRef('');

  const [draft, setDraft] = useState<InventoryCount | null>(null);
  const [description, setDescription] = useState('');
  const [countDate, setCountDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [countType, setCountType] = useState<'day-end' | 'day-start'>('day-end');
  const [search, setSearch] = useState('');
  const [storageFilter, setStorageFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [saveState, setSaveState] = useState('Not saved yet');
  const [countUnits, setCountUnits] = useState<Record<string, string>>({});
  const [countInputs, setCountInputs] = useState<Record<string, string>>({});
  const [extraItemId, setExtraItemId] = useState('');
  const [extraStorageArea, setExtraStorageArea] = useState('');

  const canFinalize = ['Owner', 'Admin', 'Manager', 'BOH Manager', 'FOH Manager'].includes(user?.role || '');
  const isFinalized = isInventoryCountFinalized(draft);

  useEffect(() => {
    if (!isLocationLoaded) return;
    const routeKey = countId || 'new';
    if (initializedRoute.current === routeKey) return;

    const existing = inventoryCounts.find(item => item.id === countId);
    const previousCount = getLatestFinalizedInventoryCount(inventoryCounts, existing?.id || '');
    const inventoryById = new Map(inventory.map(item => [item.id, item]));

    let nextCount: InventoryCount;
    if (countId && countId !== 'new' && existing) {
      const existingFinalized = isInventoryCountFinalized(existing);
      const previousEntries = new Map(previousCount?.entries?.map((entry: InventoryCountEntry) => [entryKey(entry), entry]) || []);
      nextCount = {
        ...existing,
        status: existingFinalized ? 'finalized' : 'draft',
        locked: existingFinalized ? 'Yes' : 'No',
        storageAreaOrder: existing.storageAreaOrder?.length
          ? existing.storageAreaOrder
          : previousCount?.storageAreaOrder?.length
            ? previousCount.storageAreaOrder
            : storageAreas,
        entries: existing.entries.map((entry, index) => {
          const item = inventoryById.get(entry.itemId);
          return {
            ...entry,
            entryId: entryKey(entry),
            storageArea: entry.storageArea || item?.storageArea || 'Unassigned',
            category: entry.category || item?.category || 'Other',
            supplier: entry.supplier || item?.supplier || 'Unknown',
            shelfOrder: entry.shelfOrder ?? item?.countOrder ?? index,
            previousCounted: entry.previousCounted ?? previousEntries.get(entryKey(entry))?.counted ?? entry.hypothetical,
            isCounted: entry.isCounted ?? existingFinalized,
          };
        }),
      };
      setSaveState(existingFinalized ? 'Finalized' : `Saved ${existing.updatedAt ? new Date(existing.updatedAt).toLocaleString('en-CA') : 'as draft'}`);
    } else {
      const inheritedAreaOrder = previousCount?.storageAreaOrder?.length
        ? previousCount.storageAreaOrder
        : storageAreas;
      nextCount = createInventoryCount(inventory, {
        id: `count-${Date.now()}`,
        countDate: new Date().toISOString().slice(0, 10),
        description: 'New inventory count',
        status: 'draft',
        storageAreaOrder: inheritedAreaOrder,
      }, previousCount);
    }

    setDraft(nextCount);
    setDescription(nextCount.description);
    setCountDate(ISO_DATE_PATTERN.test(nextCount.countDate) ? nextCount.countDate : new Date().toISOString().slice(0, 10));
    setCountType(nextCount.countType === 'day-start' ? 'day-start' : 'day-end');
    initializedRoute.current = routeKey;
  }, [countId, inventory, inventoryCounts, isLocationLoaded, storageAreas]);

  const itemMeta = useMemo(() => new Map(inventory.map(item => [item.id, item])), [inventory]);
  const summary = useMemo(() => summarizeInventoryCount(draft), [draft]);

  const storageOptions = useMemo(() => {
    if (!draft) return ['all'];
    const values = new Set(draft.entries.map(entryStorageArea));
    const preferredOrder = draft.storageAreaOrder || [];
    return ['all', ...Array.from(values).sort((left, right) => {
      const leftIndex = preferredOrder.indexOf(left);
      const rightIndex = preferredOrder.indexOf(right);
      if (leftIndex >= 0 || rightIndex >= 0) return (leftIndex < 0 ? 999 : leftIndex) - (rightIndex < 0 ? 999 : rightIndex);
      return left.localeCompare(right);
    })];
  }, [draft]);

  const groupOptions = useMemo(() => {
    const values = new Set(draft?.entries.map(entry => entry.category || itemMeta.get(entry.itemId)?.category || 'Other') || []);
    return ['all', ...Array.from(values).sort((a, b) => a.localeCompare(b))];
  }, [draft, itemMeta]);

  const supplierOptions = useMemo(() => {
    const values = new Set(draft?.entries.map(entry => entry.supplier || itemMeta.get(entry.itemId)?.supplier || 'Unknown') || []);
    return ['all', ...Array.from(values).sort((a, b) => a.localeCompare(b))];
  }, [draft, itemMeta]);

  const areaGroups = useMemo(() => {
    if (!draft) return [];
    const query = search.trim().toLowerCase();
    const preferredAreas = draft.storageAreaOrder || [];
    const filtered = draft.entries.filter(entry => {
      const meta = itemMeta.get(entry.itemId);
      const area = entryStorageArea(entry);
      const category = entry.category || meta?.category || 'Other';
      const supplier = entry.supplier || meta?.supplier || 'Unknown';
      return (!query || `${entry.name} ${category} ${supplier}`.toLowerCase().includes(query))
        && (storageFilter === 'all' || area === storageFilter)
        && (groupFilter === 'all' || category === groupFilter)
        && (supplierFilter === 'all' || supplier === supplierFilter);
    });
    const areas = Array.from(new Set(filtered.map(entryStorageArea))).sort((left, right) => {
      const leftIndex = preferredAreas.indexOf(left);
      const rightIndex = preferredAreas.indexOf(right);
      if (leftIndex >= 0 || rightIndex >= 0) return (leftIndex < 0 ? 999 : leftIndex) - (rightIndex < 0 ? 999 : rightIndex);
      return left.localeCompare(right);
    });

    return areas.map(area => ({
      area,
      entries: filtered
        .filter(entry => entryStorageArea(entry) === area)
        .sort((left, right) => (left.shelfOrder ?? 999) - (right.shelfOrder ?? 999) || left.name.localeCompare(right.name)),
    }));
  }, [draft, groupFilter, itemMeta, search, storageFilter, supplierFilter]);

  const countUnitFor = (entry: InventoryCountEntry) => countUnits[entryKey(entry)] || entry.unit;
  const countInputFor = (entry: InventoryCountEntry, complete: boolean) => {
    if (countInputs[entryKey(entry)] !== undefined) return countInputs[entryKey(entry)];
    if (!complete) return '';
    const converted = convertQuantity(entry.counted, entry.unit, countUnitFor(entry));
    return converted === null ? String(entry.counted) : String(Number(converted.toFixed(4)));
  };
  const changeCountUnit = (entry: InventoryCountEntry, unit: string) => {
    setCountUnits(current => ({ ...current, [entryKey(entry)]: unit }));
    if (countInputs[entryKey(entry)] !== undefined || !draft || !isInventoryCountEntryComplete(entry, draft)) return;
    const converted = convertQuantity(entry.counted, entry.unit, unit);
    setCountInputs(current => ({ ...current, [entryKey(entry)]: converted === null ? String(entry.counted) : String(Number(converted.toFixed(4))) }));
  };
  const updateEntry = (lineId: string, rawValue: string, inputUnit?: string) => {
    if (isFinalized) return;
    setCountInputs(current => ({ ...current, [lineId]: rawValue }));
    setDraft(current => {
      if (!current) return current;
      const isCounted = rawValue.trim() !== '';
      return {
        ...current,
        entries: current.entries.map(entry => {
          if (entryKey(entry) !== lineId) return entry;
          const entered = Math.max(0, Number(rawValue) || 0);
          const converted = inputUnit ? convertQuantity(entered, inputUnit, entry.unit) : entered;
          const counted = isCounted ? Math.max(0, converted ?? entered) : 0;
          return { ...entry, counted, isCounted, value: counted * entry.unitCost };
        }),
      };
    });
    setSaveState('Unsaved changes');
  };

  const moveEntry = (area: string, lineId: string, direction: -1 | 1) => {
    if (!draft || isFinalized) return;
    const areaEntries = draft.entries
      .filter(entry => entryStorageArea(entry) === area)
      .sort((left, right) => (left.shelfOrder ?? 999) - (right.shelfOrder ?? 999) || left.name.localeCompare(right.name));
    const currentIndex = areaEntries.findIndex(entry => entryKey(entry) === lineId);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= areaEntries.length) return;
    const currentItem = areaEntries[currentIndex];
    const targetItem = areaEntries[targetIndex];
    const currentOrder = currentItem.shelfOrder ?? currentIndex;
    const targetOrder = targetItem.shelfOrder ?? targetIndex;
    setDraft(current => current ? {
      ...current,
      entries: current.entries.map(entry => entryKey(entry) === entryKey(currentItem)
        ? { ...entry, shelfOrder: targetOrder }
        : entryKey(entry) === entryKey(targetItem)
          ? { ...entry, shelfOrder: currentOrder }
          : entry),
    } : current);
    setSaveState('Unsaved changes');
  };

  const addStorageAreaLine = () => {
    if (!draft || isFinalized || !extraItemId || !extraStorageArea) return;
    const source = draft.entries.find(entry => entry.itemId === extraItemId);
    const lineId = `${extraItemId}::${extraStorageArea}`;
    if (!source || draft.entries.some(entry => entryKey(entry) === lineId)) return toast.error('That item already has a count line in this storage area.');
    setDraft(current => current ? { ...current, storageAreaOrder: Array.from(new Set([...(current.storageAreaOrder || []), extraStorageArea])), entries: [...current.entries, { ...source, entryId: lineId, storageArea: extraStorageArea, hypothetical: 0, previousCounted: 0, counted: 0, value: 0, isCounted: false, shelfOrder: 999 }] } : current);
    setExtraItemId('');
    setExtraStorageArea('');
    setSaveState('Unsaved changes');
    toast.success(`Added a separate ${extraStorageArea} count line.`);
  };

  const moveArea = (area: string, direction: -1 | 1) => {
    if (!draft || isFinalized) return;
    const currentOrder = [...(draft.storageAreaOrder || storageOptions.filter(option => option !== 'all'))];
    const currentIndex = currentOrder.indexOf(area);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= currentOrder.length) return;
    [currentOrder[currentIndex], currentOrder[targetIndex]] = [currentOrder[targetIndex], currentOrder[currentIndex]];
    setDraft(current => current ? { ...current, storageAreaOrder: currentOrder } : current);
    setSaveState('Unsaved changes');
  };

  const preparedCount = (status: 'draft' | 'finalized'): InventoryCount | null => {
    if (!draft) return null;
    const now = new Date().toISOString();
    const entries = draft.entries.map(entry => ({
      ...entry,
      value: entry.counted * entry.unitCost,
      status: entry.counted <= 0 ? 'out-of-stock' as const : entry.counted < entry.parLevel * 0.5 ? 'low-stock' as const : 'in-stock' as const,
    }));
    return {
      ...draft,
      countDate: countDate || new Date().toISOString().slice(0, 10),
      countType,
      description: description.trim() || `Inventory count ${countDate || new Date().toISOString().slice(0, 10)}`,
      status,
      locked: status === 'finalized' ? 'Yes' : 'No',
      updatedAt: now,
      finalizedAt: status === 'finalized' ? now : undefined,
      finalizedBy: status === 'finalized' ? user?.name || user?.email || 'Manager' : undefined,
      finalizedByRole: status === 'finalized' ? user?.role : undefined,
      entries,
      value: entries.filter(entry => entry.isCounted).reduce((sum, entry) => sum + entry.value, 0),
    };
  };

  const handleSaveDraft = (exitAfterSave = false) => {
    if (isFinalized) {
      navigate('/app/inventory');
      return;
    }
    const nextCount = preparedCount('draft');
    if (!nextCount) return;
    saveInventoryCount(nextCount);
    setDraft(nextCount);
    setSaveState(`Saved ${new Date(nextCount.updatedAt || '').toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })}`);
    toast.success('Inventory count saved as a draft');
    if (exitAfterSave) navigate('/app/inventory');
  };

  const handleFinalize = () => {
    if (!draft || isFinalized) return;
    if (!canFinalize) {
      toast.error('An owner, admin, or manager must finalize this count.');
      return;
    }
    if (summary.remainingItems > 0) {
      toast.error(`Count the remaining ${summary.remainingItems} item${summary.remainingItems === 1 ? '' : 's'} before finalizing.`);
      return;
    }
    const confirmed = window.confirm(`Finalize this inventory count as ${user?.name || user?.role}? This will update live on-hand inventory and lock the count.`);
    if (!confirmed) return;
    const nextCount = preparedCount('finalized');
    if (!nextCount) return;
    finalizeInventoryCount(nextCount);
    toast.success('Inventory count finalized and on-hand inventory updated');
    navigate('/app/inventory');
  };

  const handleDelete = () => {
    if (!draft || !canFinalize) return;
    if (!window.confirm(`Delete “${draft.description}”? This count cannot be recovered.`)) return;
    deleteInventoryCount(draft.id);
    toast.success('Inventory count deleted');
    navigate('/app/inventory');
  };

  if (!draft) return null;

  return (
    <div className="-mx-4 min-h-screen bg-[#F7F8FA] px-3 py-3 sm:px-5 sm:py-5">
      <div className="mx-auto max-w-6xl space-y-4">
        <section className="overflow-hidden rounded-[28px] bg-[#0B1220] text-white shadow-sm">
          <div className="h-1" style={{ background: Y }} />
          <div className="p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-[#F5C10E]">
                  {isFinalized ? <ShieldCheck className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                  {isFinalized ? 'Finalized count' : 'Count in progress'}
                </div>
                <h1 className="mt-2 break-words text-2xl font-black tracking-tight sm:text-3xl">{description || 'Inventory count'}</h1>
                <p className="mt-2 text-xs text-white/50">
                  {isFinalized
                    ? `Locked by ${draft.finalizedBy || 'a manager'}${draft.finalizedAt ? ` · ${new Date(draft.finalizedAt).toLocaleString('en-CA')}` : ''}`
                    : `${summary.completedItems} of ${summary.totalItems} items counted · ${saveState}`}
                </p>
              </div>
              <button type="button" onClick={() => isFinalized ? navigate('/app/inventory') : handleSaveDraft(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm font-bold text-white">
                <ArrowLeft className="h-4 w-4" />
                {isFinalized ? 'Back' : 'Save & exit'}
              </button>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#F5C10E] transition-all" style={{ width: `${summary.progressPercent}%` }} />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <SummaryCard label="Progress" value={`${summary.progressPercent.toFixed(0)}%`} detail={`${summary.remainingItems} remaining`} />
          <SummaryCard label="Expected value" value={formatCurrency(summary.expectedValue)} detail="Theoretical on hand" />
          <SummaryCard label="Counted value" value={formatCurrency(summary.countedValue)} detail="Completed lines" />
          <SummaryCard label="Dollar variance" value={`${summary.varianceValue > 0 ? '+' : ''}${formatCurrency(summary.varianceValue)}`} detail={summary.lossValue > 0 ? `${formatCurrency(summary.lossValue)} shortage` : 'No shortage recorded'} warning={summary.varianceValue < 0} />
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-xs font-bold text-slate-700">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">Description</span>
              <input disabled={isFinalized} value={description} onChange={event => { setDescription(event.target.value); setSaveState('Unsaved changes'); }} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm disabled:bg-slate-50" />
            </label>
            <label className="text-xs font-bold text-slate-700">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">Count date</span>
              <input disabled={isFinalized} type="date" value={countDate} onChange={event => { setCountDate(event.target.value); setSaveState('Unsaved changes'); }} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm disabled:bg-slate-50" />
            </label>
            <label className="text-xs font-bold text-slate-700">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">Count type</span>
              <select disabled={isFinalized} value={countType} onChange={event => { setCountType(event.target.value === 'day-start' ? 'day-start' : 'day-end'); setSaveState('Unsaved changes'); }} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm disabled:bg-slate-50">
                <option value="day-end">Day end</option>
                <option value="day-start">Day start</option>
              </select>
            </label>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search inventory…" className="h-11 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm" />
            </label>
            <FilterSelect value={storageFilter} onChange={setStorageFilter} options={storageOptions} allLabel="All storage areas" />
            <FilterSelect value={groupFilter} onChange={setGroupFilter} options={groupOptions} allLabel="All categories" />
            <FilterSelect value={supplierFilter} onChange={setSupplierFilter} options={supplierOptions} allLabel="All suppliers" />
          </div>
          {!isFinalized && <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-3"><p className="text-xs font-black text-amber-950">Count the same item in another storage area</p><p className="mt-1 text-[11px] leading-4 text-amber-800">Add a second line for a cooler, bar, station, or cellar. ZestIQ totals the lines when you finalize.</p><div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><select value={extraItemId} onChange={event => setExtraItemId(event.target.value)} className="h-10 rounded-xl border border-amber-200 bg-white px-3 text-sm"><option value="">Choose an item…</option>{inventory.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={extraStorageArea} onChange={event => setExtraStorageArea(event.target.value)} className="h-10 rounded-xl border border-amber-200 bg-white px-3 text-sm"><option value="">Choose a storage area…</option>{storageAreas.map(area => <option key={area} value={area}>{area}</option>)}</select><button type="button" onClick={addStorageAreaLine} disabled={!extraItemId || !extraStorageArea} className="h-10 rounded-xl bg-[#0B1220] px-4 text-sm font-black text-white disabled:opacity-40">Add count line</button></div></div>}
        </section>

        {areaGroups.map(({ area, entries }, areaIndex) => {
          const completedInArea = entries.filter(entry => isInventoryCountEntryComplete(entry, draft)).length;
          return (
            <section key={area} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0 text-[#B58B00]" /><h2 className="break-words font-black text-slate-900">{area}</h2></div>
                  <p className="mt-1 text-[11px] text-slate-500">Shelf order · {completedInArea}/{entries.length} counted</p>
                </div>
                {!isFinalized && storageFilter === 'all' && (
                  <div className="flex shrink-0 gap-1">
                    <OrderButton label={`Move ${area} up`} disabled={areaIndex === 0} onClick={() => moveArea(area, -1)} icon="up" />
                    <OrderButton label={`Move ${area} down`} disabled={areaIndex === areaGroups.length - 1} onClick={() => moveArea(area, 1)} icon="down" />
                  </div>
                )}
              </div>

              <div className="divide-y divide-slate-100 md:hidden">
                {entries.map((entry, index) => (
                  <MobileCountRow
                    key={entryKey(entry)}
                    entry={entry}
                    count={draft}
                    readOnly={isFinalized}
                    onChange={value => updateEntry(entryKey(entry), value, countUnitFor(entry))}
                    unit={countUnitFor(entry)}
                    units={getCompatibleUnits(entry.unit)}
                    value={countInputFor(entry, isInventoryCountEntryComplete(entry, draft))}
                    onUnitChange={unit => changeCountUnit(entry, unit)}
                    onMoveUp={() => moveEntry(area, entryKey(entry), -1)}
                    onMoveDown={() => moveEntry(area, entryKey(entry), 1)}
                    disableMoveUp={index === 0}
                    disableMoveDown={index === entries.length - 1}
                  />
                ))}
              </div>

              <div className="hidden md:block">
                <div className="grid grid-cols-[minmax(220px,1.7fr)_0.8fr_0.8fr_0.9fr_0.9fr_72px] gap-3 bg-white px-4 py-3 text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                  <div>Inventory item</div><div className="text-right">Previous</div><div className="text-right">Expected</div><div className="text-right">Actual count</div><div className="text-right">Variance</div><div className="text-right">Order</div>
                </div>
                <div className="divide-y divide-slate-100">
                  {entries.map((entry, index) => {
                    const complete = isInventoryCountEntryComplete(entry, draft);
                    const quantityVariance = complete ? entry.counted - entry.hypothetical : 0;
                    const dollarVariance = quantityVariance * entry.unitCost;
                    return (
                      <div key={entryKey(entry)} className={`grid grid-cols-[minmax(220px,1.7fr)_0.8fr_0.8fr_0.9fr_0.9fr_72px] items-center gap-3 px-4 py-3 ${complete ? '' : 'bg-amber-50/20'}`}>
                        <div className="min-w-0"><p className="break-words text-sm font-black text-slate-900">{entry.name}</p><p className="mt-1 break-words text-[11px] text-slate-500">{entry.category || 'Other'} · {entry.supplier || 'Unknown'} · {entry.unit}</p></div>
                        <div className="text-right text-sm font-semibold text-slate-500">{Number(entry.previousCounted ?? entry.hypothetical).toFixed(2)}</div>
                        <div className="text-right text-sm font-semibold text-slate-700">{entry.hypothetical.toFixed(2)}</div>
                        <div className="text-right">
                          {isFinalized ? <span className="text-sm font-black text-slate-900">{entry.counted.toFixed(2)} {entry.unit}</span> : <div className="flex min-w-[150px] gap-1"><input aria-label={`Count ${entry.name}`} type="number" min="0" step="0.01" value={countInputFor(entry, complete)} onChange={event => updateEntry(entryKey(entry), event.target.value, countUnitFor(entry))} className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-right text-base font-black text-slate-900 focus:border-[#D9A900] focus:outline-none focus:ring-2 focus:ring-amber-100" /><select aria-label={`Count unit for ${entry.name}`} value={countUnitFor(entry)} onChange={event => changeCountUnit(entry, event.target.value)} className="h-10 max-w-[72px] rounded-xl border border-slate-200 bg-white px-1 text-xs font-bold">{getCompatibleUnits(entry.unit).map(unit => <option key={unit.value} value={unit.value}>{unit.label}</option>)}</select></div>}
                        </div>
                        <div className={`text-right text-sm font-black ${!complete ? 'text-slate-300' : dollarVariance < 0 ? 'text-rose-600' : dollarVariance > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>{complete ? <><span className="block">{quantityVariance > 0 ? '+' : ''}{quantityVariance.toFixed(2)} {entry.unit}</span><span className="text-[10px]">{dollarVariance > 0 ? '+' : ''}{formatCurrency(dollarVariance)}</span></> : 'Not counted'}</div>
                        <div className="flex justify-end gap-1">{!isFinalized && <><OrderButton label={`Move ${entry.name} up`} disabled={index === 0} onClick={() => moveEntry(area, entryKey(entry), -1)} icon="up" /><OrderButton label={`Move ${entry.name} down`} disabled={index === entries.length - 1} onClick={() => moveEntry(area, entryKey(entry), 1)} icon="down" /></>}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })}

        {areaGroups.length === 0 && <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center"><p className="font-black text-slate-700">No inventory items match these filters.</p><button type="button" onClick={() => { setSearch(''); setStorageFilter('all'); setGroupFilter('all'); setSupplierFilter('all'); }} className="mt-3 text-sm font-bold text-[#9A7600] underline">Clear filters</button></div>}

        <section className="sticky bottom-20 z-20 rounded-3xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur sm:bottom-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-500">
              {isFinalized ? <span className="font-bold text-emerald-700">This count is locked and included in inventory history.</span> : canFinalize ? <span><strong className="text-slate-900">Manager confirmation:</strong> all {summary.totalItems} items must be counted before inventory is updated.</span> : <span><strong className="text-slate-900">Draft mode:</strong> a manager must review and finalize this count.</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              {canFinalize && <button type="button" onClick={handleDelete} className="inline-flex h-11 items-center justify-center rounded-xl border border-rose-200 px-3 text-sm font-bold text-rose-700"><Trash2 className="mr-2 h-4 w-4" />Delete</button>}
              {!isFinalized && <button type="button" onClick={() => handleSaveDraft(false)} className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-800 sm:flex-none"><Save className="mr-2 h-4 w-4" />Save draft</button>}
              {!isFinalized && <button type="button" onClick={handleFinalize} disabled={!canFinalize || summary.remainingItems > 0} className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-[#0B1220] px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"><CheckCircle2 className="mr-2 h-4 w-4 text-[#F5C10E]" />Finalize count</button>}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, detail, warning = false }: { label: string; value: string; detail: string; warning?: boolean }) {
  return <div className={`rounded-2xl border bg-white p-3 shadow-sm ${warning ? 'border-rose-200' : 'border-slate-200'}`}><p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p><p className={`mt-1 break-words text-lg font-black ${warning ? 'text-rose-700' : 'text-slate-900'}`}>{value}</p><p className="mt-1 text-[10px] text-slate-500">{detail}</p></div>;
}

function FilterSelect({ value, onChange, options, allLabel }: { value: string; onChange: (value: string) => void; options: string[]; allLabel: string }) {
  return <select value={value} onChange={event => onChange(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">{options.map(option => <option key={option} value={option}>{option === 'all' ? allLabel : option}</option>)}</select>;
}

function OrderButton({ label, disabled, onClick, icon }: { label: string; disabled: boolean; onClick: () => void; icon: 'up' | 'down' }) {
  return <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 disabled:opacity-25">{icon === 'up' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}</button>;
}

function MobileCountRow({ entry, count, readOnly, onChange, unit, units, value, onUnitChange, onMoveUp, onMoveDown, disableMoveUp, disableMoveDown }: { entry: InventoryCountEntry; count: InventoryCount; readOnly: boolean; onChange: (value: string) => void; unit: string; units: Array<{ value: string; label: string }>; value: string; onUnitChange: (unit: string) => void; onMoveUp: () => void; onMoveDown: () => void; disableMoveUp: boolean; disableMoveDown: boolean }) {
  const complete = isInventoryCountEntryComplete(entry, count);
  const quantityVariance = complete ? entry.counted - entry.hypothetical : 0;
  const dollarVariance = quantityVariance * entry.unitCost;
  return <div className={`p-4 ${complete ? 'bg-white' : 'bg-amber-50/20'}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1"><p className="break-words text-base font-black leading-snug text-slate-900">{entry.name}</p><p className="mt-1 break-words text-[11px] leading-5 text-slate-500">{entry.category || 'Other'} · {entry.supplier || 'Unknown'}</p></div>
      {!readOnly && <div className="flex shrink-0 gap-1"><OrderButton label={`Move ${entry.name} up`} disabled={disableMoveUp} onClick={onMoveUp} icon="up" /><OrderButton label={`Move ${entry.name} down`} disabled={disableMoveDown} onClick={onMoveDown} icon="down" /></div>}
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-slate-50 p-2"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Previous count</p><p className="mt-1 font-black text-slate-700">{Number(entry.previousCounted ?? entry.hypothetical).toFixed(2)} {entry.unit}</p></div><div className="rounded-xl bg-slate-50 p-2"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Expected now</p><p className="mt-1 font-black text-slate-700">{entry.hypothetical.toFixed(2)} {entry.unit}</p></div></div>
    <label className="mt-3 block"><span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Actual count</span>{readOnly ? <div className="mt-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xl font-black text-slate-900">{entry.counted.toFixed(2)} {entry.unit}</div> : <div className="mt-1 flex gap-2"><input aria-label={`Count ${entry.name}`} type="number" inputMode="decimal" min="0" step="0.01" value={value} onChange={event => onChange(event.target.value)} placeholder="Enter count" className="h-14 min-w-0 flex-1 rounded-xl border-2 border-slate-200 bg-white px-4 text-xl font-black text-slate-900 focus:border-[#D9A900] focus:outline-none focus:ring-2 focus:ring-amber-100" /><select aria-label={`Count unit for ${entry.name}`} value={unit} onChange={event => onUnitChange(event.target.value)} className="h-14 rounded-xl border-2 border-slate-200 bg-white px-2 text-sm font-black text-slate-700">{units.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>}</label>
    <div className={`mt-3 flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold ${!complete ? 'bg-slate-50 text-slate-400' : dollarVariance < 0 ? 'bg-rose-50 text-rose-700' : dollarVariance > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-600'}`}><span>{complete ? 'Variance' : 'Waiting for count'}</span>{complete && <span>{quantityVariance > 0 ? '+' : ''}{quantityVariance.toFixed(2)} {entry.unit} · {dollarVariance > 0 ? '+' : ''}{formatCurrency(dollarVariance)}</span>}</div>
  </div>;
}
