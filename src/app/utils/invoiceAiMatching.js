import { resolveInvoiceInventoryItem, inventoryItemMatchesInvoiceName } from './invoiceWorkflow.js';

// Only send matching metadata, never prices, stock balances or unrelated records.
export function invoiceMatchingCatalog(inventory = []) {
  if (!Array.isArray(inventory)) return [];
  return inventory.filter(item => item && !item.inactive && item.id && item.name).slice(0, 1000).map(item => ({
    id: String(item.id).slice(0, 100), name: String(item.name).slice(0, 200),
    unit: String(item.unit || '').slice(0, 30), supplier: String(item.supplier || '').slice(0, 200),
    invoiceAliases: (Array.isArray(item.invoiceAliases) ? item.invoiceAliases : []).slice(0, 20).map(value => String(value).slice(0, 200)),
  }));
}

export function applyInvoiceAiMatch(line, inventory) {
  // Keep explicit choices and established name/alias matching authoritative.
  if (line.inventoryItemId || resolveInvoiceInventoryItem(inventory, line).item) return line;
  if (inventory.filter(item => inventoryItemMatchesInvoiceName(item, line.name)).length > 1) return line;
  const candidate = inventory.find(item => !item.inactive && item.id === line.suggestedInventoryItemId);
  const unit = value => String(value || '').trim().toLowerCase();
  if (!candidate || !unit(line.unit) || unit(line.unit) !== unit(candidate.unit)
    || Number(line.matchConfidence) < 0.95 || !Number.isFinite(Number(line.matchConfidence))
    || Number(line.confidence) < 0.85 || !Number.isFinite(Number(line.confidence))) return line;
  return { ...line, inventoryItemId: candidate.id, aiMatchApplied: true };
}
