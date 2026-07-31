export function resolveSuggestionQuantity(suggestion, overrides = {}) {
  const quantity = overrides[suggestion.itemId] ?? suggestion.suggestedQuantity;
  const safeQuantity = Number.isFinite(quantity) && quantity >= 0 ? Math.max(0, Math.round(quantity)) : suggestion.suggestedQuantity;
  return {
    quantity: safeQuantity,
    totalCost: safeQuantity * suggestion.unitCost,
  };
}
