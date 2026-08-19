export function groupBySupplier(items) {
  const supplierMap = new Map();

  items.forEach((item) => {
    const key = item.supplier?.trim() || 'Supplier';
    const existing = supplierMap.get(key);

    if (existing) {
      existing.items.push(item);
      existing.totalCost += Number(item.totalCost || 0);
    } else {
      supplierMap.set(key, { supplier: key, items: [item], totalCost: Number(item.totalCost || 0) });
    }
  });

  return Array.from(supplierMap.values()).sort((left, right) => left.supplier.localeCompare(right.supplier));
}

export function calculateInvoiceTotal(items) {
  return items.reduce((sum, item) => sum + Number(item.cost || 0), 0);
}

export function filterInvoiceItems(inventory, query) {
  const normalized = (query || '').trim().toLowerCase();
  if (!normalized) return inventory;

  return inventory.filter((item) => {
    const searchable = `${item.name || ''} ${item.supplier || ''} ${item.category || ''}`.toLowerCase();
    return searchable.includes(normalized);
  });
}

export function normalizeInvoiceNumber(invoiceNumber) {
  return String(invoiceNumber || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function hasDuplicateInvoiceNumber(invoices, invoiceNumber) {
  const normalized = normalizeInvoiceNumber(invoiceNumber);
  if (!normalized) return false;
  return invoices.some((invoice) => normalizeInvoiceNumber(invoice.invoiceNumber) === normalized);
}

export function normalizeInventoryItemName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(?:case|cs|each|ea|unit|units|kg|lb|lbs|liter|litre|l|ml)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
