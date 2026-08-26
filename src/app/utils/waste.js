export const WASTE_REASONS = ['Spoilage', 'Overproduction', 'Prep waste', 'Expired', 'Quality issue', 'Dropped/damaged', 'Comped/returned', 'Other'];

export function wasteTotal(entries, startDate = '', endDate = '') {
  return entries
    .filter(entry => (!startDate || entry.occurredAt.slice(0, 10) >= startDate) && (!endDate || entry.occurredAt.slice(0, 10) <= endDate))
    .reduce((sum, entry) => sum + (Number(entry.totalCost) || 0), 0);
}

export function wasteByReason(entries, startDate = '', endDate = '') {
  const totals = new Map();
  entries
    .filter(entry => (!startDate || entry.occurredAt.slice(0, 10) >= startDate) && (!endDate || entry.occurredAt.slice(0, 10) <= endDate))
    .forEach(entry => totals.set(entry.reason, (totals.get(entry.reason) || 0) + (Number(entry.totalCost) || 0)));
  return [...totals.entries()].map(([reason, total]) => ({ reason, total })).sort((a, b) => b.total - a.total);
}
