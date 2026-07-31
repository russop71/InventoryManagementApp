function calculateDayWeight(dateString) {
  const date = new Date(dateString);
  const dayOfWeek = date.getDay();
  const month = date.getMonth() + 1;
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const season = month >= 6 && month <= 8 ? 'summer' : month >= 9 && month <= 11 ? 'fall' : month >= 12 || month <= 2 ? 'winter' : 'spring';
  return { isWeekend, season };
}

function buildForecastFromHistory({ history = [], menuItems = [], inventory = [], payload = {} }) {
  const expectedRevenue = Number(payload.expectedRevenue) || 0;
  const forecastDate = payload.date || new Date().toISOString().split('T')[0];
  const historyRevenue = history.reduce((sum, day) => sum + (Number(day.revenue) || 0), 0) / Math.max(history.length, 1);
  const revenueMultiplier = historyRevenue > 0 ? expectedRevenue / historyRevenue : 1;
  const { isWeekend, season } = calculateDayWeight(forecastDate);
  const weather = payload.weather || {};
  const events = payload.events || {};
  const tempC = Number(weather.tempC);
  const precipitationChance = Number(weather.precipitationChance) || 0;
  const isCold = Number.isFinite(tempC) && tempC <= 12;
  const isRainy = precipitationChance >= 0.6;
  const eventNames = Array.isArray(events.localEvents) ? events.localEvents.map(event => String(event).toLowerCase()) : [];
  const hasLocalEvent = eventNames.some(event => event.trim());
  const majorEvent = eventNames.some(event => /(festival|holiday|concert|fair|parade|game|expo|market|marathon)/.test(event));
  const eventBoost = hasLocalEvent ? (majorEvent ? 1.18 : 1.08) : 1;
  const weatherSignal = isCold ? 1.04 : 1;

  const predictedMenuItems = menuItems.map(menuItem => {
    const totalSold = history.reduce((sum, day) => {
      const itemSales = day.topItems?.find(item => item.itemName === menuItem.name);
      return sum + (itemSales?.quantity || 0);
    }, 0);

    const avgSold = history.length > 0 ? totalSold / history.length : 0;
    const name = String(menuItem.name || '').toLowerCase();
    const fallbackDemand = name.includes('soup') || name.includes('stew') || name.includes('pasta') || name.includes('comfort')
      ? 3
      : name.includes('special')
        ? 2
        : name.includes('salad') || name.includes('cold') || name.includes('smoothie')
          ? 2
          : 1;
    let adjusted = avgSold > 0 ? avgSold * Math.max(revenueMultiplier, 0.8) : fallbackDemand * Math.max(revenueMultiplier, 0.8);
    if (isWeekend && (name.includes('brunch') || name.includes('burger') || name.includes('pizza'))) {
      adjusted *= 1.12;
    }
    if (season === 'summer' && (name.includes('salad') || name.includes('cocktail') || name.includes('cold'))) {
      adjusted *= 1.08;
    }
    if (season === 'winter' && (name.includes('soup') || name.includes('stew') || name.includes('pasta'))) {
      adjusted *= 1.06;
    }
    if (isCold && isRainy && (name.includes('soup') || name.includes('stew') || name.includes('pasta') || name.includes('comfort'))) {
      adjusted = Math.max(adjusted, fallbackDemand * 2.5 * Math.max(revenueMultiplier, 0.8));
    } else if (isCold && (name.includes('soup') || name.includes('stew') || name.includes('pasta'))) {
      adjusted *= isRainy ? 1.2 : 1.1;
    }
    if (isRainy && (name.includes('soup') || name.includes('stew') || name.includes('pasta') || name.includes('comfort'))) {
      adjusted *= 1.08;
    }
    if (isRainy && (name.includes('salad') || name.includes('cold'))) {
      adjusted *= 0.9;
    }
    if (isCold && isRainy && (name.includes('salad') || name.includes('cold'))) {
      adjusted *= 0.88;
    }
    if (eventBoost > 1) {
      adjusted *= eventBoost;
    }
    adjusted *= weatherSignal;

    return {
      name: menuItem.name,
      quantity: Math.max(1, Math.round(adjusted)),
    };
  });

  const ingredientUsage = new Map();
  predictedMenuItems.forEach(item => {
    const menuItem = menuItems.find(candidate => candidate.name === item.name);
    if (!menuItem) return;
    menuItem.ingredients?.forEach(ingredient => {
      const currentUsage = ingredientUsage.get(ingredient.inventoryItemId) || 0;
      ingredientUsage.set(ingredient.inventoryItemId, currentUsage + item.quantity * ingredient.quantity);
    });
  });

  return {
    predictedMenuItems,
    ingredientUsage: Array.from(ingredientUsage.entries()).map(([itemId, expectedUsage]) => ({
      itemId,
      expectedUsage: Math.round(expectedUsage * 100) / 100,
    })).filter(item => inventory.some(entry => entry.id === item.itemId) || inventory.length === 0),
    summary: `Forecast prepared for ${isWeekend ? 'weekend' : 'weekday'} ${season} demand with weather and event weighting.`,
    confidence: Math.min(0.95, 0.72 + (isCold ? 0.05 : 0) + (isRainy ? 0.04 : 0) + (hasLocalEvent ? 0.03 : 0)),
  };
}

export { buildForecastFromHistory, calculateDayWeight };
