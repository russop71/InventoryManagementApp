import { useState } from 'react';
import { useInventory } from '../contexts/InventoryContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';

const money = (value: number) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value);
const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function SupplierInvoicesDialog({ supplier, onClose, restoreFocus, initialRange }: { supplier: string | null; onClose: () => void; restoreFocus: () => void; initialRange?: { start: string; end: string } }) {
  const { invoices } = useInventory();
  const [start, setStart] = useState(() => initialRange?.start ?? localDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [end, setEnd] = useState(() => initialRange?.end ?? localDate(new Date()));
  const invalidRange = !!(start && end && start > end);
  const matching = invalidRange ? [] : invoices.filter(invoice => {
    const date = String(invoice.date || '').slice(0, 10);
    return String(invoice.supplier || '').trim().toLowerCase() === supplier?.trim().toLowerCase()
      && date && (!start || date >= start) && (!end || date <= end);
  }).sort((a, b) => b.date.localeCompare(a.date));
  const total = matching.filter(invoice => invoice.status !== 'cancelled').reduce((sum, invoice) => sum + invoice.totalAmount, 0);

  return (
    <Dialog open={supplier !== null} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent onCloseAutoFocus={event => { event.preventDefault(); restoreFocus(); }} className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{supplier} — invoices</DialogTitle>
          <DialogDescription>Invoices for this supplier at the current location. Filter by invoice date; both dates are included.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="min-w-0 text-sm font-medium">From date<Input type="date" value={start} onChange={event => setStart(event.target.value)} /></label>
          <label className="min-w-0 text-sm font-medium">To date<Input type="date" value={end} onChange={event => setEnd(event.target.value)} /></label>
        </div>
        {invalidRange ? <p role="alert" className="text-sm text-red-700">From date must be on or before To date.</p> : <>
          <div className="rounded-lg bg-slate-50 p-3 text-sm" aria-live="polite">
            <p className="font-semibold">{matching.length} invoices · Total: {money(total)}</p>
            <p className="mt-1 text-slate-500">Cancelled invoices excluded from total. This is invoice spending, not the current stock value shown behind this window.</p>
          </div>
          <div className="space-y-2">
            {matching.length ? matching.map(invoice => <div key={invoice.id} className="rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2"><span className="break-all font-medium">Invoice {invoice.invoiceNumber || '—'}</span><span className="font-semibold">{money(invoice.totalAmount)}</span></div>
              <p className="mt-1 text-slate-500">{invoice.date.slice(0, 10)} · <span className="capitalize">{invoice.status}</span></p>
            </div>) : <p className="py-4 text-sm text-slate-500">No invoices for this supplier in the selected date range.</p>}
          </div>
        </>}
      </DialogContent>
    </Dialog>
  );
}
