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
