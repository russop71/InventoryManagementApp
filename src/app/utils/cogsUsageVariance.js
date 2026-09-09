import { isInventoryCountFinalized } from './inventoryCountWorkflow.js';

function dateKey(value) {
  if (!value) return '';
  const candidate = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : '';
}

function aggregateCount(count) {
  const totals = new Map();
  (count?.entries || []).forEach(entry => {
    const itemId = String(entry?.itemId || '');
    if (!itemId) return;
    totals.set(itemId, (totals.get(itemId) || 0) + (Number(entry?.counted) || 0));
  });
  return totals;
}

function selectCountCoverage(counts, startDate, endDate) {
  const finalized = (Array.isArray(counts) ? counts : [])
    .filter(isInventoryCountFinalized)
    .map(count => ({ count, date: dateKey(count.finalizedAt || count.countDate || count.updatedAt) }))
    .filter(entry => entry.date)
    .sort((left, right) => left.date.localeCompare(right.date));

  const withinRange = finalized.filter(entry => entry.date >= startDate && entry.date <= endDate);
  if (withinRange.length >= 2) {
    return { opening: withinRange[0], closing: withinRange[withinRange.length - 1] };
  }

  const opening = [...finalized].reverse().find(entry => entry.date <= startDate);
  const closing = [...finalized].reverse().find(entry => entry.date <= endDate && (!opening || entry.date > opening.date));
  return opening && closing ? { opening, closing } : null;
}

export function buildCogsUsageVariance({
  salesData = [],
  menuItems = [],
  inventory = [],
  inventoryCounts = [],
  invoices = [],
  startDate = '',
  endDate = '',
} = {}) {
  const sortedSalesDates = salesData.map(day => dateKey(day?.date)).filter(Boolean).sort();
  const requestedStart = dateKey(startDate) || sortedSalesDates[0] || '';
  const requestedEnd = dateKey(endDate) || sortedSalesDates[sortedSalesDates.length - 1] || '';
  const coverage = requestedStart && requestedEnd
    ? selectCountCoverage(inventoryCounts, requestedStart, requestedEnd)
    : null;
  const usageStart = coverage?.opening.date || requestedStart;
  const usageEnd = coverage?.closing.date || requestedEnd;
  const visibleSales = salesData.filter(day => {
    const date = dateKey(day?.date);
    return date && (!usageStart || date >= usageStart) && (!usageEnd || date <= usageEnd);
  });

  const inventoryById = new Map(inventory.map(item => [String(item.id), item]));
  const menuByName = new Map(menuItems.map(item => [String(item.name || '').trim().toLowerCase(), item]));
  const theoreticalByItem = new Map();
  let matchedSalesItems = 0;
  let totalSalesItems = 0;

  visibleSales.forEach(day => {
    (day?.topItems || []).forEach(soldItem => {
      totalSalesItems += 1;
      const menuItem = menuByName.get(String(soldItem?.itemName || '').trim().toLowerCase());
      if (!menuItem) return;
      matchedSalesItems += 1;
      const sold = Math.max(0, Number(soldItem?.quantity) || 0);
      (menuItem.ingredients || []).forEach(ingredient => {
        const itemId = String(ingredient?.inventoryItemId || '');
        if (!itemId || !inventoryById.has(itemId)) return;
        theoreticalByItem.set(itemId, (theoreticalByItem.get(itemId) || 0) + sold * (Number(ingredient?.quantity) || 0));
      });
    });
  });

  const openingByItem = coverage ? aggregateCount(coverage.opening.count) : new Map();
  const closingByItem = coverage ? aggregateCount(coverage.closing.count) : new Map();
  const purchasesByItem = new Map();
  if (coverage) {
    invoices
      .filter(invoice => invoice?.status === 'received')
      .filter(invoice => {
        const date = dateKey(invoice?.date);
        return date && date > coverage.opening.date && date <= coverage.closing.date;
      })
      .forEach(invoice => {
        (invoice?.items || []).forEach(line => {
          const itemId = String(line?.itemId || '');
          if (!itemId) return;
          purchasesByItem.set(itemId, (purchasesByItem.get(itemId) || 0) + (Number(line?.quantity) || 0));
        });
      });
  }

  const itemIds = new Set([
    ...theoreticalByItem.keys(),
    ...openingByItem.keys(),
    ...closingByItem.keys(),
    ...purchasesByItem.keys(),
  ]);
  const rows = [...itemIds]
    .map(itemId => {
      const item = inventoryById.get(itemId);
      if (!item) return null;
      const theoreticalUsage = theoreticalByItem.get(itemId) || 0;
      const openingQuantity = openingByItem.get(itemId) || 0;
      const purchases = purchasesByItem.get(itemId) || 0;
      const closingQuantity = closingByItem.get(itemId) || 0;
      const actualUsage = coverage ? openingQuantity + purchases - closingQuantity : null;
      const varianceQuantity = actualUsage === null ? null : actualUsage - theoreticalUsage;
      const unitCost = Number(item.unitCost) || 0;
      return {
        itemId,
        name: item.name || 'Inventory item',
        category: item.category || 'Uncategorized',
        unit: item.unit || 'units',
        unitCost,
        theoreticalUsage,
        theoreticalCost: theoreticalUsage * unitCost,
        actualUsage,
        actualCost: actualUsage === null ? null : actualUsage * unitCost,
        varianceQuantity,
        varianceCost: varianceQuantity === null ? null : varianceQuantity * unitCost,
        openingQuantity,
        purchases,
        closingQuantity,
      };
    })
    .filter(Boolean)
    .filter(row => row.theoreticalUsage !== 0 || row.actualUsage !== 0)
    .sort((left, right) => Math.abs(right.varianceCost || right.theoreticalCost) - Math.abs(left.varianceCost || left.theoreticalCost));

  const theoreticalCost = rows.reduce((sum, row) => sum + row.theoreticalCost, 0);
  const actualCost = coverage ? rows.reduce((sum, row) => sum + (row.actualCost || 0), 0) : null;
  const varianceCost = actualCost === null ? null : actualCost - theoreticalCost;

  return {
    requestedStart,
    requestedEnd,
    usageStart,
    usageEnd,
    coverage: coverage ? {
      openingCountId: coverage.opening.count.id,
      closingCountId: coverage.closing.count.id,
      startDate: coverage.opening.date,
      endDate: coverage.closing.date,
    } : null,
    rows,
    theoreticalCost,
    actualCost,
    varianceCost,
    variancePercent: varianceCost === null || theoreticalCost === 0 ? null : (varianceCost / theoreticalCost) * 100,
    salesDays: visibleSales.length,
    matchedSalesItems,
    totalSalesItems,
  };
}
