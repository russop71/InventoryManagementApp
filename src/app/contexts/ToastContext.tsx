import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useInventory, type Recipe } from './InventoryContext';
import { locationScopedStorageKey, readScopedJson } from '../utils/storageScope';
import { apiRequest } from '../utils/api';

export interface ToastSalesData {
  date: string;
  covers: number;
  revenue: number;
  topItems: { itemName: string; quantity: number; revenue: number }[];
}

export interface ToastMenuItem {
  id: string;
  name: string;
  category: string;
  cogsCategoryId?: string;
  price: number;
  ingredients: { inventoryItemId: string; quantity: number }[];
}

export interface CogsCategory { id: string; name: string; color: string }

export interface PosImportPayload {
  provider?: string;
  date?: string;
  period?: string;
  covers?: number;
  revenue?: number;
  rows?: Record<string, unknown>[];
  salesData?: ToastSalesData[];
  history?: ToastSalesData[];
  menuItems?: ToastMenuItem[];
  [key: string]: unknown;
}

interface PosState {
  connected: boolean;
  provider?: string;
  connectionMode?: 'import' | 'direct';
  restaurantId?: string;
  salesData: ToastSalesData[];
  menuItems: ToastMenuItem[];
  cogsCategories: CogsCategory[];
  lastSync: string | null;
}

interface ToastIntegrationPayload { toast: PosState }

interface ToastContextType {
  isConnected: boolean;
  provider: string;
  connectionMode: 'import' | 'direct';
  restaurantId: string;
  salesData: ToastSalesData[];
  menuItems: ToastMenuItem[];
  cogsCategories: CogsCategory[];
  selectPosProvider: (provider: string) => void;
  disconnectToast: () => void;
  syncData: () => Promise<void>;
  importSalesData: (payload: PosImportPayload) => Promise<void>;
  addCogsCategory: (name: string) => void;
  updateCogsCategory: (id: string, name: string) => void;
  deleteCogsCategory: (id: string) => void;
  assignMenuItemCogsCategory: (itemId: string, categoryId: string) => void;
  lastSync: string | null;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { accountId, activeLocationId, token, user } = useAuth();
  const { recipes, syncToastMenuItems } = useInventory();
  const isDemoAccount = user?.email?.trim().toLowerCase() === 'demo@zestiq.com';
  const [isHydrated, setIsHydrated] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [provider, setProvider] = useState('generic');
  const [connectionMode, setConnectionMode] = useState<'import' | 'direct'>('import');
  const [restaurantId, setRestaurantId] = useState('');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [cogsCategories, setCogsCategories] = useState<CogsCategory[]>([]);
  const [salesData, setSalesData] = useState<ToastSalesData[]>([]);
  const [menuItems, setMenuItems] = useState<ToastMenuItem[]>([]);

  const buildMenuItemsFromRecipes = (sourceRecipes: Recipe[]): ToastMenuItem[] => sourceRecipes.map(recipe => ({
    id: recipe.externalId || recipe.id,
    name: recipe.menuItemName,
    category: recipe.category,
    cogsCategoryId: recipe.source === 'toast' ? recipe.externalId : undefined,
    price: recipe.price,
    ingredients: recipe.ingredients.map(ingredient => ({ inventoryItemId: ingredient.inventoryItemId, quantity: ingredient.quantity })),
  }));

  const buildDemoSales = (items: ToastMenuItem[]): ToastSalesData[] => Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const topItems = items.slice(0, 6).map((item, itemIndex) => {
      const quantity = 12 + ((index * 7 + itemIndex * 5) % 28);
      return { itemName: item.name, quantity, revenue: quantity * Math.max(item.price, 1) };
    }).sort((left, right) => right.revenue - left.revenue).slice(0, 5);
    const revenue = topItems.reduce((sum, item) => sum + item.revenue, 0);
    return { date: date.toISOString().split('T')[0], covers: Math.max(1, Math.round(revenue / 31)), revenue, topItems };
  });

  const demoState = () => {
    const recipeItems = buildMenuItemsFromRecipes(recipes);
    const items = recipeItems.length > 0 ? recipeItems : [
      { id: 'demo-burger', name: 'Brunch Burger', category: 'Food', price: 24, ingredients: [] },
      { id: 'demo-salmon', name: 'Cedar Salmon', category: 'Food', price: 34, ingredients: [] },
      { id: 'demo-negroni', name: 'House Negroni', category: 'Cocktail', price: 16, ingredients: [] },
    ];
    return { items, sales: buildDemoSales(items) };
  };

  useEffect(() => {
    if (!accountId || !activeLocationId) {
      setIsConnected(false); setProvider('generic'); setConnectionMode('import'); setRestaurantId('');
      setLastSync(null); setCogsCategories([]); setSalesData([]); setMenuItems([]); setIsHydrated(false);
      return;
    }

    const read = <T,>(name: string, fallback: T) => readScopedJson<T>(locationScopedStorageKey(accountId, activeLocationId, name), fallback);
    const restoreLocal = () => {
      const restoredSales = read<ToastSalesData[]>('toastSalesData', []);
      const restoredMenu = read<ToastMenuItem[]>('toastMenuItems', []);
      const demo = isDemoAccount && (!restoredSales.length || !restoredMenu.length) ? demoState() : null;
      const nextSales = restoredSales.length ? restoredSales : demo?.sales || [];
      const nextMenu = restoredMenu.length ? restoredMenu : demo?.items || [];
      setProvider(read<string>('posProvider', isDemoAccount ? 'toast' : 'generic'));
      setConnectionMode(read<'import' | 'direct'>('posConnectionMode', 'import'));
      setRestaurantId(read<string>('toastRestaurantId', ''));
      setLastSync(read<string | null>('toastLastSync', isDemoAccount ? new Date().toISOString() : null));
      setCogsCategories(read<CogsCategory[]>('toastCogsCategories', []));
      setSalesData(nextSales); setMenuItems(nextMenu);
      setIsConnected(read<boolean>('toastConnected', false) || nextSales.length > 0 || nextMenu.length > 0);
      setIsHydrated(true);
    };

    const restoreServer = async () => {
      if (!token) return restoreLocal();
      try {
        const payload = await apiRequest<ToastIntegrationPayload>(`/api/v1/accounts/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(activeLocationId)}/integrations/toast`);
        const state = payload.toast || {} as PosState;
        const hasSales = Array.isArray(state.salesData) && state.salesData.length > 0;
        const hasMenu = Array.isArray(state.menuItems) && state.menuItems.length > 0;
        const demo = isDemoAccount && (!hasSales || !hasMenu) ? demoState() : null;
        const nextSales = hasSales ? state.salesData : demo?.sales || [];
        const nextMenu = hasMenu ? state.menuItems : demo?.items || [];
        setProvider(state.provider || (isDemoAccount ? 'toast' : 'generic'));
        setConnectionMode(state.connectionMode === 'direct' ? 'direct' : 'import');
        setRestaurantId(state.restaurantId || ''); setLastSync(state.lastSync || (isDemoAccount ? new Date().toISOString() : null));
        setCogsCategories(state.cogsCategories || []); setSalesData(nextSales); setMenuItems(nextMenu);
        setIsConnected(Boolean(state.connected || nextSales.length || nextMenu.length));
        setIsHydrated(true);
      } catch { restoreLocal(); }
    };
    void restoreServer();
  }, [accountId, activeLocationId, token, isDemoAccount]);

  useEffect(() => {
    if (!accountId || !activeLocationId || !isHydrated) return;
    const write = (name: string, value: unknown) => localStorage.setItem(locationScopedStorageKey(accountId, activeLocationId, name), JSON.stringify(value));
    write('toastConnected', isConnected); write('posProvider', provider); write('posConnectionMode', connectionMode);
    write('toastRestaurantId', restaurantId); write('toastLastSync', lastSync); write('toastCogsCategories', cogsCategories);
    write('toastSalesData', salesData); write('toastMenuItems', menuItems);
    if (!token) return;
    void apiRequest(`/api/v1/accounts/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(activeLocationId)}/integrations/toast`, {
      method: 'PUT',
      body: JSON.stringify({ connected: isConnected, provider, connectionMode, restaurantId, salesData, menuItems, cogsCategories, lastSync }),
    }).catch(error => console.error('Failed to save POS integration state', error));
  }, [accountId, activeLocationId, token, isHydrated, isConnected, provider, connectionMode, restaurantId, lastSync, cogsCategories, salesData, menuItems]);

  const selectPosProvider = (nextProvider: string) => setProvider(nextProvider || 'generic');

  const disconnectToast = () => {
    setIsConnected(false); setConnectionMode('import'); setRestaurantId(''); setLastSync(null);
    setSalesData([]); setMenuItems([]); syncToastMenuItems([]);
  };

  const importSalesData = async (payload: PosImportPayload) => {
    if (!accountId || !activeLocationId) throw new Error('Choose a restaurant location before importing sales');
    const selectedProvider = String(payload.provider || provider || 'generic');
    const imported = await apiRequest<ToastIntegrationPayload>(
      `/api/v1/accounts/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(activeLocationId)}/integrations/toast/import`,
      { method: 'POST', body: JSON.stringify({ ...payload, provider: selectedProvider }) },
    );
    const next = imported.toast;
    if (!next?.salesData?.length) throw new Error('No valid sales rows were found in that export');
    const nextMenu = next.menuItems || [];
    setProvider(next.provider || selectedProvider); setConnectionMode('import'); setIsConnected(true);
    setSalesData(next.salesData); setMenuItems(nextMenu); setLastSync(next.lastSync || new Date().toISOString());
    syncToastMenuItems(nextMenu);
  };

  const syncData = async () => {
    if (!isConnected || !salesData.length) throw new Error('Import sales or activate a direct connector first');
    await importSalesData({ provider, salesData, menuItems });
  };

  const addCogsCategory = (name: string) => {
    const normalized = name.trim();
    if (!normalized) return;
    setCogsCategories(previous => [...previous, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: normalized, color: ['#F59E0B', '#8B5CF6', '#DC2626', '#0EA5E9', '#14B8A6', '#F97316'][previous.length % 6] }]);
  };
  const updateCogsCategory = (id: string, name: string) => setCogsCategories(previous => previous.map(category => category.id === id ? { ...category, name: name.trim() || category.name } : category));
  const deleteCogsCategory = (id: string) => {
    setCogsCategories(previous => previous.filter(category => category.id !== id));
    setMenuItems(previous => previous.map(item => item.cogsCategoryId === id ? { ...item, cogsCategoryId: undefined } : item));
  };
  const assignMenuItemCogsCategory = (itemId: string, categoryId: string) => setMenuItems(previous => previous.map(item => item.id === itemId ? { ...item, cogsCategoryId: categoryId } : item));

  return <ToastContext.Provider value={{ isConnected, provider, connectionMode, restaurantId, salesData, menuItems, cogsCategories, selectPosProvider, disconnectToast, syncData, importSalesData, addCogsCategory, updateCogsCategory, deleteCogsCategory, assignMenuItemCogsCategory, lastSync }}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
}
