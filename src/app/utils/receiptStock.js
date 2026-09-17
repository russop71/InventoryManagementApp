// Receipts go into the item's primary storage area; retain all other areas.
export function addReceivedStock(item, quantity) {
  const locations = item.storageLocations?.length
    ? item.storageLocations.map(location => ({ ...location }))
    : [{ storageArea: item.storageArea || 'Unassigned', currentStock: Number(item.currentStock) || 0, parLevel: item.parLevel || 0 }];
  locations[0].currentStock = (Number(locations[0].currentStock) || 0) + Number(quantity);
  return {
    ...item,
    storageLocations: locations,
    currentStock: locations.reduce((sum, location) => sum + (Number(location.currentStock) || 0), 0),
    lastUpdated: new Date().toISOString(),
  };
}
