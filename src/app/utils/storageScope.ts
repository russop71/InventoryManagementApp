export const LOCATION_DATA_KEYS = [
  'inventory',
  'storageAreas',
  'recipes',
  'forecasts',
  'orders',
  'suppliers',
  'preppedRecipes',
  'toastConnected',
  'toastApiKey',
  'toastRestaurantId',
  'toastLastSync',
  'toastCogsCategories',
  'toastSalesData',
  'toastMenuItems',
  'orderAlarms',
] as const;

export function locationScopedStorageKey(accountId: string, locationId: string, key: string) {
  return `zestiq:account:${accountId}:location:${locationId}:${key}`;
}

export function accountScopedStorageKey(accountId: string, key: string) {
  return `zestiq:account:${accountId}:${key}`;
}

export function readScopedJson<T>(storageKey: string | null, fallback: T): T {
  if (!storageKey) return fallback;
  const raw = localStorage.getItem(storageKey);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function clearLocationScopedData(accountId: string, locationId: string) {
  LOCATION_DATA_KEYS.forEach(key => {
    localStorage.removeItem(locationScopedStorageKey(accountId, locationId, key));
  });
}

export function clearAllAccountScopedData(accountId: string) {
  const prefix = `zestiq:account:${accountId}:`;
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });
}
