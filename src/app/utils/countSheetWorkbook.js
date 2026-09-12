import * as XLSX from 'xlsx';
import { countArea } from './printCountSheet.js';

export function countSheetWorkbook(entries, selectedAreas, date, areaOrder = []) {
  const workbook = XLSX.utils.book_new();
  const areas = [...new Set(entries.map(countArea))].filter(area => selectedAreas.includes(area));
  areas.sort((a, b) => {
    const rank = area => areaOrder.includes(area) ? areaOrder.indexOf(area) : 999;
    return rank(a) - rank(b) || a.localeCompare(b);
  });
  if (!areas.length) throw new Error('Select at least one storage area.');
  const used = new Set();
  for (const area of areas) {
    const rows = entries.filter(entry => countArea(entry) === area)
      .sort((a, b) => (a.shelfOrder ?? 999) - (b.shelfOrder ?? 999) || a.name.localeCompare(b.name));
    const sheet = XLSX.utils.aoa_to_sheet([
      ['ZestIQ Inventory Count Sheet'],
      ['Storage area', area],
      ['Count date', date ? new Date(date + 'T12:00:00') : ''],
      ['Counted by', ''],
      [],
      ['Item', 'Unit', 'Quantity', 'Notes'],
      ...rows.map(entry => [entry.name, entry.unit, '', '']),
    ], { cellDates: true, dateNF: 'yyyy-mm-dd' });
    sheet['!cols'] = [{ wch: 42 }, { wch: 24 }, { wch: 16 }, { wch: 36 }];
    sheet['!rows'] = Array.from({ length: rows.length + 6 }, () => ({ hpt: 26 }));
    sheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
    sheet['!margins'] = { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 };
    const base = area.replace(/[\\/\?\*\[\]:]/g, '-').replace(/^'+|'+$/g, '').slice(0, 31) || 'Storage area';
    let name = base;
    let suffix = 2;
    while (used.has(name.toLowerCase())) {
      const ending = ' (' + suffix++ + ')';
      name = base.slice(0, 31 - ending.length) + ending;
    }
    used.add(name.toLowerCase());
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  }
  return workbook;
}
