import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useInventory } from '../contexts/InventoryContext';
import { createInventoryCount, loadInventoryCounts, saveInventoryCounts, type InventoryCount } from '../utils/inventoryCounts';
import { convertQuantity, formatUnitLabel, getCompatibleUnits, normalizeUnit } from '../utils/unitConversion';

const Y = '#F5C10E';
const D = '#0F172A';
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function InventoryCountEditor() {
  const navigate = useNavigate();
  const { countId } = useParams();
  const { inventory } = useInventory();

  const [draft, setDraft] = useState<InventoryCount | null>(null);
  const [description, setDescription] = useState('');
  const [countDate, setCountDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [countType, setCountType] = useState<'day-end' | 'day-start'>('day-end');
  const [search, setSearch] = useState('');
  const [storageFilter, setStorageFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [unitSelections, setUnitSelections] = useState<Record<string, string[]>>({});

  const buildUnitSlots = (baseUnit: string, existing: string[] = []) => {
    const normalizedBase = normalizeUnit(baseUnit || 'ea');
    const compatible = getCompatibleUnits(normalizedBase).map(option => option.value);
    const merged = [
      ...existing.map(unit => normalizeUnit(unit)).filter(Boolean),
      normalizedBase,
      ...compatible,
    ];

    const unique: string[] = [];
    merged.forEach(unit => {
      if (!unique.includes(unit)) unique.push(unit);
    });

    while (unique.length < 4) {
      unique.push(normalizedBase);
    }

    return unique.slice(0, 4);
  };

  useEffect(() => {
    const counts = loadInventoryCounts();
    const existing = counts.find(item => item.id === countId);

    if (countId && countId !== 'new' && existing) {
      setDraft(existing);
      setDescription(existing.description);
      setCountDate(ISO_DATE_PATTERN.test(existing.countDate) ? existing.countDate : new Date().toISOString().slice(0, 10));
      setCountType(existing.countType === 'day-start' ? 'day-start' : 'day-end');
      setUnitSelections(
        Object.fromEntries(
          existing.entries.map(entry => [entry.itemId, buildUnitSlots(entry.unit, entry.unitOptions || [])]),
        ),
      );
      return;
    }

    const nextCount = createInventoryCount(inventory, {
      id: countId && countId !== 'new' ? countId : `count-${Date.now()}`,
      countDate: new Date().toISOString().slice(0, 10),
      description: 'New count',
      locked: 'Yes',
    });
    setDraft(nextCount);
    setDescription(nextCount.description);
    setCountDate(nextCount.countDate);
    setCountType(nextCount.countType === 'day-start' ? 'day-start' : 'day-end');
    setUnitSelections(
      Object.fromEntries(
        nextCount.entries.map(entry => [entry.itemId, buildUnitSlots(entry.unit, entry.unitOptions || [])]),
      ),
    );
  }, [countId, inventory]);

  const rows = useMemo(() => {
    if (!draft) return [];
    return draft.entries.map(entry => ({
      ...entry,
      usage: entry.hypothetical - entry.counted,
    }));
  }, [draft]);

  const usageSummary = useMemo(() => {
    const startingInventory = rows.reduce((sum, row) => sum + row.hypothetical, 0);
    const endingInventory = rows.reduce((sum, row) => sum + row.counted, 0);
    const usage = startingInventory - endingInventory;

    return {
      startingInventory,
      endingInventory,
      usage,
    };
  }, [rows]);

  const itemMeta = useMemo(() => {
    return new Map(inventory.map(item => [item.id, item]));
  }, [inventory]);

  const storageOptions = useMemo(() => {
    const values = new Set<string>();
    inventory.forEach(item => values.add((item.storageArea || 'Unassigned').trim() || 'Unassigned'));
    return ['all', ...Array.from(values).sort((a, b) => a.localeCompare(b))];
  }, [inventory]);

  const groupOptions = useMemo(() => {
    const values = new Set<string>();
    inventory.forEach(item => values.add((item.category || 'Other').trim() || 'Other'));
    return ['all', ...Array.from(values).sort((a, b) => a.localeCompare(b))];
  }, [inventory]);

  const supplierOptions = useMemo(() => {
    const values = new Set<string>();
    inventory.forEach(item => values.add((item.supplier || 'Unknown').trim() || 'Unknown'));
    return ['all', ...Array.from(values).sort((a, b) => a.localeCompare(b))];
  }, [inventory]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter(row => {
      const meta = itemMeta.get(row.itemId);
      const storageArea = (meta?.storageArea || 'Unassigned').trim() || 'Unassigned';
      const category = (meta?.category || 'Other').trim() || 'Other';
      const supplier = (meta?.supplier || 'Unknown').trim() || 'Unknown';

      const matchesSearch = !query || row.name.toLowerCase().includes(query);
      const matchesStorage = storageFilter === 'all' || storageArea === storageFilter;
      const matchesGroup = groupFilter === 'all' || category === groupFilter;
      const matchesSupplier = supplierFilter === 'all' || supplier === supplierFilter;

      return matchesSearch && matchesStorage && matchesGroup && matchesSupplier;
    });
  }, [groupFilter, itemMeta, rows, search, storageFilter, supplierFilter]);

  const updateEntry = (itemId: string, nextCount: number) => {
    if (!draft) return;
    setDraft(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        entries: prev.entries.map(entry => (entry.itemId === itemId ? { ...entry, counted: Math.max(0, nextCount) } : entry)),
      };
    });
  };

  const updateUnitOption = (itemId: string, slotIndex: number, nextUnit: string) => {
    setUnitSelections(prev => {
      const current = prev[itemId] || [];
      const next = [...current];
      next[slotIndex] = normalizeUnit(nextUnit);
      return { ...prev, [itemId]: next };
    });
  };

  const renderUnitAmount = (counted: number, baseUnit: string, displayUnit: string) => {
    const converted = convertQuantity(counted, baseUnit, displayUnit);
    if (converted === null) return '--';
    return `${converted.toFixed(2)} ${formatUnitLabel(displayUnit)}`;
  };

  const handleSave = () => {
    if (!draft) return;

    const nextCount: InventoryCount = {
      ...draft,
      countDate: countDate || new Date().toISOString().slice(0, 10),
      countType,
      description: description.trim() || `Count ${countDate || new Date().toISOString().slice(0, 10)}`,
      value: draft.entries.reduce((sum, entry) => sum + entry.value, 0),
      entries: draft.entries.map(entry => ({
        ...entry,
        unitOptions: unitSelections[entry.itemId] || buildUnitSlots(entry.unit, entry.unitOptions || []),
        value: entry.counted * entry.unitCost,
        status: entry.counted <= 0 ? 'out-of-stock' : entry.counted < entry.parLevel * 0.5 ? 'low-stock' : 'in-stock',
      })),
    };

    const counts = loadInventoryCounts();
    const nextCounts = countId && countId !== 'new'
      ? counts.map(item => (item.id === countId ? nextCount : item))
      : [nextCount, ...counts.filter(item => item.id !== nextCount.id)];

    saveInventoryCounts(nextCounts);
    window.dispatchEvent(new Event('inventory-counts-updated'));
    navigate('/app/inventory');
  };

  const handleDelete = () => {
    if (!draft) return;
    const counts = loadInventoryCounts().filter(item => item.id !== draft.id);
    saveInventoryCounts(counts);
    window.dispatchEvent(new Event('inventory-counts-updated'));
    navigate('/app/inventory');
  };

  if (!draft) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white px-4 py-4">
      <div className="mx-auto max-w-6xl rounded-[28px] border border-gray-200 bg-[#FCFCFD] p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
          <h1 className="text-lg font-black tracking-tight text-gray-900">Count</h1>
          <div className="flex gap-2">
            <button type="button" onClick={() => navigate('/app/inventory')} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700">
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            {draft.id !== 'current' && (
              <button type="button" onClick={handleDelete} className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-sm font-semibold text-rose-700">
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            )}
            <button type="button" onClick={handleSave} className="inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-semibold text-[#0F172A]" style={{ background: Y }}>
              <Plus className="h-4 w-4" />
              Save
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-2 rounded-lg border border-gray-200 bg-white p-3 md:grid-cols-[1.4fr_0.9fr_0.9fr]">
          <label className="text-xs font-semibold text-gray-700">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-gray-500">Description</span>
            <input value={description} onChange={event => setDescription(event.target.value)} placeholder="Count description" className="h-9 w-full rounded-md border border-gray-300 bg-white px-2.5 text-sm text-gray-800" />
          </label>
          <label className="text-xs font-semibold text-gray-700">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-gray-500">Date</span>
            <input type="date" value={countDate} onChange={event => setCountDate(event.target.value)} className="h-9 w-full rounded-md border border-gray-300 bg-white px-2.5 text-sm text-gray-800" />
          </label>
          <label className="text-xs font-semibold text-gray-700">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-gray-500">Type</span>
            <select value={countType} onChange={event => setCountType(event.target.value === 'day-start' ? 'day-start' : 'day-end')} className="h-9 w-full rounded-md border border-gray-300 bg-white px-2.5 text-sm text-gray-800">
              <option value="day-end">Day end</option>
              <option value="day-start">Day start</option>
            </select>
          </label>
        </div>

        <div className="mt-3 grid gap-2 rounded-lg border border-gray-200 bg-white p-3 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
          <label className="text-xs font-semibold text-gray-700">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-gray-500">Search</span>
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search"
              className="h-9 w-full rounded-md border border-gray-300 bg-white px-2.5 text-sm text-gray-800"
            />
          </label>
          <label className="text-xs font-semibold text-gray-700">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-gray-500">Storage areas</span>
            <select value={storageFilter} onChange={event => setStorageFilter(event.target.value)} className="h-9 w-full rounded-md border border-gray-300 bg-white px-2.5 text-sm text-gray-800">
              {storageOptions.map(option => (
                <option key={option} value={option}>{option === 'all' ? 'All storage areas' : option}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-gray-700">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-gray-500">Groups</span>
            <select value={groupFilter} onChange={event => setGroupFilter(event.target.value)} className="h-9 w-full rounded-md border border-gray-300 bg-white px-2.5 text-sm text-gray-800">
              {groupOptions.map(option => (
                <option key={option} value={option}>{option === 'all' ? 'All groups' : option}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-gray-700">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-gray-500">Suppliers</span>
            <select value={supplierFilter} onChange={event => setSupplierFilter(event.target.value)} className="h-9 w-full rounded-md border border-gray-300 bg-white px-2.5 text-sm text-gray-800">
              {supplierOptions.map(option => (
                <option key={option} value={option}>{option === 'all' ? 'All suppliers' : option}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-400">Starting inventory</p>
            <p className="mt-1 text-lg font-black text-gray-900">{usageSummary.startingInventory.toFixed(2)}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-400">Ending inventory</p>
            <p className="mt-1 text-lg font-black text-gray-900">{usageSummary.endingInventory.toFixed(2)}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-400">Usage</p>
            <p className="mt-1 text-lg font-black text-gray-900">{usageSummary.usage.toFixed(2)}</p>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <div className="min-w-[1220px]">
              <div className="grid grid-cols-[1.9fr_0.8fr_0.8fr_0.9fr_1fr_1fr_1fr_1fr_0.7fr] bg-gray-50 px-4 py-3 text-[10px] font-black uppercase tracking-[0.24em] text-gray-400">
            <div>Inventory item / preparation</div>
            <div className="text-right">Hypothetical</div>
            <div className="text-right">Actual count</div>
            <div className="text-right">Amount</div>
            <div className="text-right">Unit 1</div>
            <div className="text-right">Unit 2</div>
            <div className="text-right">Unit 3</div>
            <div className="text-right">Unit 4</div>
            <div className="text-right">Usage</div>
              </div>
              <div className="divide-y divide-gray-100">
            {filteredRows.map(entry => {
              const compatibleUnitOptions = getCompatibleUnits(entry.unit);
              const selectedUnits = buildUnitSlots(entry.unit, unitSelections[entry.itemId] || entry.unitOptions || []);

              return (
              <div key={entry.itemId} className="grid grid-cols-[1.9fr_0.8fr_0.8fr_0.9fr_1fr_1fr_1fr_1fr_0.7fr] items-center px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">{entry.name}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{entry.unit}</p>
                </div>
                <div className="text-right text-sm font-semibold text-gray-500">{entry.hypothetical.toFixed(2)}</div>
                <div className="text-right">
                  <input
                    type="number"
                    min="0"
                    value={entry.counted}
                    onChange={event => updateEntry(entry.itemId, Number(event.target.value))}
                    className="w-20 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-right text-sm font-semibold text-gray-900"
                  />
                </div>
                <div className="text-right text-sm font-semibold text-gray-700">{entry.counted.toFixed(2)} {entry.unit}</div>
                {[0, 1, 2, 3].map(slotIndex => (
                  <div key={`${entry.itemId}-unit-${slotIndex}`} className="text-right">
                    <select
                      value={selectedUnits[slotIndex] || normalizeUnit(entry.unit)}
                      onChange={event => updateUnitOption(entry.itemId, slotIndex, event.target.value)}
                      className="h-7 w-full rounded-md border border-gray-300 bg-white px-1.5 text-[11px] text-gray-700"
                    >
                      {compatibleUnitOptions.map(option => (
                        <option key={option.value} value={option.value}>{formatUnitLabel(option.value)}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-[11px] font-semibold text-gray-700">
                      {renderUnitAmount(entry.counted, entry.unit, selectedUnits[slotIndex] || normalizeUnit(entry.unit))}
                    </p>
                  </div>
                ))}
                <div className={`text-right text-sm font-semibold ${entry.usage < 0 ? 'text-rose-600' : entry.usage === 0 ? 'text-gray-600' : 'text-emerald-600'}`}>
                  {entry.usage > 0 ? `+${entry.usage.toFixed(2)}` : entry.usage.toFixed(2)}
                </div>
              </div>
            );
            })}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-gray-200 bg-white p-3 text-sm text-gray-600">
          Usage = Starting inventory - Ending inventory.
          <span className="ml-2 font-semibold text-gray-900">Usage total: {usageSummary.usage > 0 ? `+${usageSummary.usage.toFixed(2)}` : usageSummary.usage.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
