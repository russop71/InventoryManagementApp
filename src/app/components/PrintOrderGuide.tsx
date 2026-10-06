import { useState } from 'react';
import { Printer } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import type { InventoryItem } from '../contexts/InventoryContext';
import { orderGuideSupplier, orderGuideGroups, orderGuideHtml } from '../utils/printOrderGuide.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';

export function PrintOrderGuide({ inventory }: { inventory: InventoryItem[] }) {
  const { accountName, activeLocationId, locations } = useAuth();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [date, setDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  const suppliers = [...new Set(inventory.filter(item => !item.inactive).map(orderGuideSupplier))] as string[];
  const groups = orderGuideGroups(inventory, selected);
  const print = () => {
    try {
      const html = orderGuideHtml({ items: inventory, selectedSuppliers: selected, accountName, locationName: locations.find(l => l.id === activeLocationId)?.name || 'Selected location', date });
      const tab = window.open('', '_blank');
      if (!tab) { toast.error('Allow pop-ups to open the printable order guide.'); return; }
      tab.opener = null;
      tab.document.write(html); tab.document.close();
      tab.focus(); tab.print();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not prepare the order guide.'); }
  };
  return <><button type="button" onClick={() => { setSelected(suppliers); setOpen(true); }} disabled={!inventory.length} className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-700 disabled:opacity-50"><Printer className="h-4 w-4" />Print order guide</button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Print order guide</DialogTitle><DialogDescription>Choose suppliers for this location. Each supplier starts on a new page, with blank order quantities for handwriting. You can also save as PDF in the print dialog.</DialogDescription></DialogHeader>
      <label className="grid gap-1 text-sm">Order date<input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded border p-2" /></label>
      <div className="flex gap-4"><button onClick={() => setSelected(suppliers)} className="underline">Select all</button><button onClick={() => setSelected([])} className="underline">Clear</button></div>
      <fieldset className="grid gap-3"><legend className="mb-2 font-semibold">Suppliers</legend>{suppliers.sort().map(supplier => <label key={supplier} className="flex items-center gap-2"><input type="checkbox" checked={selected.includes(supplier)} onChange={e => setSelected(previous => e.target.checked ? [...previous, supplier] : previous.filter(s => s !== supplier))} />{supplier}</label>)}</fieldset>
      <p className="text-sm text-gray-600">{groups.reduce((n, group) => n + group.items.length, 0)} active items. Includes stock units, supplier codes, on-hand stock and pars. Nothing is ordered or changed.</p>
      <button disabled={!groups.length || !date} onClick={print} className="rounded-xl bg-[#F58220] px-4 py-3 font-bold disabled:opacity-50">Print / save PDF</button>
    </DialogContent></Dialog></>;
}
