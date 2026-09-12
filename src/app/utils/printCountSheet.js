const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const countArea = entry => entry.storageArea?.trim() || 'Unassigned';
export function countSheetHtml(entries, selectedAreas, date, areaOrder = []) {
  const areas = [...new Set(entries.map(countArea))].filter(a => selectedAreas.includes(a)).sort((a, b) => {
    const rank = area => areaOrder.includes(area) ? areaOrder.indexOf(area) : 999;
    return rank(a) - rank(b) || a.localeCompare(b);
  });
  return `<!doctype html><html><head><meta charset="utf-8"><title>ZestIQ Inventory Count Sheet</title><style>
  body{font:12px Arial,sans-serif;color:#111;margin:24px}h1{font-size:22px}h2{font-size:17px}table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{border:1px solid #777;padding:10px;text-align:left;overflow-wrap:anywhere}td{height:28px}thead{display:table-header-group}tr{break-inside:avoid}.meta{line-height:2.5}section+section{break-before:page}.hint{font-size:11px}button{padding:12px;margin-bottom:20px}@page{size:auto;margin:14mm}@media print{button{display:none}body{margin:0}}
  </style></head><body><button onclick="window.print()">Print / Save as PDF</button>${areas.map(area => `<section><h1>ZestIQ · Inventory count sheet</h1><h2>${escape(area)}</h2><div class="meta">Restaurant / location: __________________________<br>Count date: ${escape(date)} &nbsp; Counted by: __________________________</div><p class="hint">Write quantities in the listed units. Blank means not counted, not zero. Enter results in the online count for this storage area, then review before finalizing.</p><table><thead><tr><th style="width:6%">#</th><th style="width:38%">Item</th><th style="width:12%">Unit</th><th style="width:16%">Quantity</th><th>Notes</th></tr></thead><tbody>${entries.filter(e => countArea(e) === area).sort((a,b) => (a.shelfOrder ?? 999) - (b.shelfOrder ?? 999) || a.name.localeCompare(b.name)).map((e,i) => `<tr><td>${i+1}</td><td>${escape(e.name)}</td><td>${escape(e.unit)}</td><td></td><td></td></tr>`).join('')}</tbody></table></section>`).join('')}</body></html>`;
}
