const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;

function ascii(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '-')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function money(value) {
  return `$${(Number(value) || 0).toFixed(2)}`;
}

function textLine(text, x, y, size = 10, bold = false) {
  return `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${y} Td (${ascii(text)}) Tj ET`;
}

function pageContent({ restaurantName, supplier, items, totalCost, pageNumber, pageCount }) {
  const commands = [
    '0.188 0.227 0.263 rg 0 700 612 92 re f',
    '0.961 0.839 0.180 rg 0 695 612 5 re f',
    '1 1 1 rg',
    textLine('ZestIQ', 42, 746, 24, true),
    textLine('SUPPLIER ORDER', 418, 751, 10, true),
    '0 0 0 rg',
    textLine(restaurantName, 42, 660, 18, true),
    textLine(`Supplier: ${supplier}`, 42, 635, 12, true),
    textLine(`Prepared: ${new Date().toLocaleDateString('en-CA')}`, 42, 615, 9),
    '0.96 0.96 0.95 rg 42 570 528 28 re f',
    '0 0 0 rg',
    textLine('ITEM', 54, 580, 9, true),
    textLine('QUANTITY', 365, 580, 9, true),
    textLine('LINE TOTAL', 482, 580, 9, true),
  ];

  let y = 548;
  items.forEach(item => {
    commands.push(textLine(item.itemName, 54, y, 10));
    commands.push(textLine(`${item.suggestedQuantity} ${item.unit}`, 365, y, 10));
    commands.push(textLine(money(item.totalCost), 490, y, 10));
    commands.push('0.88 0.88 0.86 RG 42 ' + (y - 10) + ' m 570 ' + (y - 10) + ' l S');
    y -= 28;
  });

  commands.push(textLine(`ORDER TOTAL: ${money(totalCost)}`, 390, 92, 14, true));
  commands.push(textLine('Review quantities and supplier details before sending.', 42, 62, 8));
  commands.push(textLine(`Page ${pageNumber} of ${pageCount}`, 506, 42, 8));
  return commands.join('\n');
}

export function buildSupplierOrdersPdf({ restaurantName = 'Restaurant', drafts = [] }) {
  const pages = [];
  drafts.forEach(draft => {
    const chunks = [];
    for (let index = 0; index < draft.items.length; index += 15) chunks.push(draft.items.slice(index, index + 15));
    (chunks.length ? chunks : [[]]).forEach(items => pages.push({
      restaurantName,
      supplier: draft.supplier,
      items,
      totalCost: items.reduce((sum, item) => sum + (Number(item.totalCost) || 0), 0),
    }));
  });

  if (pages.length === 0) throw new Error('At least one supplier order is required');

  const objects = [];
  const pageObjectIds = pages.map((_, index) => 5 + (index * 2));
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${pageObjectIds.map(id => `${id} 0 R`).join(' ')}] >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';

  pages.forEach((page, index) => {
    const pageId = pageObjectIds[index];
    const contentId = pageId + 1;
    const content = pageContent({ ...page, pageNumber: index + 1, pageCount: pages.length });
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n${content}\nendstream`;
  });

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = new TextEncoder().encode(pdf).length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

export function downloadSupplierOrdersPdf(input) {
  const bytes = buildSupplierOrdersPdf(input);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `zestiq-supplier-orders-${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
