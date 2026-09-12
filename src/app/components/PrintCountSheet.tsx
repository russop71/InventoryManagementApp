import { useEffect, useRef, useState } from 'react';
import { Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { countArea, countSheetHtml } from '../utils/printCountSheet.js';
import type { InventoryCountEntry } from '../utils/inventoryCounts';

export function PrintCountSheet({ entries, areaOrder = [] }: { entries: InventoryCountEntry[]; areaOrder?: string[] }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState('');
  const previewFrame = useRef<HTMLIFrameElement>(null);
  const previewSection = useRef<HTMLElement>(null);
  useEffect(() => { if (preview) previewSection.current?.scrollIntoView({ block: 'start' }); }, [preview]);
  const [selected, setSelected] = useState<string[]>([]);
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const areas = [...new Set(entries.map(countArea))] as string[];
  const print = () => {
    setPreview(countSheetHtml(entries, selected, date, areaOrder));
  };
  return <><button type="button" disabled={!entries.length} onClick={() => { setPreview(''); setSelected(areas); setOpen(true); }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-[#303A43] disabled:opacity-50"><Printer className="h-4 w-4" />Print count sheet</button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Print count sheets</DialogTitle><DialogDescription>Print the entire count or select storage areas. Quantities are left blank for handwritten counts; printing does not change stock.</DialogDescription></DialogHeader>
      <label className="grid gap-1 text-sm">Count date<input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded border p-2" /></label>
      <div className="flex gap-4"><button type="button" onClick={() => setSelected(areas)} className="underline">Select all</button><button type="button" onClick={() => setSelected([])} className="underline">Clear</button></div>
      <fieldset className="grid gap-3"><legend className="mb-2 font-semibold">Storage areas</legend>{areas.map(area => <label key={area} className="flex items-center gap-2"><input type="checkbox" checked={selected.includes(area)} onChange={e => setSelected(current => e.target.checked ? [...current, area] : current.filter(a => a !== area))} />{area} ({entries.filter(e => countArea(e) === area).length} items)</label>)}</fieldset>
      <p className="text-sm text-gray-600">After counting, use Start count or Resume count to enter quantities online. Uncounted items should stay blank.</p>
      <button type="button" disabled={!selected.some(a => areas.includes(a))} onClick={print} className="rounded-xl bg-[#F5D62E] px-4 py-3 font-bold disabled:opacity-50">Open printable sheets</button>
      {preview && <section ref={previewSection} aria-label="Count sheet preview" className="grid gap-3">
        <h3 className="font-semibold">Your printable count sheets</h3>
        <button type="button" className="rounded-xl border px-4 py-2 font-semibold" onClick={() => {
          try {
            const frame = previewFrame.current?.contentWindow;
            if (!frame) throw new Error('Preview unavailable');
            frame.focus();
            frame.print();
          } catch {
            toast.error('Printing is unavailable in this browser. Download the sheet and open it in Safari or Chrome.');
          }
        }}>Print / Save as PDF</button>
        <a className="underline" download="zestiq-count-sheet.html" href={`data:text/html;charset=utf-8,${encodeURIComponent(preview)}`}>Download printable sheet</a>
        <iframe ref={previewFrame} title="Printable inventory count sheets" srcDoc={preview} className="h-[50vh] w-full rounded border bg-white" />
      </section>}
    </DialogContent></Dialog></>;
}
