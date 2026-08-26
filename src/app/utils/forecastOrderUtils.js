export function calculateForecastOrderQuantity({ currentStock, expectedUsage, parLevel, safetyBuffer = 0, minimumOrderQty = 0 }) {
  const normalizedCurrentStock = Number(currentStock) || 0;
  const normalizedExpectedUsage = Number(expectedUsage) || 0;
  const normalizedParLevel = Number(parLevel) || 0;
  const normalizedSafetyBuffer = Number(safetyBuffer) || 0;
  const normalizedMinimumOrderQty = Number(minimumOrderQty) || 0;

  const projectedStock = normalizedCurrentStock - normalizedExpectedUsage;
  const targetStock = Math.max(normalizedParLevel, normalizedExpectedUsage + normalizedSafetyBuffer);
  const shortage = targetStock - projectedStock;
  const quantityNeeded = Math.max(0, shortage);

  return Math.max(normalizedMinimumOrderQty, Math.ceil(quantityNeeded));
}

export function estimateDemandForTomorrow({ inventoryItem, forecastItems = [], salesData = [] }) {
  const today = new Date().toISOString().slice(0, 10);
  const forecastEntry = forecastItems
    .filter(entry => Array.isArray(entry.items) && entry.items.some(item => item.itemId === inventoryItem.id))
    .sort((left, right) => String(left.date || today).localeCompare(String(right.date || today)))
    .find(entry => String(entry.date || today) >= today)
    || forecastItems.find(entry => Array.isArray(entry.items) && entry.items.some(item => item.itemId === inventoryItem.id));
  if (forecastEntry) {
    const matchingItem = forecastEntry.items.find(item => item.itemId === inventoryItem.id);
    if (matchingItem && Number(matchingItem.expectedUsage) > 0) {
      return Number(matchingItem.expectedUsage);
    }
  }

  const salesTrend = salesData.length >= 2
    ? (salesData[salesData.length - 1].revenue - salesData[0].revenue) / salesData[0].revenue
    : 0;

  let estimatedDailyUsage = inventoryItem.category === 'Produce'
    ? inventoryItem.parLevel * 0.2
    : inventoryItem.category === 'Proteins'
      ? inventoryItem.parLevel * 0.15
      : inventoryItem.category === 'Dairy'
        ? inventoryItem.parLevel * 0.12
        : inventoryItem.parLevel * 0.1;

  if (salesTrend > 0.1) estimatedDailyUsage *= 1.2;
  else if (salesTrend < -0.1) estimatedDailyUsage *= 0.85;

  return estimatedDailyUsage;
}
