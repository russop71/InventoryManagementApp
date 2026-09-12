import { useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { countArea } from '../utils/printCountSheet.js';
import type { InventoryCountEntry } from '../utils/inventoryCounts';

export function PrintCountSheet({ entries, areaOrder = [] }: { entries: InventoryCountEntry[]; areaOrder?: string[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const areas = [...new Set(entries.map(countArea))] as string[];
  const download = async () => {
    setBusy(true);
    try {
      const [{ countSheetWorkbook }, XLSX] = await Promise.all([import('../utils/countSheetWorkbook.js'), import('xlsx')]);
      XLSX.writeFile(countSheetWorkbook(entries, selected, date, areaOrder), `ZestIQ-count-sheets-${date || 'undated'}.xlsx`);
      toast.success('Excel count sheet download started.');
    } catch {
      toast.error('Could not download the count sheet. Please try again.');
    } finally { setBusy(false); }
  };
  return <><button type="button" disabled={!entries.length} onClick={() => { setSelected(areas); setOpen(true); }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-[#303A43] disabled:opacity-50"><Download className="h-4 w-4" />Download count sheet</button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Download Excel count sheets</DialogTitle><DialogDescription>Select all storage areas or only the areas you need. The Excel file has one tab per area and blank quantity and notes columns. Downloading does not change stock.</DialogDescription></DialogHeader>
      <label className="grid gap-1 text-sm">Count date<input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded border p-2" /></label>
      <div className="flex gap-4"><button type="button" onClick={() => setSelected(areas)} className="underline">Select all</button><button type="button" onClick={() => setSelected([])} className="underline">Clear</button></div>
      <fieldset className="grid gap-3"><legend className="mb-2 font-semibold">Storage areas</legend>{areas.map(area => <label key={area} className="flex items-center gap-2"><input type="checkbox" checked={selected.includes(area)} onChange={e => setSelected(current => e.target.checked ? [...current, area] : current.filter(a => a !== area))} />{area} ({entries.filter(e => countArea(e) === area).length} items)</label>)}</fieldset>
      <p className="text-sm text-gray-600">Open the downloaded file in Excel to print it. After counting, use Start count or Resume count to enter quantities online.</p>
      <button type="button" disabled={busy || !selected.some(a => areas.includes(a))} onClick={download} className="rounded-xl bg-[#F5D62E] px-4 py-3 font-bold disabled:opacity-50">{busy ? 'Preparing Excel file…' : 'Download Excel (.xlsx)'}</button>
    </DialogContent></Dialog></>;
}
