import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useInventory, type Recipe, type ToastMenuItem as InventoryToastMenuItem } from './InventoryContext';
import { locationScopedStorageKey, readScopedJson } from '../utils/storageScope';
import { apiRequest } from '../utils/api';

export interface ToastSalesData {
  date: string;
  covers: number;
  revenue: number;
  topItems: {
    itemName: string;
    quantity: number;
    revenue: number;
  }[];
}

export interface ToastMenuItem {
  id: string;
  name: string;
  category: string;
  cogsCategoryId?: string;
  price: number;
  ingredients: {
    inventoryItemId: string;
    quantity: number;
  }[];
}

export interface CogsCategory {
  id: string;
  name: string;
  color: string;
}

interface ToastIntegrationPayload {
  toast: {
    connected: boolean;
    apiKey: string;
    restaurantId: string;
    salesData: ToastSalesData[];
    menuItems: ToastMenuItem[];
    cogsCategories: CogsCategory[];
    lastSync: string | null;
  };
}

interface ToastContextType {
  isConnected: boolean;
  apiKey: string;
  restaurantId: string;
  salesData: ToastSalesData[];
  menuItems: ToastMenuItem[];
  cogsCategories: CogsCategory[];
  connectToast: (apiKey: string, restaurantId: string) => void;
  disconnectToast: () => void;
  syncData: () => Promise<void>;
  importSalesData: (payload: { salesData?: ToastSalesData[]; history?: ToastSalesData[]; menuItems?: ToastMenuItem[] }) => Promise<void>;
  addCogsCategory: (name: string) => void;
  updateCogsCategory: (id: string, name: string) => void;
  deleteCogsCategory: (id: string) => void;
  assignMenuItemCogsCategory: (itemId: string, categoryId: string) => void;
  lastSync: string | null;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);
const SALES_INTEGRATION_PAUSED = true;

export function ToastProvider({ children }: { children: ReactNode }) {
  const { accountId, activeLocationId, token } = useAuth();
  const { recipes, inventory, syncToastMenuItems } = useInventory();

  const buildToastMenuItemsFromRecipes = (sourceRecipes: Recipe[]): ToastMenuItem[] => {
    return sourceRecipes
      .map(recipe => ({
        id: recipe.externalId || recipe.id,
        name: recipe.menuItemName,
        category: recipe.category,
        cogsCategoryId: recipe.source === 'toast' ? recipe.externalId : undefined,
        price: recipe.price,
        ingredients: recipe.ingredients.map(ingredient => ({
          inventoryItemId: ingredient.inventoryItemId,
          quantity: ingredient.quantity,
        })),
      }));
  };

  const buildFallbackToastState = (sourceRecipes: Recipe[]) => {
    const fallbackMenuItems = buildToastMenuItemsFromRecipes(sourceRecipes);
    const seededMenuItems = fallbackMenuItems.length > 0
      ? fallbackMenuItems
      : [
          { id: 'demo-toast-brunch-burger', name: 'Brunch Burger', category: 'Sandwich', price: 24, ingredients: [] },
          { id: 'demo-toast-margherita-pizza', name: 'Margherita Pizza', category: 'Pizza', price: 22, ingredients: [] },
          { id: 'demo-toast-chicken-sandwich', name: 'Chicken Sandwich', category: 'Sandwich', price: 19, ingredients: [] },
        ];

    return {
      menuItems: seededMenuItems,
      salesData: buildToastSalesData(seededMenuItems),
    };
  };

  const buildToastSalesData = (sourceMenuItems: ToastMenuItem[]): ToastSalesData[] => {
    const dates = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      return date.toISOString().split('T')[0];
    });

    return dates.map((date, dayIndex) => {
      const topItems = sourceMenuItems.length > 0
        ? sourceMenuItems
            .map((item, itemIndex) => {
              const baseVolume = Math.max(2, Math.round((item.price / 14) + ((dayIndex + itemIndex) % 3) + 1));
              const volumeMultiplier = dayIndex % 2 === 0 ? 1.1 : 0.95;
              const quantity = Math.max(1, Math.round(baseVolume * volumeMultiplier));
              return {
                itemName: item.name,
                quantity,
                revenue: quantity * Math.max(item.price, 1),
              };
            })
            .sort((left, right) => right.revenue - left.revenue)
            .slice(0, 5)
        : [];

      const revenue = topItems.reduce((sum, item) => sum + item.revenue, 0);
      const covers = Math.max(1, Math.round(revenue / 24));

      return {
        date,
        covers,
        revenue,
        topItems,
      };
    });
  };

  const buildSeededToastState = (sourceRecipes: Recipe[]) => {
    const fallbackMenuItems = buildToastMenuItemsFromRecipes(sourceRecipes);
    const seededMenuItems = fallbackMenuItems.length > 0
      ? fallbackMenuItems
      : [
          { id: 'toast-demo-burger', name: 'Brunch Burger', category: 'Sandwich', price: 24, ingredients: [] },
          { id: 'toast-demo-pizza', name: 'Margherita Pizza', category: 'Pizza', price: 22, ingredients: [] },
          { id: 'toast-demo-sandwich', name: 'Chicken Sandwich', category: 'Sandwich', price: 19, ingredients: [] },
        ];

    return {
      menuItems: seededMenuItems,
      salesData: buildToastSalesData(seededMenuItems),
    };
  };

  const [isHydrated, setIsHydrated] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [restaurantId, setRestaurantId] = useState('');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [cogsCategories, setCogsCategories] = useState<CogsCategory[]>([]);
  const [salesData, setSalesData] = useState<ToastSalesData[]>(() => (SALES_INTEGRATION_PAUSED ? [] : buildToastSalesData([])));
  const [menuItems, setMenuItems] = useState<ToastMenuItem[]>([]);

  useEffect(() => {
    if (!accountId || !activeLocationId) {
      setIsConnected(false);
      setApiKey('');
      setRestaurantId('');
      setLastSync(null);
      setCogsCategories([]);
      setSalesData([]);
      setMenuItems([]);
      setIsHydrated(false);
      return;
    }

    if (SALES_INTEGRATION_PAUSED) {
      setIsConnected(false);
      setApiKey('');
      setRestaurantId('');
      setLastSync(null);
      setCogsCategories([]);
      setSalesData([]);
      setMenuItems([]);
      setIsHydrated(true);
      return;
    }

    const key = (name: string) => locationScopedStorageKey(accountId, activeLocationId, name);
    const readWithLegacyJson = <T,>(name: string, fallback: T): T => {
      const scopedKey = key(name);
      const scopedRaw = localStorage.getItem(scopedKey);
      if (scopedRaw !== null) {
        return readScopedJson<T>(scopedKey, fallback);
      }

      const legacyRaw = localStorage.getItem(name);
      if (legacyRaw !== null) {
        localStorage.setItem(scopedKey, legacyRaw);
        try {
          return JSON.parse(legacyRaw) as T;
        } catch {
          return fallback;
        }
      }

      return fallback;
    };

    const readWithLegacyString = (name: string, fallback: string): string => {
      const scopedKey = key(name);
      const scopedRaw = localStorage.getItem(scopedKey);
      if (scopedRaw !== null) {
        try {
          return JSON.parse(scopedRaw) as string;
        } catch {
          return scopedRaw;
        }
      }

      const legacyRaw = localStorage.getItem(name);
      if (legacyRaw !== null) {
        localStorage.setItem(scopedKey, JSON.stringify(legacyRaw));
        return legacyRaw;
      }

      return fallback;
    };

    const restoreFromLocal = () => {
        const restoredConnected = readWithLegacyJson<boolean>('toastConnected', false);
        const restoredApiKey = readWithLegacyString('toastApiKey', '');
        const restoredRestaurantId = readWithLegacyString('toastRestaurantId', '');
        const restoredLastSync = readWithLegacyJson<string | null>('toastLastSync', null);
        const restoredCogsCategories = readWithLegacyJson<CogsCategory[]>('toastCogsCategories', []);
        const restoredSalesData = readWithLegacyJson<ToastSalesData[]>('toastSalesData', []);
        const restoredMenuItems = readWithLegacyJson<ToastMenuItem[]>('toastMenuItems', []);
        const fallbackToastState = buildFallbackToastState(recipes);
        const nextMenuItems = restoredMenuItems.length > 0 ? restoredMenuItems : fallbackToastState.menuItems;
        const nextSalesData = restoredSalesData.length > 0 ? restoredSalesData : fallbackToastState.salesData;

        setIsConnected(restoredConnected);
        setApiKey(restoredApiKey);
        setRestaurantId(restoredRestaurantId);
        setLastSync(restoredLastSync);
        setCogsCategories(restoredCogsCategories);
        setSalesData(nextSalesData);
        setMenuItems(nextMenuItems);
        setIsHydrated(true);
    };

    const restoreFromServer = async () => {
      if (!token) {
        restoreFromLocal();
        return;
      }

      try {
        const payload = await apiRequest<ToastIntegrationPayload>(`/api/v1/accounts/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(activeLocationId)}/integrations/toast`);
        const serverToast = payload.toast || {};
        const hasServerSales = Array.isArray(serverToast.salesData) && serverToast.salesData.length > 0;
        const hasServerMenuItems = Array.isArray(serverToast.menuItems) && serverToast.menuItems.length > 0;
        const fallbackToastState = buildSeededToastState(recipes);
        const nextMenuItems = hasServerMenuItems ? serverToast.menuItems : fallbackToastState.menuItems;
        const nextSalesData = hasServerSales ? serverToast.salesData : fallbackToastState.salesData;

        setIsConnected(Boolean(serverToast.connected || hasServerSales || hasServerMenuItems || true));
        setApiKey(serverToast.apiKey || '');
        setRestaurantId(serverToast.restaurantId || '');
        setLastSync(serverToast.lastSync || null);
        setCogsCategories(serverToast.cogsCategories || []);
        setSalesData(nextSalesData);
        setMenuItems(nextMenuItems);
        setIsHydrated(true);
      } catch {
        restoreFromLocal();
      }
    };

    void restoreFromServer();
  }, [accountId, activeLocationId, token]);

  useEffect(() => {
    if (!accountId || !activeLocationId || !isHydrated) return;
    localStorage.setItem(locationScopedStorageKey(accountId, activeLocationId, 'toastSalesData'), JSON.stringify(salesData));
    if (!token) return;
    void apiRequest(`/api/v1/accounts/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(activeLocationId)}/integrations/toast`, {
      method: 'PUT',
      body: JSON.stringify({
        connected: isConnected,
        apiKey,
        restaurantId,
        salesData,
        menuItems,
        cogsCategories,
        lastSync,
      }),
    }).catch(error => {
      console.error('Failed to sync Toast integration state', error);
    });
  }, [salesData, accountId, activeLocationId, isHydrated, isConnected, apiKey, restaurantId, menuItems, cogsCategories, lastSync, token]);

  useEffect(() => {
    if (!accountId || !activeLocationId || !isHydrated) return;
    localStorage.setItem(locationScopedStorageKey(accountId, activeLocationId, 'toastMenuItems'), JSON.stringify(menuItems));
  }, [menuItems, accountId, activeLocationId, isHydrated]);

  useEffect(() => {
    if (SALES_INTEGRATION_PAUSED) return;
    if (!accountId || !activeLocationId || !isHydrated) return;
    if (salesData.length > 0 || menuItems.length > 0) return;

    const fallbackToastState = buildSeededToastState(recipes);
    setIsConnected(true);
    setMenuItems(fallbackToastState.menuItems);
    setSalesData(fallbackToastState.salesData);
    setLastSync(new Date().toISOString());
  }, [accountId, activeLocationId, isHydrated, recipes, salesData.length, menuItems.length]);

  useEffect(() => {
    if (!accountId || !activeLocationId || !isHydrated) return;
    localStorage.setItem(locationScopedStorageKey(accountId, activeLocationId, 'toastCogsCategories'), JSON.stringify(cogsCategories));
  }, [cogsCategories, accountId, activeLocationId, isHydrated]);

  useEffect(() => {
    if (!accountId || !activeLocationId || !isHydrated) return;
    localStorage.setItem(locationScopedStorageKey(accountId, activeLocationId, 'toastConnected'), JSON.stringify(isConnected));
  }, [isConnected, accountId, activeLocationId, isHydrated]);

  useEffect(() => {
    if (!accountId || !activeLocationId || !isHydrated) return;
    localStorage.setItem(locationScopedStorageKey(accountId, activeLocationId, 'toastApiKey'), JSON.stringify(apiKey));
  }, [apiKey, accountId, activeLocationId, isHydrated]);

  useEffect(() => {
    if (!accountId || !activeLocationId || !isHydrated) return;
    localStorage.setItem(locationScopedStorageKey(accountId, activeLocationId, 'toastRestaurantId'), JSON.stringify(restaurantId));
  }, [restaurantId, accountId, activeLocationId, isHydrated]);

  useEffect(() => {
    if (!accountId || !activeLocationId || !isHydrated) return;
    localStorage.setItem(locationScopedStorageKey(accountId, activeLocationId, 'toastLastSync'), JSON.stringify(lastSync));
  }, [lastSync, accountId, activeLocationId, isHydrated]);

  const connectToast = (key: string, id: string) => {
    if (SALES_INTEGRATION_PAUSED) {
      setApiKey('');
      setRestaurantId('');
      setIsConnected(false);
      setLastSync(null);
      setSalesData([]);
      setMenuItems([]);
      syncToastMenuItems([]);
      return;
    }

    setApiKey(key);
    setRestaurantId(id);
    setIsConnected(true);
    setLastSync(new Date().toISOString());

    const seededMenuItems = buildToastMenuItemsFromRecipes(recipes);
    const seededSalesData = buildToastSalesData(seededMenuItems.length > 0 ? seededMenuItems : [
      { id: 'toast-demo-burger', name: 'Brunch Burger', category: 'Sandwich', price: 24, ingredients: [] },
      { id: 'toast-demo-pizza', name: 'Margherita Pizza', category: 'Pizza', price: 22, ingredients: [] },
      { id: 'toast-demo-sandwich', name: 'Chicken Sandwich', category: 'Sandwich', price: 19, ingredients: [] },
    ]);

    setMenuItems(seededMenuItems.length > 0 ? seededMenuItems : [
      { id: 'toast-demo-burger', name: 'Brunch Burger', category: 'Sandwich', price: 24, ingredients: [] },
      { id: 'toast-demo-pizza', name: 'Margherita Pizza', category: 'Pizza', price: 22, ingredients: [] },
      { id: 'toast-demo-sandwich', name: 'Chicken Sandwich', category: 'Sandwich', price: 19, ingredients: [] },
    ]);
    setSalesData(seededSalesData);
    syncToastMenuItems(seededMenuItems.length > 0 ? seededMenuItems : [
      { id: 'toast-demo-burger', name: 'Brunch Burger', category: 'Sandwich', price: 24, ingredients: [] },
      { id: 'toast-demo-pizza', name: 'Margherita Pizza', category: 'Pizza', price: 22, ingredients: [] },
      { id: 'toast-demo-sandwich', name: 'Chicken Sandwich', category: 'Sandwich', price: 19, ingredients: [] },
    ]);
    void syncData();
  };

  const disconnectToast = () => {
    setIsConnected(false);
    setApiKey('');
    setRestaurantId('');
    setLastSync(null);
    setSalesData([]);
    setMenuItems([]);
    syncToastMenuItems([]);
  };

  const addCogsCategory = (name: string) => {
    const normalized = name.trim();
    if (!normalized) return;
    const newCategory: CogsCategory = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: normalized,
      color: ['#F59E0B','#8B5CF6','#DC2626','#0EA5E9','#14B8A6','#F97316'][cogsCategories.length % 6],
    };
    setCogsCategories(prev => [...prev, newCategory]);
  };

  const updateCogsCategory = (id: string, name: string) => {
    setCogsCategories(prev => prev.map(cat => cat.id === id ? { ...cat, name: name.trim() || cat.name } : cat));
  };

  const deleteCogsCategory = (id: string) => {
    setCogsCategories(prev => prev.filter(cat => cat.id !== id));
    setMenuItems(prev => prev.map(item => item.cogsCategoryId === id ? { ...item, cogsCategoryId: prev[0]?.id || undefined } : item));
  };

  const assignMenuItemCogsCategory = (itemId: string, categoryId: string) => {
    setMenuItems(prev => prev.map(item => item.id === itemId ? { ...item, cogsCategoryId: categoryId } : item));
  };

  const importSalesData = async (payload: { salesData?: ToastSalesData[]; history?: ToastSalesData[]; menuItems?: ToastMenuItem[] }) => {
    if (SALES_INTEGRATION_PAUSED) {
      setIsConnected(false);
      setApiKey('');
      setRestaurantId('');
      setLastSync(null);
      setSalesData([]);
      setMenuItems([]);
      syncToastMenuItems([]);
      return;
    }

    if (!accountId || !activeLocationId) return;

    try {
      const imported = await apiRequest<{ toast: { connected: boolean; apiKey: string; restaurantId: string; salesData: ToastSalesData[]; menuItems: ToastMenuItem[]; cogsCategories: CogsCategory[]; lastSync: string | null } }>(
        `/api/v1/accounts/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(activeLocationId)}/integrations/toast/import`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      );

      const nextToast = imported.toast || {};
      const nextMenuItems = nextToast.menuItems && nextToast.menuItems.length > 0
        ? nextToast.menuItems
        : buildToastMenuItemsFromRecipes(recipes);
      const nextSalesData = nextToast.salesData && nextToast.salesData.length > 0
        ? nextToast.salesData
        : buildToastSalesData(nextMenuItems);

      setMenuItems(nextMenuItems);
      setSalesData(nextSalesData);
      setApiKey(nextToast.apiKey || apiKey);
      setRestaurantId(nextToast.restaurantId || restaurantId);
      setLastSync(nextToast.lastSync || new Date().toISOString());
      setIsConnected(Boolean(nextToast.connected || true));
      syncToastMenuItems(nextMenuItems);
    } catch (error) {
      console.error('Failed to import Toast POS data', error);
      const syncedMenuItems = buildToastMenuItemsFromRecipes(recipes);
      const nextSalesData = buildToastSalesData(syncedMenuItems.length > 0 ? syncedMenuItems : menuItems);

      setMenuItems(syncedMenuItems);
      setSalesData(nextSalesData);
      syncToastMenuItems(syncedMenuItems);

      const now = new Date().toISOString();
      setLastSync(now);
    }
  };

  const syncData = async () => {
    if (SALES_INTEGRATION_PAUSED) {
      setSalesData([]);
      setMenuItems([]);
      return;
    }

    await importSalesData({
      salesData: salesData.length > 0 ? salesData : [],
      menuItems: menuItems.length > 0 ? menuItems : [],
    });
  };

  useEffect(() => {
    if (SALES_INTEGRATION_PAUSED) return;
    if (!isHydrated || !isConnected) return;
    if (recipes.length === 0) return;
    if (salesData.length > 0 && menuItems.length > 0) return;
    void syncData();
  }, [isHydrated, isConnected, recipes.length, salesData.length, menuItems.length]);

  return (
    <ToastContext.Provider
      value={{
        isConnected,
        apiKey,
        restaurantId,
        salesData,
        menuItems,
        cogsCategories,
        connectToast,
        disconnectToast,
        syncData,
        importSalesData,
        addCogsCategory,
        updateCogsCategory,
        deleteCogsCategory,
        assignMenuItemCogsCategory,
        lastSync,
      }}
    >
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
