import { useState } from 'react';
import { useInventory, type InventoryItem } from '../contexts/InventoryContext';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import type { InventoryCount } from '../utils/inventoryCounts';
import { convertIngredientQuantity } from '../utils/unitConversion';

const quantity = (value: number | null) => value === null ? 'Unavailable' : value.toLocaleString('en-CA', { maximumFractionDigits: 3 });
const money = (value: number) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value);
const numericColumns = ['Opening', 'Received', 'Closing', 'Actual usage', 'Theoretical usage', 'Variance amount', 'Variance %', 'Est. cost variance'];

function countQuantity(count: InventoryCount | undefined, item: InventoryItem) {
  const entries = count?.entries.filter(entry => entry.itemId === item.id) || [];
  if (!entries.length || entries.some(entry => entry.isCounted === false)) return null;
  const converted = entries.map(entry => convertIngredientQuantity(item, entry.counted, entry.unit, item.unit));
  if (converted.some(value => value === null || !Number.isFinite(value))) return null;
  return converted.reduce<number>((sum, value) => sum + (value || 0), 0);
}

export function UsageVariance() {
  const { inventory, inventoryCounts, invoices, orders, recipes } = useInventory();
  const { salesData } = useToast();
  const { user } = useAuth();
  const isDemo = user?.email?.trim().toLowerCase() === 'demo@zestiq.com';
  // Daily sales cannot be split around a mid-day count: compare end-of-day snapshots only.
  const counts = inventoryCounts.filter(count => count.status === 'finalized' && count.countType !== 'day-start')
    .sort((a, b) => a.countDate.localeCompare(b.countDate));
  const [selectedOpening, setOpeningId] = useState<string | null>(null);
  const [selectedClosing, setClosingId] = useState<string | null>(null);
  const openingId = selectedOpening ?? (isDemo && counts.some(count => count.id === 'demo-usage-count-7') ? 'demo-usage-count-7' : '');
  const closingId = selectedClosing ?? (isDemo && counts.some(count => count.id === 'demo-usage-count-0') ? 'demo-usage-count-0' : '');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ column: number; descending: boolean } | null>(null);
  const opening = counts.find(count => count.id === openingId);
  const closing = counts.find(count => count.id === closingId);
  const valid = !!opening && !!closing && opening.countDate.slice(0, 10) < closing.countDate.slice(0, 10);
  const inPeriod = (date: string) => valid && date.slice(0, 10) > opening!.countDate.slice(0, 10) && date.slice(0, 10) <= closing!.countDate.slice(0, 10);
  const sales = salesData.filter(day => inPeriod(day.date));
  const receivedInvoices = invoices.filter(invoice => invoice.status === 'received' && inPeriod(invoice.date));
  const receivedOrders = orders.filter(order => order.status === 'received' && inPeriod(order.date) && !invoices.some(invoice => invoice.orderId === order.id));
  const rows = inventory.filter(item => item.name.toLowerCase().includes(search.trim().toLowerCase())).map(item => {
    const start = countQuantity(opening, item);
    const end = countQuantity(closing, item);
    const receipts = [...receivedInvoices, ...receivedOrders].flatMap(record => record.items)
      .filter(line => line.itemId === item.id).reduce((sum, line) => sum + line.quantity, 0);
    const actual = !valid || start === null || end === null ? null : start + receipts - end;
    const linked = recipes.filter(recipe => recipe.ingredients.some(ingredient => ingredient.inventoryItemId === item.id));
    let theoretical: number | null = sales.length && linked.length ? 0 : null;
    const issues: string[] = [];
    if (actual === null) issues.push('Missing count or incompatible count unit');
    if (!sales.length) issues.push('No POS sales in period');
    if (!linked.length) issues.push('No linked menu recipe');
    const names = new Set<string>();
    for (const recipe of linked) {
      const name = String(recipe.menuItemName || '').trim().toLowerCase();
      if (!name || names.has(name)) { theoretical = null; issues.push('Missing or duplicate menu mapping'); continue; }
      names.add(name);
      const matchedSales = sales.flatMap(day => day.topItems || []).filter(sale => String(sale.itemName || '').trim().toLowerCase() === name);
      if (!matchedSales.length) { theoretical = null; issues.push(`No recorded sales for ${recipe.menuItemName}`); continue; }
      const sold = matchedSales.reduce((sum, sale) => sum + sale.quantity, 0);
      for (const ingredient of recipe.ingredients.filter(ingredient => ingredient.inventoryItemId === item.id)) {
        const converted = convertIngredientQuantity(item, ingredient.quantity, ingredient.unit || item.unit, item.unit);
        if (converted === null || !Number.isFinite(converted)) { theoretical = null; issues.push('Recipe unit conversion missing'); }
        else if (theoretical !== null) theoretical += converted * sold;
      }
    }
    const variance = actual === null || theoretical === null ? null : actual - theoretical;
    const percent = variance === null || theoretical === null || theoretical <= 0 ? null : variance / theoretical * 100;
    const cost = variance === null ? null : variance * item.unitCost;
    return { item, start, end, receipts, actual, theoretical, variance, percent, cost,
      values: [start, valid ? receipts : null, end, actual, theoretical, variance, percent, cost], issues: [...new Set(issues)] };
  });
  if (sort) rows.sort((a, b) => {
    const left = a.values[sort.column];
    const right = b.values[sort.column];
    const leftMissing = left === null || !Number.isFinite(left);
    const rightMissing = right === null || !Number.isFinite(right);
    if (leftMissing || rightMissing) return leftMissing === rightMissing ? a.item.name.localeCompare(b.item.name) : leftMissing ? 1 : -1;
    return (sort.descending ? right! - left! : left! - right!) || a.item.name.localeCompare(b.item.name);
  });

  return <div className="space-y-4">
    <header><h2 className="text-2xl font-semibold">Actual vs Theoretical</h2><p className="mt-1 text-sm text-slate-600">Ingredient usage and variance for the current location.</p></header>
    {isDemo && <p className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">Sample demo data: opening counts, received invoices, recipe-based sales, and closing counts reconcile. Positive and negative variances are simulated. Choose the count from 14 days ago for a longer comparison. Editing demo records can change the results.</p>}
    <section className="rounded-xl border bg-white p-4 space-y-3" aria-label="Comparison period">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">Opening count<select className="mt-1 h-10 w-full rounded-lg border bg-white px-2" value={openingId} onChange={event => setOpeningId(event.target.value)}><option value="">Choose a finalized count</option>{counts.map(count => <option key={count.id} value={count.id}>{count.countDate.slice(0, 10)} · {count.description}</option>)}</select></label>
        <label className="text-sm font-medium">Closing count<select className="mt-1 h-10 w-full rounded-lg border bg-white px-2" value={closingId} onChange={event => setClosingId(event.target.value)}><option value="">Choose a finalized count</option>{counts.map(count => <option key={count.id} value={count.id}>{count.countDate.slice(0, 10)} · {count.description}</option>)}</select></label>
      </div>
      <p className="text-sm text-slate-600">Uses finalized end-of-day counts. Activity after the opening date through the closing date is included. Actual = opening + received purchases − closing. Variance = actual − theoretical; positive means more was used than recipes predict.</p>
      {counts.length < 2 && <p className="text-sm text-amber-800">Finalize at least two end-of-day inventory counts to compare usage.</p>}
      {opening && closing && !valid && <p role="alert" className="text-sm text-red-700">The closing count must be on a later date than the opening count.</p>}
    </section>
    <>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">Provisional comparison — check data completeness</p>
        <p className="mt-1">Purchases use received invoice/order dates and recorded stock quantities; invoice dates may differ from delivery dates. Sales summaries may omit menu items or days. Current recipe definitions and package conversions are used. Transfers and supplier returns are not reconciled here; recorded waste remains part of actual usage. Cost variance uses current unit costs, not historical accounting costs.</p>
        <p className="mt-1">{sales.length} POS daily records · {receivedInvoices.length} received invoices · {receivedOrders.length} additional received orders</p>
      </div>
      <p className="text-sm text-slate-600">{rows.length} of {inventory.length} inventory items · Variance % = variance ÷ theoretical usage × 100. N/A when theoretical usage is zero or unavailable.</p>
      <label className="block text-sm font-medium">Search ingredients<input value={search} onChange={event => setSearch(event.target.value)} className="mt-1 h-10 w-full rounded-lg border bg-white px-3" /></label>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full border-collapse text-left text-sm [&_tr>*+*]:border-l [&_tr>*+*]:border-slate-300 [&_tbody_td:nth-child(even)]:bg-slate-50 [&_thead_th:nth-child(even)]:bg-slate-100 [&_td]:tabular-nums"><caption className="sr-only">Actual and theoretical ingredient usage comparison</caption>
          <thead className="bg-slate-50"><tr><th scope="col" className="whitespace-nowrap p-3">Ingredient / unit</th>{numericColumns.map((title, column) => <th key={title} scope="col" aria-sort={sort?.column === column ? sort.descending ? 'descending' : 'ascending' : 'none'} className="whitespace-nowrap p-3">
            <button type="button" className="inline-flex min-h-10 items-center gap-2 rounded px-1 text-left hover:bg-slate-200 focus-visible:outline focus-visible:outline-2" onClick={() => setSort(current => ({ column, descending: current?.column === column ? !current.descending : true }))} aria-label={`${title}: sort ${sort?.column === column && sort.descending ? 'lowest to highest' : 'highest to lowest'}`}>
              {title}<span aria-hidden="true">{sort?.column === column ? sort.descending ? '↓' : '↑' : '↕'}</span>
            </button>
          </th>)}</tr></thead>
          <tbody>{rows.map(row => <tr key={row.item.id} className="border-t align-top"><th scope="row" className="min-w-48 p-3 font-medium">{row.item.name}<span className="block text-slate-500">{row.item.unit}</span>{row.issues.map(issue => <span key={issue} className="block text-xs font-normal text-amber-800">{issue}</span>)}</th>
            {[row.start, valid ? row.receipts : null, row.end, row.actual, row.theoretical, row.variance].map((value, index) => <td key={index} className="p-3">{quantity(value)}</td>)}
            <td className="p-3">{row.percent === null ? 'N/A' : `${quantity(row.percent)}%`}</td>
            <td className="p-3">{row.cost === null ? 'Unavailable' : money(row.cost)}</td>
          </tr>)}</tbody>
        </table>
        {!rows.length && <p className="p-4 text-sm">No matching inventory items.</p>}
      </div>
    </>
  </div>;
}
