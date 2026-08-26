import { useMemo, useState } from 'react';
import { BarChart3, CalendarDays, CircleDollarSign, ClipboardPlus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useInventory } from '../contexts/InventoryContext';
import { useLabor } from '../contexts/LaborContext';
import { useWaste } from '../contexts/WasteContext';
import { getCompatibleUnits, convertQuantity } from '../utils/unitConversion';
import { WASTE_REASONS, wasteByReason, wasteTotal } from '../utils/waste.js';

const todayKey = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${todayKey().slice(0, 8)}01`;

export function Waste() {
  const { inventory, refreshLocationData } = useInventory();
  const { employees } = useLabor();
  const { entries, recordWaste } = useWaste();
  const [itemSearch, setItemSearch] = useState('');
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [reason, setReason] = useState(WASTE_REASONS[0]);
  const [employeeName, setEmployeeName] = useState('');
  const [occurredAt, setOccurredAt] = useState(todayKey());
  const [notes, setNotes] = useState('');
  const [filter, setFilter] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedItem = inventory.find(item => item.id === itemId);
  const compatibleUnits = selectedItem ? getCompatibleUnits(selectedItem.unit) : [];
  const inventoryQty = selectedItem && quantity ? convertQuantity(Number(quantity), unit || selectedItem.unit, selectedItem.unit) : 0;
  const estimatedCost = selectedItem && inventoryQty !== null ? inventoryQty * selectedItem.unitCost : 0;
  const visibleInventory = inventory.filter(item => !item.inactive && item.name.toLowerCase().includes(itemSearch.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
  const visibleEntries = entries.filter(entry => `${entry.itemName} ${entry.reason} ${entry.employeeName}`.toLowerCase().includes(filter.toLowerCase()));
  const todayTotal = wasteTotal(entries, todayKey(), todayKey());
  const monthTotal = wasteTotal(entries, monthStart(), todayKey());
  const reasonTotals = wasteByReason(entries, monthStart(), todayKey());
  const maxReason = Math.max(1, ...reasonTotals.map(item => item.total));

  const topItem = useMemo(() => {
    const totals = new Map<string, number>();
    entries.filter(entry => entry.occurredAt.slice(0, 10) >= monthStart()).forEach(entry => totals.set(entry.itemName, (totals.get(entry.itemName) || 0) + entry.totalCost));
    return [...totals.entries()].sort((a, b) => b[1] - a[1])[0];
  }, [entries]);

  const selectItem = (value: string) => {
    setItemId(value);
    const item = inventory.find(candidate => candidate.id === value);
    setUnit(item ? getCompatibleUnits(item.unit)[0]?.value || item.unit : '');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedItem || Number(quantity) <= 0) { toast.error('Choose an item and enter a waste quantity'); return; }
    setSaving(true);
    try {
      const entry = await recordWaste({ itemId, quantity: Number(quantity), unit: unit || selectedItem.unit, reason, employeeName, occurredAt: `${occurredAt}T12:00:00`, notes });
      await refreshLocationData();
      toast.success(`${entry.itemName} waste logged and inventory updated`);
      setQuantity(''); setNotes('');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Waste could not be saved'); }
    finally { setSaving(false); }
  };

  return <div className="space-y-5">
    <section className="overflow-hidden rounded-3xl bg-[#0F172A] p-5 text-white shadow-lg">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F5C10E]">Waste control</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-black tracking-tight">Track every dollar lost.</h1><p className="mt-2 max-w-2xl text-sm text-slate-300">Log waste against real inventory, see the cost immediately and find the patterns to fix.</p></div><Trash2 className="h-10 w-10 text-[#F5C10E]" /></div>
    </section>

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[['Today', `$${todayTotal.toFixed(2)}`, CalendarDays], ['This month', `$${monthTotal.toFixed(2)}`, CircleDollarSign], ['Entries', String(entries.filter(entry => entry.occurredAt.slice(0, 10) >= monthStart()).length), ClipboardPlus], ['Top loss', topItem ? topItem[0] : 'None', BarChart3]].map(([label, value, Icon]) => <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><Icon className="h-5 w-5 text-[#B78C00]" /><p className="mt-3 text-[10px] font-black uppercase tracking-wider text-slate-400">{String(label)}</p><p className="mt-1 truncate text-xl font-black text-slate-900">{String(value)}</p></div>)}
    </div>

    <div className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
      <form onSubmit={submit} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black text-slate-900">Log waste</h2><p className="mt-1 text-sm text-slate-500">The saved amount is deducted from on-hand inventory.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className="text-xs font-black uppercase tracking-wider text-slate-500">Inventory item</span><div className="relative mt-2"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={itemSearch} onChange={e => setItemSearch(e.target.value)} placeholder="Search inventory…" className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm" /></div><select value={itemId} onChange={e => selectItem(e.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold"><option value="">Select an item…</option>{visibleInventory.map(item => <option key={item.id} value={item.id}>{item.name} · {item.currentStock} {item.unit}</option>)}</select></label>
          <label><span className="text-xs font-black uppercase tracking-wider text-slate-500">Quantity</span><input type="number" min="0" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0" className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-3 text-base" /></label>
          <label><span className="text-xs font-black uppercase tracking-wider text-slate-500">Unit</span><select value={unit} onChange={e => setUnit(e.target.value)} disabled={!selectedItem} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">{compatibleUnits.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label><span className="text-xs font-black uppercase tracking-wider text-slate-500">Reason</span><select value={reason} onChange={e => setReason(e.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">{WASTE_REASONS.map(item => <option key={item}>{item}</option>)}</select></label>
          <label><span className="text-xs font-black uppercase tracking-wider text-slate-500">Employee / manager</span><select value={employeeName} onChange={e => setEmployeeName(e.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Current user</option>{employees.filter(item => item.active).map(item => <option key={item.id} value={item.name}>{item.name} · {item.role}</option>)}</select></label>
          <label><span className="text-xs font-black uppercase tracking-wider text-slate-500">Date</span><input type="date" value={occurredAt} onChange={e => setOccurredAt(e.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-3 text-sm" /></label>
          <label><span className="text-xs font-black uppercase tracking-wider text-slate-500">Estimated value</span><div className="mt-2 flex h-12 items-center rounded-xl bg-amber-50 px-3 text-lg font-black text-amber-900">${estimatedCost.toFixed(2)}</div></label>
          <label className="sm:col-span-2"><span className="text-xs font-black uppercase tracking-wider text-slate-500">Notes</span><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="What happened?" className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm" /></label>
        </div>
        <button disabled={saving} className="mt-5 h-12 w-full rounded-xl bg-[#F5C10E] px-5 font-black text-[#0F172A] transition hover:bg-[#FFD229] disabled:opacity-50">{saving ? 'Saving…' : 'Log waste & update inventory'}</button>
      </form>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-black text-slate-900">Loss by reason</h2><p className="mt-1 text-sm text-slate-500">Current month</p><div className="mt-5 space-y-4">{reasonTotals.length ? reasonTotals.map(item => <div key={item.reason}><div className="flex justify-between gap-3 text-sm"><span className="font-bold text-slate-700">{item.reason}</span><span className="font-black text-slate-900">${item.total.toFixed(2)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#F5C10E]" style={{ width: `${Math.max(5, item.total / maxReason * 100)}%` }} /></div></div>) : <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No waste has been logged this month.</p>}</div></section>
    </div>

    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5"><div><h2 className="text-xl font-black text-slate-900">Waste log</h2><p className="mt-1 text-sm text-slate-500">Item, reason, team member and dollar value.</p></div><input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search waste…" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" /></div><div className="divide-y divide-slate-100">{visibleEntries.length ? visibleEntries.map(entry => <article key={entry.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><p className="font-black text-slate-900">{entry.itemName}</p><p className="mt-1 text-xs text-slate-500">{entry.reason} · {entry.quantity} {entry.unit} · {entry.employeeName || entry.loggedBy}</p>{entry.notes && <p className="mt-1 text-xs text-slate-400">{entry.notes}</p>}</div><p className="text-xs font-bold text-slate-500">{new Date(entry.occurredAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</p><p className="text-lg font-black text-rose-600">${entry.totalCost.toFixed(2)}</p></article>) : <p className="p-6 text-sm text-slate-500">No matching waste records.</p>}</div></section>
  </div>;
}
