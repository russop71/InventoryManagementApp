export const orderGuideSupplier = item => String(item.supplier || '').trim() || 'Unassigned supplier';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const number = value => Number.isFinite(Number(value)) && value !== null && value !== '' ? Number(value).toLocaleString('en-CA', { maximumFractionDigits: 3 }) : '—';
export function orderGuideGroups(items, selectedSuppliers) {
  const selected = new Set(selectedSuppliers);
  const groups = new Map();
  for (const item of items) {
    if (item.inactive || item.isActive === false || item.active === false || item.archivedAt || item.deactivatedAt) continue;
    const supplier = orderGuideSupplier(item);
    if (!selected.has(supplier)) continue;
    if (!groups.has(supplier)) groups.set(supplier, []);
    groups.get(supplier).push(item);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([supplier, rows]) => ({ supplier, items: [...rows].sort((a, b) => String(a.name).localeCompare(String(b.name))) }));
}
export function orderGuideHtml({ items, selectedSuppliers, accountName, locationName, date }) {
  const groups = orderGuideGroups(items, selectedSuppliers);
  if (!groups.length) throw new Error('No active items match the selected suppliers.');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>ZestIQ Order Guide</title><style>
  @page{size: auto;margin:14mm}body{font:12px Arial,sans-serif;color:#202830;margin:20px}h1{font-size:24px;margin:0 0 8px}h2{font-size:17px;margin:22px 0 10px}p{line-height:1.5}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #87919a;padding:9px 6px;text-align:left;overflow-wrap:anywhere}th{background:#eee}thead{display:table-header-group}tr{break-inside:avoid}section+section{break-before:page}h2{break-after:avoid}.item{width:30%}.code{width:14%}.unit{width:14%}.num{width:10%}.blank{width:22%}footer{margin-top:18px;border-top:1px solid #aaa;padding-top:12px}@media print{body{margin:0}}</style></head><body><h1>ZestIQ · Order guide</h1><p>${escape(accountName)} · ${escape(locationName)}<br>Order date: ${escape(date)} · Prepared by: ____________________</p><p>Stock and par use the listed inventory unit. Write the order quantity and purchasing unit in the blank column. Printing does not place an order or change inventory.</p>${groups.map(group => `<section><h2>${escape(group.supplier)} · ${escape(locationName)} · ${escape(date)}</h2><table><thead><tr><th class="item">Item</th><th class="code">Supplier code</th><th class="unit">Stock unit</th><th class="num">On hand</th><th class="num">Par</th><th class="blank">Order qty / unit</th></tr></thead><tbody>${group.items.map(item => `<tr><td>${escape(item.name)}</td><td>${escape(item.vendorItemCode || item.sku || '')}</td><td>${escape(item.unit)}</td><td>${number(item.currentStock)}</td><td>${number(item.parLevel)}</td><td>&nbsp;</td></tr>`).join('')}</tbody></table><footer>Notes: __________________________________________________________________<br><br>________________________________________________________________________</footer></section>`).join('')}</body></html>`;
}
