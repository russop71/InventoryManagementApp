export function mergeLocationData(localData, remoteData) {
  const inventory = Array.isArray(remoteData?.inventory) ? remoteData.inventory : localData.inventory;
  const recipes = Array.isArray(remoteData?.recipes) ? remoteData.recipes : localData.recipes;
  const storageAreas = Array.isArray(remoteData?.storageAreas) ? remoteData.storageAreas : localData.storageAreas;
  const orders = Array.isArray(remoteData?.orders) ? remoteData.orders : localData.orders;
  const invoices = Array.isArray(remoteData?.invoices) ? remoteData.invoices : localData.invoices;
  const suppliers = Array.isArray(remoteData?.suppliers) ? remoteData.suppliers : localData.suppliers;
  const preppedRecipes = Array.isArray(remoteData?.preppedRecipes) ? remoteData.preppedRecipes : localData.preppedRecipes;
  const inventoryCounts = Array.isArray(remoteData?.inventoryCounts) ? remoteData.inventoryCounts : localData.inventoryCounts;

  return {
    inventory,
    recipes,
    storageAreas,
    orders,
    invoices,
    suppliers,
    preppedRecipes,
    inventoryCounts,
  };
}
