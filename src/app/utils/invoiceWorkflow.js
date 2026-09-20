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

export function sortInvoicesNewestFirst(invoices) {
  const timestamp = value => {
    if (!value) return 0;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  return invoices.map((invoice, index) => ({ invoice, index }))
    .sort((a, b) => timestamp(b.invoice.date) - timestamp(a.invoice.date)
      || timestamp(b.invoice.createdAt) - timestamp(a.invoice.createdAt)
      || b.index - a.index)
    .map(entry => entry.invoice);
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

export function inventoryItemMatchesInvoiceName(item, invoiceName) {
  const normalizedInvoiceName = normalizeInventoryItemName(invoiceName);
  if (!normalizedInvoiceName) return false;
  const recognizedNames = [
    item?.name,
    ...(item?.invoiceAliases || []),
    ...(item?.purchaseOptions || []).map(option => option?.productName),
  ];
  return recognizedNames.some(name => normalizeInventoryItemName(name) === normalizedInvoiceName);
}

// Use the same decision for the review screen and import. Never silently choose
// among duplicate records, or create stock because OCR changed a description.
export function resolveInvoiceInventoryItem(inventory, line) {
  const matches = inventory.filter(item => inventoryItemMatchesInvoiceName(item, line.name));
  if (line.inventoryItemId && line.inventoryItemId !== 'new') {
    const item = inventory.find(item => item.id === line.inventoryItemId);
    return item ? { item } : { error: 'The selected inventory item is no longer available. Select it again.' };
  }
  if (matches.length === 1) return { item: matches[0] };
  if (matches.length > 1) return { error: `Multiple inventory items match ${line.name}. Choose the correct item.` };
  if (line.inventoryItemId === 'new') return { createNew: true };
  return { error: `Choose an existing inventory item for ${line.name}, or explicitly select Create new item.` };
}
