import { useInventory, type InventoryItem } from '../contexts/InventoryContext';
import { useToast } from '../contexts/ToastContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';

const money = (value: number) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value);

export function ItemActivityDialog({ item, onClose, restoreFocus, reportRange }: { item: InventoryItem | null; onClose: () => void; restoreFocus: () => void; reportRange: { start: string; end: string } }) {
  const inRange = (date: string) => (!reportRange.start || date.slice(0, 10) >= reportRange.start) && (!reportRange.end || date.slice(0, 10) <= reportRange.end);
  const { invoices, orders, recipes } = useInventory();
  const { salesData } = useToast();
  const matchingInvoices = invoices.filter(invoice => invoice.items.some(line => line.itemId === item?.id));
  const purchases = [
    ...matchingInvoices.map(invoice => ({
      key: `invoice-${invoice.id}`, date: invoice.date,
      label: `Invoice ${invoice.invoiceNumber || invoice.id}`, detail: invoice.supplier,
      status: invoice.status, lines: invoice.items.filter(line => line.itemId === item?.id),
    })),
    ...orders.filter(order => order.items.some(line => line.itemId === item?.id) && !matchingInvoices.some(invoice => invoice.orderId === order.id))
      .map(order => ({ key: `order-${order.id}`, date: order.date, label: `Order ${order.id}`, detail: '', status: order.status,
        lines: order.items.filter(line => line.itemId === item?.id) })),
  ].filter(record => inRange(record.date)).sort((a, b) => b.date.localeCompare(a.date));
  const linkedNames = new Set(recipes.filter(recipe => recipe.ingredients.some(ingredient => ingredient.inventoryItemId === item?.id))
    .map(recipe => String(recipe.menuItemName || '').trim().toLowerCase()).filter(Boolean));
  const sales = salesData.filter(day => inRange(day.date)).flatMap(day => (day.topItems || [])
    .filter(sale => linkedNames.has(String(sale.itemName || '').trim().toLowerCase()))
    .map(sale => ({ ...sale, date: day.date }))).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Dialog open={!!item} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent onCloseAutoFocus={event => { event.preventDefault(); restoreFocus(); }} className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{item?.name} — history</DialogTitle>
          <DialogDescription>Purchase records and linked menu sales for the current location. {reportRange.start || 'Earliest'} to {reportRange.end || 'latest'}, newest first.</DialogDescription>
        </DialogHeader>
        <section aria-label="Purchase history" className="min-w-0 space-y-2">
          <h3 className="font-semibold">Purchase history</h3>
          <p className="text-sm text-slate-500">Invoices and orders, including their current status. An order linked to an invoice is shown only once.</p>
          {purchases.length ? purchases.map(record => (
            <div key={record.key} className="rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2"><span className="break-all font-medium">{record.label}</span><span className="capitalize">{record.status}</span></div>
              <p className="text-slate-500">{record.date} {record.detail && `· ${record.detail}`}</p>
              <p className="mt-1">Recorded quantity: {record.lines.reduce((sum, line) => sum + line.quantity, 0)} · Line total: {money(record.lines.reduce((sum, line) => sum + line.cost, 0))}</p>
            </div>
          )) : <p className="rounded-lg bg-slate-50 p-4 text-sm">No purchase history recorded for this item yet.</p>}
        </section>
        <section aria-label="Sales history" className="min-w-0 space-y-2">
          <h3 className="font-semibold">Sales history</h3>
          <p className="text-sm text-slate-500">Available POS sales for menu items whose recipes include this ingredient. Quantities and revenue are for the menu item, not the ingredient. POS summaries may not include every sale.</p>
          {sales.length ? sales.map((sale, index) => (
            <div key={`${sale.date}-${sale.itemName}-${index}`} className="rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{sale.itemName}</span><span>{money(sale.revenue)} menu revenue</span></div>
              <p className="text-slate-500">{sale.date} · {sale.quantity} sold</p>
            </div>
          )) : <p className="rounded-lg bg-slate-50 p-4 text-sm">{linkedNames.size ? 'No matching POS sales recorded yet. Import or sync sales to see them here.' : 'No linked menu recipes yet. Add this inventory item to a menu recipe to see its recorded sales here.'}</p>}
        </section>
      </DialogContent>
    </Dialog>
  );
}
