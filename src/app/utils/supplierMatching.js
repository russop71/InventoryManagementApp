const COMPANY_SUFFIXES = new Set(['co', 'company', 'corp', 'corporation', 'inc', 'incorporated', 'limited', 'ltd', 'llc', 'lp', 'ulc']);

export function normalizeSupplierName(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(token => token && !COMPANY_SUFFIXES.has(token))
    .join(' ')
    .trim();
}

function editDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

export function supplierNameSimilarity(leftValue, rightValue) {
  const left = normalizeSupplierName(leftValue);
  const right = normalizeSupplierName(rightValue);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (Math.min(left.length, right.length) < 5) return 0;
  const leftTokens = new Set(left.split(' '));
  const rightTokens = new Set(right.split(' '));
  const shared = [...leftTokens].filter(token => rightTokens.has(token)).length;
  const editSimilarity = 1 - (editDistance(left, right) / Math.max(left.length, right.length));
  const tokenSimilarity = shared === 0 ? 0 : (2 * shared) / (leftTokens.size + rightTokens.size);
  return Math.max(editSimilarity, editSimilarity * 0.8 + tokenSimilarity * 0.2);
}

export function findBestSupplierMatch(name, suppliers = [], minimumConfidence = 0.86) {
  const ranked = suppliers
    .map(supplier => ({ supplier, confidence: supplierNameSimilarity(name, supplier?.name) }))
    .filter(entry => entry.confidence >= minimumConfidence)
    .sort((left, right) => right.confidence - left.confidence || String(left.supplier?.name).localeCompare(String(right.supplier?.name)));
  if (!ranked.length) return null;
  if (ranked[1] && ranked[0].confidence - ranked[1].confidence < 0.04) return null;
  return ranked[0];
}

export function mergeDuplicateSuppliers(suppliers = []) {
  const merged = [];
  for (const supplier of suppliers) {
    const normalizedName = normalizeSupplierName(supplier?.name);
    const match = merged.find(existing => normalizedName && normalizeSupplierName(existing?.name) === normalizedName);
    if (!match) {
      merged.push({ ...supplier });
      continue;
    }
    const index = merged.findIndex(item => item.id === match.id);
    const primary = merged[index];
    const preferIncoming = primary.source === 'invoice' && supplier.source === 'manual';
    const preferred = preferIncoming ? supplier : primary;
    const secondary = preferIncoming ? primary : supplier;
    merged[index] = {
      ...secondary,
      ...preferred,
      contactPerson: preferred.contactPerson || secondary.contactPerson || '',
      email: preferred.email || secondary.email || '',
      phone: preferred.phone || secondary.phone || '',
      address: preferred.address || secondary.address || '',
      paymentTerms: preferred.paymentTerms || secondary.paymentTerms || '',
      notes: preferred.notes || secondary.notes || '',
      dateAdded: [primary.dateAdded, supplier.dateAdded].filter(Boolean).sort()[0] || primary.dateAdded || supplier.dateAdded,
    };
  }
  return merged;
}
