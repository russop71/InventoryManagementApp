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

const DEMO_COGS_CATEGORIES: CogsCategory[] = [
  { id: 'demo-food', name: 'Food', color: '#F59E0B' },
  { id: 'demo-beverage', name: 'Beverage', color: '#8B5CF6' },
];

function demoCogsCategory(category: string) {
  return ['wine', 'cocktail', 'beer', 'beverage'].includes(String(category || '').trim().toLowerCase())
    ? 'demo-beverage'
    : 'demo-food';
}

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
    cogsCategoryId: demoCogsCategory(recipe.category),
    price: recipe.price,
    ingredients: recipe.ingredients.map(ingredient => ({ inventoryItemId: ingredient.inventoryItemId, quantity: ingredient.quantity })),
  }));

  const buildDemoSales = (items: ToastMenuItem[]): ToastSalesData[] => Array.from({ length: 30 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - index));
    const dayOfWeek = date.getDay();
    const demandFactor = dayOfWeek === 5 || dayOfWeek === 6 ? 1.35 : dayOfWeek === 0 ? 1.18 : 0.94;
    const topItems = items.map((item, itemIndex) => {
      const menuMix = Math.max(0.58, 1.32 - itemIndex * 0.045);
      const baseQuantity = 16 + ((index * 11 + itemIndex * 7) % 34);
      const quantity = Math.max(1, Math.round(baseQuantity * demandFactor * menuMix));
      return { itemName: item.name, quantity, revenue: quantity * Math.max(item.price, 1) };
    }).sort((left, right) => right.revenue - left.revenue);
    const revenue = topItems.reduce((sum, item) => sum + item.revenue, 0);
    return { date: date.toISOString().split('T')[0], covers: Math.max(1, Math.round(revenue / 42)), revenue, topItems };
  });

  const demoState = () => {
    const recipeItems = buildMenuItemsFromRecipes(recipes);
    const items = recipeItems.length > 0 ? recipeItems : [
      { id: 'demo-burger', name: 'Brunch Burger', category: 'Food', price: 24, ingredients: [] },
      { id: 'demo-salmon', name: 'Cedar Salmon', category: 'Food', price: 34, ingredients: [] },
      { id: 'demo-negroni', name: 'House Negroni', category: 'Cocktail', price: 16, ingredients: [] },
    ];
    return { items, sales: buildDemoSales(items), cogsCategories: DEMO_COGS_CATEGORIES };
  };

  useEffect(() => {
    if (!accountId || !activeLocationId) {
      setIsConnected(false); setProvider('generic'); setConnectionMode('import'); setRestaurantId('');
      setLastSync(null); setCogsCategories([]); setSalesData([]); setMenuItems([]); setIsHydrated(false);
      return;
    }

    const read = <T,>(name: string, fallback: T) => readScopedJson<T>(locationScopedStorageKey(accountId, activeLocationId, name), fallback);
    const restoreLocal = () => {
      if (isDemoAccount) {
        const demo = demoState();
        setProvider('toast'); setConnectionMode('direct'); setRestaurantId('zestiq-demo-restaurant');
        setLastSync(new Date().toISOString()); setCogsCategories(demo.cogsCategories);
        setSalesData(demo.sales); setMenuItems(demo.items); setIsConnected(true); setIsHydrated(true);
        return;
      }
      const restoredSales = read<ToastSalesData[]>('toastSalesData', []);
      const restoredMenu = read<ToastMenuItem[]>('toastMenuItems', []);
      const nextSales = restoredSales;
      const nextMenu = restoredMenu;
      setProvider(read<string>('posProvider', 'generic'));
      setConnectionMode(read<'import' | 'direct'>('posConnectionMode', 'import'));
      setRestaurantId(read<string>('toastRestaurantId', ''));
      setLastSync(read<string | null>('toastLastSync', null));
      setCogsCategories(read<CogsCategory[]>('toastCogsCategories', []));
      setSalesData(nextSales); setMenuItems(nextMenu);
      setIsConnected(read<boolean>('toastConnected', false) || nextSales.length > 0 || nextMenu.length > 0);
      setIsHydrated(true);
    };

    const restoreServer = async () => {
      if (!token) return restoreLocal();
      try {
        const payload = await apiRequest<ToastIntegrationPayload>(`/api/v1/accounts/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(activeLocationId)}/integrations/toast`);
        if (isDemoAccount) {
          const demo = demoState();
          setProvider('toast'); setConnectionMode('direct'); setRestaurantId('zestiq-demo-restaurant');
          setLastSync(new Date().toISOString()); setCogsCategories(demo.cogsCategories);
          setSalesData(demo.sales); setMenuItems(demo.items); setIsConnected(true); setIsHydrated(true);
          return;
        }
        const state = payload.toast || {} as PosState;
        const hasSales = Array.isArray(state.salesData) && state.salesData.length > 0;
        const hasMenu = Array.isArray(state.menuItems) && state.menuItems.length > 0;
        const nextSales = hasSales ? state.salesData : [];
        const nextMenu = hasMenu ? state.menuItems : [];
        setProvider(state.provider || 'generic');
        setConnectionMode(state.connectionMode === 'direct' ? 'direct' : 'import');
        setRestaurantId(state.restaurantId || ''); setLastSync(state.lastSync || null);
        setCogsCategories(state.cogsCategories || []); setSalesData(nextSales); setMenuItems(nextMenu);
        setIsConnected(Boolean(state.connected || nextSales.length || nextMenu.length));
        setIsHydrated(true);
      } catch { restoreLocal(); }
    };
    void restoreServer();
  }, [accountId, activeLocationId, token, isDemoAccount]);

  useEffect(() => {
    if (!isDemoAccount || !isHydrated || recipes.length === 0) return;
    const demo = demoState();
    setProvider('toast'); setConnectionMode('direct'); setRestaurantId('zestiq-demo-restaurant');
    setLastSync(new Date().toISOString()); setCogsCategories(demo.cogsCategories);
    setSalesData(demo.sales); setMenuItems(demo.items); setIsConnected(true);
  }, [isDemoAccount, isHydrated, recipes]);

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

  const selectPosProvider = (nextProvider: string) => setProvider(isDemoAccount ? 'toast' : (nextProvider || 'generic'));

  const disconnectToast = () => {
    if (isDemoAccount) {
      const demo = demoState();
      setIsConnected(true); setProvider('toast'); setConnectionMode('direct'); setRestaurantId('zestiq-demo-restaurant');
      setLastSync(new Date().toISOString()); setCogsCategories(demo.cogsCategories); setSalesData(demo.sales); setMenuItems(demo.items);
      syncToastMenuItems(demo.items);
      return;
    }
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
