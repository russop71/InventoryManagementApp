export function isInventoryCountFinalized(count) {
  if (!count) return false;
  if (count.status) return count.status === 'finalized';
  return count.locked === 'Yes';
}

export function isInventoryCountEntryComplete(entry, count) {
  if (typeof entry?.isCounted === 'boolean') return entry.isCounted;
  return isInventoryCountFinalized(count);
}

function countTimestamp(count) {
  const candidate = count?.finalizedAt || count?.updatedAt || count?.createdAt || count?.countDate;
  const timestamp = candidate ? new Date(candidate).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function getLatestFinalizedInventoryCount(counts, excludeId = '') {
  return [...(Array.isArray(counts) ? counts : [])]
    .filter(count => count?.id !== excludeId && isInventoryCountFinalized(count))
    .sort((left, right) => countTimestamp(right) - countTimestamp(left))[0] || null;
}

export function getLatestDraftInventoryCount(counts) {
  return [...(Array.isArray(counts) ? counts : [])]
    .filter(count => !isInventoryCountFinalized(count))
    .sort((left, right) => countTimestamp(right) - countTimestamp(left))[0] || null;
}

export function summarizeInventoryCount(count) {
  const entries = Array.isArray(count?.entries) ? count.entries : [];
  const completedEntries = entries.filter(entry => isInventoryCountEntryComplete(entry, count));
  const expectedValue = entries.reduce((sum, entry) => sum + (Number(entry?.hypothetical) || 0) * (Number(entry?.unitCost) || 0), 0);
  const countedValue = completedEntries.reduce((sum, entry) => sum + (Number(entry?.counted) || 0) * (Number(entry?.unitCost) || 0), 0);
  const varianceValue = completedEntries.reduce((sum, entry) => (
    sum + ((Number(entry?.counted) || 0) - (Number(entry?.hypothetical) || 0)) * (Number(entry?.unitCost) || 0)
  ), 0);
  const lossValue = completedEntries.reduce((sum, entry) => {
    const variance = (Number(entry?.counted) || 0) - (Number(entry?.hypothetical) || 0);
    return sum + Math.max(0, -variance * (Number(entry?.unitCost) || 0));
  }, 0);

  return {
    totalItems: entries.length,
    completedItems: completedEntries.length,
    remainingItems: Math.max(0, entries.length - completedEntries.length),
    progressPercent: entries.length > 0 ? (completedEntries.length / entries.length) * 100 : 0,
    expectedValue,
    countedValue,
    varianceValue,
    lossValue,
  };
}

export function getUnusualInventoryLosses(count, options = {}) {
  if (!isInventoryCountFinalized(count)) {
    return { isUnusual: false, totalLossValue: 0, affectedItems: 0, items: [] };
  }

  const minimumItemLoss = Number(options.minimumItemLoss ?? 5);
  const minimumItemLossPercent = Number(options.minimumItemLossPercent ?? 10);
  const minimumTotalLoss = Number(options.minimumTotalLoss ?? 25);
  const items = (Array.isArray(count?.entries) ? count.entries : [])
    .map(entry => {
      const expected = Number(entry?.hypothetical) || 0;
      const counted = Number(entry?.counted) || 0;
      const quantityLoss = Math.max(0, expected - counted);
      const lossValue = quantityLoss * (Number(entry?.unitCost) || 0);
      const lossPercent = expected > 0 ? (quantityLoss / expected) * 100 : 0;
      return {
        itemId: entry?.itemId || '',
        name: entry?.name || 'Inventory item',
        unit: entry?.unit || 'ea',
        quantityLoss,
        lossValue,
        lossPercent,
        storageArea: entry?.storageArea || 'Unassigned',
      };
    })
    .filter(item => item.lossValue >= minimumItemLoss && item.lossPercent >= minimumItemLossPercent)
    .sort((left, right) => right.lossValue - left.lossValue);
  const totalLossValue = items.reduce((sum, item) => sum + item.lossValue, 0);

  return {
    isUnusual: totalLossValue >= minimumTotalLoss || items.some(item => item.lossPercent >= 25),
    totalLossValue,
    affectedItems: items.length,
    items,
  };
}
