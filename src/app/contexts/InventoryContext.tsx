import { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import { locationScopedStorageKey, readScopedJson } from '../utils/storageScope';
import { ApiError, apiRequest } from '../utils/api';
import { calculateForecastOrderQuantity } from '../utils/forecastOrderUtils';
import { buildDemoLocationData, DEMO_DATA_VERSION } from '../utils/demoData';
import { markDemoSessionReset, shouldResetDemoSession } from '../utils/demoSession.js';
import { mergeLocationData } from '../utils/locationDataMerge.js';
import { hasDuplicateInvoiceNumber, normalizeInventoryItemName } from '../utils/invoiceWorkflow.js';
import { findBestSupplierMatch, mergeDuplicateSuppliers, normalizeSupplierName } from '../utils/supplierMatching.js';
import type { InventoryCount } from '../utils/inventoryCounts';

const DEFAULT_STORAGE_AREAS = ['Walk-In Cooler', 'Dry Storage', 'Freezer', 'Bar', 'Wine Cellar', 'Unassigned'] as const;

function normalizeStorageArea(storageArea?: string) {
  const trimmed = storageArea?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : 'Unassigned';
}

function sortUniqueStorageAreas(storageAreas: string[]) {
  return Array.from(new Set(storageAreas.map(area => area.trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  storageArea?: string;
  sku?: string;
  vendorItemCode?: string;
  currentStock: number;
  unit: string;
  packSize?: number;
  packUnit?: string;
  unitsPerPack?: number;
  unitCost: number;
  taxRate?: number;
  taxValue?: number;
  wastePercent?: number;
  yieldPercent?: number;
  parLevel: number;
  supplier: string;
  reorderPoint?: number;
  minimumOrderQty?: number;
  leadTimeDays?: number;
  targetStockDays?: number;
  lastCountedAt?: string;
  nextCountDueAt?: string;
  lastUpdated?: string;
  notes?: string;
  history?: {
    date: string;
    change: number;
    reason: string;
    newStock: number;
  }[];
  priceHistory?: {
    date: string;
    oldPrice: number;
    newPrice: number;
    reason?: string;
  }[];
  purchaseOptions?: {
    id: string;
    productName: string;
    supplier: string;
    productCode: string;
    packSize: number;
    packUnit: string;
    unitPrice: number;
    orderingStatus?: 'Ready' | 'OK';
    isMain: boolean;
    isLocal: boolean;
  }[];
  deletable?: boolean;
  inactive?: boolean;
  countOrder?: number;
}

export interface Recipe {
  id: string;
  menuItemName: string;
  category: string;
  price: number;
  ingredients: {
    inventoryItemId: string;
    quantity: number;
    unit: string;
  }[];
  modifiers?: {
    name: string;
    ingredientChanges: {
      inventoryItemId: string;
      quantity: number;
    }[];
  }[];
  source?: 'manual' | 'toast';
  externalId?: string;
  deletable?: boolean;
}

export interface ForecastData {
  id: string;
  date: string;
  expectedCovers: number;
  items: {
    itemId: string;
    expectedUsage: number;
  }[];
}

export interface OrderItem {
  itemId: string;
  quantity: number;
  cost: number;
}

export interface DailyOrder {
  id: string;
  date: string;
  items: OrderItem[];
  totalCost: number;
  status: 'pending' | 'ordered' | 'received' | 'cancelled';
  supplierDates?: Record<string, string>;
}

export interface InvoiceRecord {
  id: string;
  date: string;
  invoiceNumber: string;
  supplier: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'open' | 'received' | 'cancelled';
  orderId?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  category: string;
  paymentTerms: string;
  notes: string;
  dateAdded: string;
  source?: 'manual' | 'invoice';
}

export interface PreppedRecipe {
  id: string;
  menuItemName: string;
  category: string;
  ingredients: {
    inventoryItemId: string;
    quantity: number;
    unit: string;
  }[];
  yieldQuantity: number;
  yieldUnit: string;
  cost: number;
  deletable?: boolean;
}

export interface ScannedInvoiceItem {
  name: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  category: string;
}

export interface ScannedInvoiceInput {
  vendor: string;
  invoiceNumber: string;
  date: string;
  items: ScannedInvoiceItem[];
  total: number;
}

interface InvoiceMutationResult {
  success: boolean;
  error?: string;
}

interface InventoryContextType {
  inventory: InventoryItem[];
  storageAreas: string[];
  recipes: Recipe[];
  preppedRecipes: PreppedRecipe[];
  forecasts: ForecastData[];
  orders: DailyOrder[];
  invoices: InvoiceRecord[];
  suppliers: Supplier[];
  inventoryCounts: InventoryCount[];
  isLocationLoaded: boolean;
  addInventoryItem: (item: Omit<InventoryItem, 'id'>) => InventoryItem;
  addStorageArea: (storageArea: string) => void;
  updateInventoryItem: (id: string, item: Partial<InventoryItem>) => void;
  deleteInventoryItem: (id: string) => void;
  adjustInventory: (id: string, change: number, reason: string) => void;
  addRecipe: (recipe: Omit<Recipe, 'id'>) => void;
  updateRecipe: (id: string, recipe: Partial<Recipe>) => void;
  deleteRecipe: (id: string) => void;
  syncToastMenuItems: (toastMenuItems: any[]) => void;
  addForecast: (forecast: Omit<ForecastData, 'id'>) => void;
  generateDailyOrder: (forecastId: string) => void;
  placeOrder: (order: { date: string; items: OrderItem[]; supplier: string; totalCost: number; status?: DailyOrder['status']; supplierDates?: Record<string, string>; }) => void;
  updateOrderStatus: (orderId: string, status: DailyOrder['status']) => void;
  addInvoice: (invoice: Omit<InvoiceRecord, 'id'>) => InvoiceRecord;
  updateInvoice: (invoiceId: string, updates: Partial<InvoiceRecord>) => InvoiceMutationResult;
  deleteInvoice: (invoiceId: string) => void;
  importScannedInvoice: (invoice: ScannedInvoiceInput) => InvoiceMutationResult;
  addPreppedRecipe: (recipe: Omit<PreppedRecipe, 'id'>) => void;
  updatePreppedRecipe: (id: string, updates: Partial<PreppedRecipe>) => void;
  deletePreppedRecipe: (id: string) => void;
  addSupplier: (supplier: Omit<Supplier, 'id' | 'dateAdded'>) => void;
  updateSupplier: (id: string, supplier: Partial<Supplier>) => void;
  deleteSupplier: (id: string) => void;
  saveInventoryCount: (count: InventoryCount) => void;
  finalizeInventoryCount: (count: InventoryCount) => void;
  deleteInventoryCount: (countId: string) => void;
}

interface LocationPayload {
  inventory: InventoryItem[];
  recipes: Recipe[];
  storageAreas: string[];
  orders?: DailyOrder[];
  invoices?: InvoiceRecord[];
  suppliers?: Supplier[];
  preppedRecipes?: PreppedRecipe[];
  inventoryCounts?: InventoryCount[];
  integrations?: { demoDataVersion?: string; [key: string]: unknown };
  version?: string | null;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

function normalizePreppedRecipe(recipe: Partial<PreppedRecipe> & Pick<PreppedRecipe, 'id' | 'menuItemName' | 'category' | 'ingredients' | 'cost'>): PreppedRecipe {
  return {
    ...recipe,
    yieldQuantity: recipe.yieldQuantity ?? 1,
    yieldUnit: recipe.yieldUnit ?? 'batch',
    deletable: recipe.deletable ?? true,
  };
}

export function InventoryProvider({ children }: { children: ReactNode }) {
  const { user, accountId, activeLocationId, token } = useAuth();
  const pollRef = useRef<number | null>(null);
  const locationVersionsRef = useRef<Map<string, string>>(new Map());
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const savesPendingRef = useRef(0);

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [storageAreas, setStorageAreas] = useState<string[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [forecasts, setForecasts] = useState<ForecastData[]>([]);
  const [orders, setOrders] = useState<DailyOrder[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [preppedRecipes, setPreppedRecipes] = useState<PreppedRecipe[]>([]);
  const [inventoryCounts, setInventoryCounts] = useState<InventoryCount[]>([]);
  const [isLocationLoaded, setIsLocationLoaded] = useState(false);

  const localKey = (key: string) => {
    if (!accountId || !activeLocationId) return null;
    return locationScopedStorageKey(accountId, activeLocationId, key);
  };

  const persistLocalLocationData = (
    nextInventory: InventoryItem[],
    nextRecipes: Recipe[],
    nextStorageAreas: string[],
    nextOrders: DailyOrder[] = orders,
    nextInvoices: InvoiceRecord[] = invoices,
    nextSuppliers: Supplier[] = suppliers,
    nextPreppedRecipes: PreppedRecipe[] = preppedRecipes,
    nextInventoryCounts: InventoryCount[] = inventoryCounts,
  ) => {
    const inventoryKey = localKey('inventory');
    const recipesKey = localKey('recipes');
    const storageAreasKey = localKey('storageAreas');
    const ordersKey = localKey('orders');
    const invoicesKey = localKey('invoices');
    const suppliersKey = localKey('suppliers');
    const preppedRecipesKey = localKey('preppedRecipes');
    const inventoryCountsKey = localKey('inventoryCounts');
    if (inventoryKey) localStorage.setItem(inventoryKey, JSON.stringify(nextInventory));
    if (recipesKey) localStorage.setItem(recipesKey, JSON.stringify(nextRecipes));
    if (storageAreasKey) localStorage.setItem(storageAreasKey, JSON.stringify(nextStorageAreas));
    if (ordersKey) localStorage.setItem(ordersKey, JSON.stringify(nextOrders));
    if (invoicesKey) localStorage.setItem(invoicesKey, JSON.stringify(nextInvoices));
    if (suppliersKey) localStorage.setItem(suppliersKey, JSON.stringify(nextSuppliers));
    if (preppedRecipesKey) localStorage.setItem(preppedRecipesKey, JSON.stringify(nextPreppedRecipes));
    if (inventoryCountsKey) localStorage.setItem(inventoryCountsKey, JSON.stringify(nextInventoryCounts));
  };

  const saveLocationData = (
    nextInventory: InventoryItem[],
    nextRecipes: Recipe[],
    nextStorageAreas: string[],
    nextOrders: DailyOrder[] = orders,
    nextInvoices: InvoiceRecord[] = invoices,
    nextSuppliers: Supplier[] = suppliers,
    nextPreppedRecipes: PreppedRecipe[] = preppedRecipes,
    nextInventoryCounts: InventoryCount[] = inventoryCounts,
  ) => {
    if (!accountId || !activeLocationId) return;
    const currentLocalInventory = readScopedJson<InventoryItem[]>(localKey('inventory'), []);
    const currentLocalRecipes = readScopedJson<Recipe[]>(localKey('recipes'), []);
    const currentLocalStorageAreas = readScopedJson<string[]>(localKey('storageAreas'), []);
    const currentLocalOrders = readScopedJson<DailyOrder[]>(localKey('orders'), []);
    const currentLocalInvoices = readScopedJson<InvoiceRecord[]>(localKey('invoices'), []);
    const currentLocalSuppliers = readScopedJson<Supplier[]>(localKey('suppliers'), []);
    const currentLocalPreppedRecipes = readScopedJson<PreppedRecipe[]>(localKey('preppedRecipes'), []);
    const currentLocalInventoryCounts = readScopedJson<InventoryCount[]>(localKey('inventoryCounts'), []);

    const effectiveInventory = nextInventory.length === 0 && currentLocalInventory.length > 0
      ? currentLocalInventory
      : nextInventory;
    const effectiveRecipes = nextRecipes.length === 0 && currentLocalRecipes.length > 0
      ? currentLocalRecipes
      : nextRecipes;
    const effectiveStorageAreas = nextStorageAreas.length === 0 && currentLocalStorageAreas.length > 0
      ? currentLocalStorageAreas
      : nextStorageAreas;
    const effectiveOrders = nextOrders.length === 0 && currentLocalOrders.length > 0
      ? currentLocalOrders
      : nextOrders;
    const effectiveInvoices = nextInvoices.length === 0 && currentLocalInvoices.length > 0
      ? currentLocalInvoices
      : nextInvoices;
    const effectiveSuppliers = nextSuppliers.length === 0 && currentLocalSuppliers.length > 0
      ? currentLocalSuppliers
      : nextSuppliers;
    const effectivePreppedRecipes = nextPreppedRecipes.length === 0 && currentLocalPreppedRecipes.length > 0
      ? currentLocalPreppedRecipes
      : nextPreppedRecipes;
    const effectiveInventoryCounts = nextInventoryCounts.length === 0 && currentLocalInventoryCounts.length > 0
      ? currentLocalInventoryCounts
      : nextInventoryCounts;

    persistLocalLocationData(
      effectiveInventory,
      effectiveRecipes,
      effectiveStorageAreas,
      effectiveOrders,
      effectiveInvoices,
      effectiveSuppliers,
      effectivePreppedRecipes,
      effectiveInventoryCounts,
    );
    if (!token) return;
    const locationId = activeLocationId;
    const requestPath = `/api/v1/accounts/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(locationId)}/data`;
    const snapshot = {
      inventory: effectiveInventory,
      recipes: effectiveRecipes,
      storageAreas: effectiveStorageAreas,
      orders: effectiveOrders,
      invoices: effectiveInvoices,
      suppliers: effectiveSuppliers,
      preppedRecipes: effectivePreppedRecipes,
      inventoryCounts: effectiveInventoryCounts,
    };
    savesPendingRef.current += 1;
    saveQueueRef.current = saveQueueRef.current
      .then(async () => {
        let version = locationVersionsRef.current.get(locationId);
        if (!version) {
          const latest = await apiRequest<LocationPayload>(requestPath);
          version = latest.version || undefined;
          if (version) locationVersionsRef.current.set(locationId, version);
        }
        if (!version) throw new Error('The latest location version could not be loaded');
        const saved = await apiRequest<LocationPayload>(requestPath, {
          method: 'PUT',
          body: JSON.stringify({ ...snapshot, version }),
        });
        if (saved.version) locationVersionsRef.current.set(locationId, saved.version);
      })
      .catch(async error => {
        console.error('Failed to sync location data', error);
        if (error instanceof ApiError && error.code === 'VERSION_CONFLICT') {
          toast.warning('Another manager saved first. ZestIQ loaded the latest company data; please review your change.');
          await loadLocationData(true);
          return;
        }
        toast.error(error instanceof Error ? error.message : 'Unable to save this change');
      })
      .finally(() => {
        savesPendingRef.current = Math.max(0, savesPendingRef.current - 1);
      });
  };

  const loadLocationData = async (silent = false) => {
    if (!accountId || !activeLocationId) {
      setInventory([]);
      setStorageAreas([]);
      setRecipes([]);
      setIsLocationLoaded(true);
      return;
    }

    const localInventory = readScopedJson<InventoryItem[]>(localKey('inventory'), []).map(item => ({
      ...item,
      storageArea: normalizeStorageArea(item.storageArea),
      inactive: item.inactive ?? false,
    }));
    const localRecipes = readScopedJson<Recipe[]>(localKey('recipes'), []);
    const localStorageAreas = readScopedJson<string[]>(localKey('storageAreas'), []);
    const localInventoryCounts = readScopedJson<InventoryCount[]>(localKey('inventoryCounts'), []);

    const demoData = buildDemoLocationData();
    const isDemoAccount = user?.email?.trim().toLowerCase() === 'demo@zestiq.com';
    const fallbackInventory = isDemoAccount ? demoData.inventory as unknown as InventoryItem[] : [];
    const fallbackRecipes = isDemoAccount ? demoData.recipes as unknown as Recipe[] : [];
    const fallbackStorageAreas = isDemoAccount ? demoData.storageAreas : [...DEFAULT_STORAGE_AREAS];
    const fallbackOrders = isDemoAccount ? demoData.orders as unknown as DailyOrder[] : [];
    const fallbackInvoices = isDemoAccount ? demoData.invoices as unknown as InvoiceRecord[] : [];
    const fallbackSuppliers = isDemoAccount ? demoData.suppliers as unknown as Supplier[] : [];

    if (!token) {
      const nextStorageAreas = sortUniqueStorageAreas([
        ...DEFAULT_STORAGE_AREAS,
        ...localStorageAreas,
        ...localInventory.map(item => normalizeStorageArea(item.storageArea)),
      ]);
      setInventory(localInventory.length > 0 ? localInventory : fallbackInventory);
      setRecipes(localRecipes.length > 0 ? localRecipes : fallbackRecipes);
      setStorageAreas(nextStorageAreas.length > 0 ? nextStorageAreas : fallbackStorageAreas);
      const localOrders = readScopedJson<DailyOrder[]>(localKey('orders'), []);
      const localInvoices = readScopedJson<InvoiceRecord[]>(localKey('invoices'), []);
      const localSuppliers = readScopedJson<Supplier[]>(localKey('suppliers'), []);
      setOrders(localOrders.length > 0 ? localOrders : fallbackOrders);
      setInvoices(localInvoices.length > 0 ? localInvoices : fallbackInvoices);
      setSuppliers(localSuppliers.length > 0 ? localSuppliers : fallbackSuppliers);
      setPreppedRecipes(readScopedJson<PreppedRecipe[]>(localKey('preppedRecipes'), []).map(recipe => normalizePreppedRecipe(recipe)));
      setInventoryCounts(localInventoryCounts);
      setIsLocationLoaded(true);
      return;
    }

    try {
      const locationDataPath = `/api/v1/accounts/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(activeLocationId)}/data`;
      let payload = await apiRequest<LocationPayload>(locationDataPath);
      const shouldRefreshDemo = isDemoAccount && (
        shouldResetDemoSession(DEMO_DATA_VERSION)
        || payload.integrations?.demoDataVersion !== DEMO_DATA_VERSION
      );
      if (shouldRefreshDemo && payload.version) {
        payload = await apiRequest<LocationPayload>(locationDataPath, {
          method: 'PUT',
          body: JSON.stringify({
            inventory: fallbackInventory,
            recipes: fallbackRecipes,
            storageAreas: fallbackStorageAreas,
            orders: fallbackOrders,
            invoices: fallbackInvoices,
            suppliers: fallbackSuppliers,
            preppedRecipes: [],
            inventoryCounts: [],
            demoDataVersion: DEMO_DATA_VERSION,
            version: payload.version,
          }),
        });
        markDemoSessionReset(DEMO_DATA_VERSION);
        toast.success('Zestaurant has been refreshed with matching inventory, recipes and POS menu items.');
      }
      if (payload.version) locationVersionsRef.current.set(activeLocationId, payload.version);
      const merged = mergeLocationData(
        {
          inventory: localInventory,
          recipes: localRecipes,
          storageAreas: localStorageAreas,
          orders: readScopedJson<DailyOrder[]>(localKey('orders'), []),
          invoices: readScopedJson<InvoiceRecord[]>(localKey('invoices'), []),
          suppliers: readScopedJson<Supplier[]>(localKey('suppliers'), []),
          preppedRecipes: readScopedJson<PreppedRecipe[]>(localKey('preppedRecipes'), []).map(recipe => normalizePreppedRecipe(recipe)),
          inventoryCounts: localInventoryCounts,
        },
        payload,
      );

      const apiInventory = (merged.inventory || []).map(item => ({
        ...item,
        storageArea: normalizeStorageArea(item.storageArea),
        inactive: item.inactive ?? false,
      }));
      const apiRecipes = merged.recipes || [];
      const apiStorageAreas = merged.storageAreas || [];
      const apiOrders = merged.orders || [];
      const apiInvoices = merged.invoices || [];
      const apiSuppliers = merged.suppliers || [];
      const apiPreppedRecipes = (merged.preppedRecipes || []).map(recipe => normalizePreppedRecipe(recipe));
      const apiInventoryCounts = merged.inventoryCounts || [];

      const serverHasData = Boolean(payload.version);
      const hasLocalData = localInventory.length > 0 || localRecipes.length > 0 || localStorageAreas.length > 0 || readScopedJson<DailyOrder[]>(localKey('orders'), []).length > 0 || readScopedJson<InvoiceRecord[]>(localKey('invoices'), []).length > 0 || readScopedJson<Supplier[]>(localKey('suppliers'), []).length > 0 || readScopedJson<PreppedRecipe[]>(localKey('preppedRecipes'), []).length > 0 || localInventoryCounts.length > 0;
      const shouldPreferLocalInventory = !serverHasData && localInventory.length > 0;
      const apiIngredientCount = apiRecipes.reduce((count, recipe) => count + (recipe.ingredients?.length || 0), 0);
      const localIngredientCount = localRecipes.reduce((count, recipe) => count + (recipe.ingredients?.length || 0), 0);
      const shouldPreferLocalRecipes = shouldPreferLocalInventory || (!serverHasData && localIngredientCount > apiIngredientCount);

      const nextInventory = isDemoAccount && apiInventory.length === 0 ? fallbackInventory : (serverHasData ? apiInventory : (shouldPreferLocalInventory ? localInventory : (hasLocalData ? localInventory : fallbackInventory)));
      const nextRecipes = isDemoAccount && apiRecipes.length === 0 ? fallbackRecipes : (serverHasData ? apiRecipes : (shouldPreferLocalRecipes ? localRecipes : (hasLocalData ? localRecipes : fallbackRecipes)));
      const nextStorageAreas = isDemoAccount && apiStorageAreas.length === 0 ? fallbackStorageAreas : (serverHasData ? apiStorageAreas : (shouldPreferLocalInventory ? localStorageAreas : (hasLocalData ? localStorageAreas : fallbackStorageAreas)));
      const localOrders = readScopedJson<DailyOrder[]>(localKey('orders'), []);
      const localInvoices = readScopedJson<InvoiceRecord[]>(localKey('invoices'), []);
      const localSuppliers = readScopedJson<Supplier[]>(localKey('suppliers'), []);
      const nextOrders = isDemoAccount && apiOrders.length === 0 ? fallbackOrders : (serverHasData ? apiOrders : (localOrders.length > 0 ? localOrders : fallbackOrders));
      const nextInvoices = isDemoAccount && apiInvoices.length === 0 ? fallbackInvoices : (serverHasData ? apiInvoices : (localInvoices.length > 0 ? localInvoices : fallbackInvoices));
      const nextSuppliers = isDemoAccount && apiSuppliers.length === 0 ? fallbackSuppliers : (serverHasData ? apiSuppliers : (localSuppliers.length > 0 ? localSuppliers : fallbackSuppliers));
      const nextPreppedRecipes = serverHasData ? apiPreppedRecipes : readScopedJson<PreppedRecipe[]>(localKey('preppedRecipes'), []).map(recipe => normalizePreppedRecipe(recipe));
      const nextInventoryCounts = apiInventoryCounts.length > 0 ? apiInventoryCounts : localInventoryCounts;

      const inferredAreas = nextInventory.map(item => normalizeStorageArea(item.storageArea));
      const mergedStorageAreas = sortUniqueStorageAreas([
        ...DEFAULT_STORAGE_AREAS,
        ...nextStorageAreas,
        ...inferredAreas,
      ]);

      setInventory(nextInventory);
      setRecipes(nextRecipes);
      setStorageAreas(mergedStorageAreas);
      setOrders(nextOrders);
      setInvoices(nextInvoices);
      setSuppliers(nextSuppliers);
      setPreppedRecipes(nextPreppedRecipes);
      setInventoryCounts(nextInventoryCounts);
      setIsLocationLoaded(true);

      if (serverHasData && (nextInventory.length > 0 || nextRecipes.length > 0 || nextOrders.length > 0 || nextInvoices.length > 0 || nextSuppliers.length > 0 || nextPreppedRecipes.length > 0)) {
        persistLocalLocationData(nextInventory, nextRecipes, nextStorageAreas, nextOrders, nextInvoices, nextSuppliers, nextPreppedRecipes, nextInventoryCounts);
      } else if (isDemoAccount && !hasLocalData) {
        persistLocalLocationData(nextInventory, nextRecipes, mergedStorageAreas, nextOrders, nextInvoices, nextSuppliers, nextPreppedRecipes, nextInventoryCounts);
      }
    } catch (error) {
      const localStorageAreas = sortUniqueStorageAreas([
        ...DEFAULT_STORAGE_AREAS,
        ...readScopedJson<string[]>(localKey('storageAreas'), []),
        ...localInventory.map(item => normalizeStorageArea(item.storageArea)),
      ]);
      setInventory(localInventory.length > 0 ? localInventory : fallbackInventory);
      setRecipes(localRecipes.length > 0 ? localRecipes : fallbackRecipes);
      setStorageAreas(localStorageAreas.length > 0 ? localStorageAreas : fallbackStorageAreas);
      setOrders(readScopedJson<DailyOrder[]>(localKey('orders'), fallbackOrders));
      setInvoices(readScopedJson<InvoiceRecord[]>(localKey('invoices'), fallbackInvoices));
      setSuppliers(readScopedJson<Supplier[]>(localKey('suppliers'), fallbackSuppliers));
      setInventoryCounts(localInventoryCounts);
      setIsLocationLoaded(true);
      if (!silent) {
        console.error('Failed to load location data', error);
      }
    }
  };

  useEffect(() => {
    if (!accountId || !activeLocationId) {
      setInventory([]);
      setStorageAreas([]);
      setRecipes([]);
      setForecasts([]);
      setOrders([]);
      setSuppliers([]);
      setPreppedRecipes([]);
      setInventoryCounts([]);
      setIsLocationLoaded(true);
      return;
    }

    setIsLocationLoaded(false);
    void loadLocationData();

    const forecastKey = localKey('forecasts');
    const ordersKey = localKey('orders');
    const invoicesKey = localKey('invoices');
    const suppliersKey = localKey('suppliers');
    const preppedKey = localKey('preppedRecipes');

    setForecasts(readScopedJson<ForecastData[]>(forecastKey, []));
    setOrders(readScopedJson<DailyOrder[]>(ordersKey, []));
    setInvoices(readScopedJson<InvoiceRecord[]>(invoicesKey, []));
    setSuppliers(readScopedJson<Supplier[]>(suppliersKey, []));

    setPreppedRecipes(readScopedJson<PreppedRecipe[]>(preppedKey, []).map(recipe => normalizePreppedRecipe(recipe)));
  }, [accountId, activeLocationId, user?.email, token]);

  useEffect(() => {
    if (!accountId || !activeLocationId || !token) return;
    if (pollRef.current) window.clearInterval(pollRef.current);

    pollRef.current = window.setInterval(() => {
      if (savesPendingRef.current === 0) void loadLocationData(true);
    }, 5000);

    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [accountId, activeLocationId, token]);

  useEffect(() => {
    const key = localKey('forecasts');
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(forecasts));
  }, [forecasts, accountId, activeLocationId]);

  useEffect(() => {
    const key = localKey('orders');
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(orders));
  }, [orders, accountId, activeLocationId]);

  useEffect(() => {
    const key = localKey('invoices');
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(invoices));
  }, [invoices, accountId, activeLocationId]);

  useEffect(() => {
    const key = localKey('suppliers');
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(suppliers));
  }, [suppliers, accountId, activeLocationId]);

  useEffect(() => {
    if (!isLocationLoaded || !accountId || !activeLocationId || suppliers.length < 2) return;
    const consolidated = mergeDuplicateSuppliers(suppliers);
    if (consolidated.length === suppliers.length) return;
    setSuppliers(consolidated);
    saveLocationData(inventory, recipes, storageAreas, orders, invoices, consolidated, preppedRecipes, inventoryCounts);
    const mergedCount = suppliers.length - consolidated.length;
    toast.success(`Merged ${mergedCount} duplicate supplier ${mergedCount === 1 ? 'record' : 'records'}.`);
  }, [suppliers, isLocationLoaded, accountId, activeLocationId]);

  useEffect(() => {
    const key = localKey('preppedRecipes');
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(preppedRecipes));
  }, [preppedRecipes, accountId, activeLocationId]);

  const addInventoryItem = (item: Omit<InventoryItem, 'id'>) => {
    const newItem: InventoryItem = {
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      storageArea: normalizeStorageArea(item.storageArea),
      deletable: item.deletable !== false,
      inactive: item.inactive ?? false,
    };

    const nextInventory = [...inventory, newItem];
    const nextStorageAreas = sortUniqueStorageAreas([...storageAreas, normalizeStorageArea(newItem.storageArea)]);
    setInventory(nextInventory);
    setStorageAreas(nextStorageAreas);
    saveLocationData(nextInventory, recipes, nextStorageAreas, orders, invoices, suppliers, preppedRecipes);
    return newItem;
  };

  const addStorageArea = (storageArea: string) => {
    const normalized = storageArea.trim();
    if (!normalized) return;
    const nextStorageAreas = sortUniqueStorageAreas([...storageAreas, normalized]);
    setStorageAreas(nextStorageAreas);
    saveLocationData(inventory, recipes, nextStorageAreas, orders, invoices, suppliers, preppedRecipes);
  };

  const updateInventoryItem = (id: string, updates: Partial<InventoryItem>) => {
    const nextInventory = inventory.map(item => {
      if (item.id !== id) return item;
      if (updates.unitCost !== undefined && updates.unitCost !== item.unitCost) {
        const newPriceHistory = [
          ...(item.priceHistory || []),
          {
            date: new Date().toISOString(),
            oldPrice: item.unitCost,
            newPrice: updates.unitCost,
            reason: updates.supplier !== item.supplier
              ? `Price change from ${item.supplier} to ${updates.supplier}`
              : 'Price updated',
          },
        ];
        return {
          ...item,
          ...updates,
          storageArea: normalizeStorageArea(updates.storageArea ?? item.storageArea),
          inactive: updates.inactive ?? item.inactive ?? false,
          priceHistory: newPriceHistory,
        };
      }

      return {
        ...item,
        ...updates,
        storageArea: normalizeStorageArea(updates.storageArea ?? item.storageArea),
        inactive: updates.inactive ?? item.inactive ?? false,
      };
    });

    const nextStorageAreas = sortUniqueStorageAreas([...storageAreas, ...nextInventory.map(item => normalizeStorageArea(item.storageArea))]);
    setInventory(nextInventory);
    setStorageAreas(nextStorageAreas);
    saveLocationData(nextInventory, recipes, nextStorageAreas);
  };

  const deleteInventoryItem = (id: string) => {
    const nextInventory = inventory.filter(item => item.id !== id);
    setInventory(nextInventory);
    saveLocationData(nextInventory, recipes, storageAreas);
  };

  const adjustInventory = (id: string, change: number, reason: string) => {
    const nextInventory = inventory.map(item => {
      if (item.id !== id) return item;
      const newStock = item.currentStock + change;
      const newHistory = [
        ...(item.history || []),
        {
          date: new Date().toISOString(),
          change,
          reason,
          newStock,
        },
      ];
      return {
        ...item,
        currentStock: newStock,
        history: newHistory,
      };
    });

    setInventory(nextInventory);
    saveLocationData(nextInventory, recipes, storageAreas);
  };

  const addRecipe = (recipe: Omit<Recipe, 'id'>) => {
    const nextRecipes = [
      ...recipes,
      {
        ...recipe,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        deletable: recipe.deletable !== false,
      },
    ];

    setRecipes(nextRecipes);
    saveLocationData(inventory, nextRecipes, storageAreas);
  };

  const updateRecipe = (id: string, updates: Partial<Recipe>) => {
    const nextRecipes = recipes.map(recipe => (recipe.id === id ? { ...recipe, ...updates } : recipe));
    setRecipes(nextRecipes);
    saveLocationData(inventory, nextRecipes, storageAreas);
  };

  const deleteRecipe = (id: string) => {
    const nextRecipes = recipes.filter(recipe => recipe.id !== id);
    setRecipes(nextRecipes);
    saveLocationData(inventory, nextRecipes, storageAreas);
  };

  const syncToastMenuItems = (toastMenuItems: any[]) => {
    const next = [...recipes];

    toastMenuItems.forEach((item: any) => {
      const normalizedRecipe: Recipe = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        menuItemName: item.name,
        category: item.category,
        price: item.price,
        ingredients: item.ingredients.map((ingredient: any) => ({
          inventoryItemId: ingredient.inventoryItemId,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
        })),
        modifiers: item.modifiers
          ? item.modifiers.map((modifier: any) => ({
              name: modifier.name,
              ingredientChanges: modifier.ingredientChanges.map((change: any) => ({
                inventoryItemId: change.inventoryItemId,
                quantity: change.quantity,
              })),
            }))
          : [],
        source: 'toast',
        deletable: false,
        externalId: item.id,
      };

      const existingIndex = next.findIndex(
        recipe =>
          recipe.externalId === item.id ||
          (recipe.source === 'toast' && recipe.menuItemName.trim().toLowerCase() === item.name.trim().toLowerCase())
      );

      if (existingIndex >= 0) {
        next[existingIndex] = {
          ...next[existingIndex],
          ...normalizedRecipe,
          id: next[existingIndex].id,
        };
      } else {
        next.push(normalizedRecipe);
      }
    });

    setRecipes(next);
    saveLocationData(inventory, next, storageAreas, orders, invoices, suppliers, preppedRecipes);
  };

  const addForecast = (forecast: Omit<ForecastData, 'id'>) => {
    const newForecast: ForecastData = {
      ...forecast,
      id: Date.now().toString(),
    };
    setForecasts([...forecasts, newForecast]);
  };

  const generateDailyOrder = (forecastId: string) => {
    const forecast = forecasts.find(f => f.id === forecastId);
    if (!forecast) return;

    const orderItems: OrderItem[] = [];

    forecast.items.forEach(({ itemId, expectedUsage }) => {
      const item = inventory.find(i => i.id === itemId);
      if (!item) return;

      const quantityNeeded = calculateForecastOrderQuantity({
        currentStock: item.currentStock,
        expectedUsage,
        parLevel: item.parLevel,
        safetyBuffer: Math.max(item.parLevel * 0.1, 2),
        minimumOrderQty: item.minimumOrderQty || 0,
      });

      if (quantityNeeded > 0) {
        orderItems.push({
          itemId,
          quantity: quantityNeeded,
          cost: quantityNeeded * item.unitCost,
        });
      }
    });

    const totalCost = orderItems.reduce((sum, item) => sum + item.cost, 0);
    placeOrder({
      date: forecast.date,
      items: orderItems,
      supplier: orderItems[0]?.itemId ? inventory.find(item => item.id === orderItems[0].itemId)?.supplier || 'Supplier' : 'Supplier',
      totalCost,
      status: 'pending',
    });
  };

  const placeOrder = (orderInput: { date: string; items: OrderItem[]; supplier: string; totalCost: number; status?: DailyOrder['status']; supplierDates?: Record<string, string>; }) => {
    const totalCost = orderInput.totalCost;
    const newOrder: DailyOrder = {
      id: Date.now().toString(),
      date: orderInput.date,
      items: orderInput.items,
      totalCost,
      status: orderInput.status || 'pending',
      supplierDates: orderInput.supplierDates,
    };

    const newInvoice: InvoiceRecord = {
      id: `${Date.now()}-invoice`,
      date: orderInput.date,
      invoiceNumber: `INV-${Math.floor(100000 + Math.random() * 900000)}`,
      supplier: orderInput.supplier || 'Supplier',
      items: orderInput.items,
      totalAmount: totalCost,
      status: 'open',
      orderId: newOrder.id,
    };

    setOrders(prev => {
      const nextOrders = [...prev, newOrder];
      saveLocationData(inventory, recipes, storageAreas, nextOrders, invoices, suppliers, preppedRecipes);
      return nextOrders;
    });
    setInvoices(prev => {
      const nextInvoices = [...prev, newInvoice];
      saveLocationData(inventory, recipes, storageAreas, orders, nextInvoices, suppliers, preppedRecipes);
      return nextInvoices;
    });
  };

  const updateOrderStatus = (orderId: string, status: DailyOrder['status']) => {
    setOrders(prev => {
      const nextOrders = prev.map(order => (order.id === orderId ? { ...order, status } : order));
      saveLocationData(inventory, recipes, storageAreas, nextOrders, invoices, suppliers, preppedRecipes);
      return nextOrders;
    });

    if (status === 'received') {
      const order = orders.find(entry => entry.id === orderId);
      if (!order) return;

      const nextInventory = inventory.map(item => {
        const matchingItem = order.items.find(entry => entry.itemId === item.id);
        if (!matchingItem) return item;
        return {
          ...item,
          currentStock: item.currentStock + matchingItem.quantity,
          lastUpdated: new Date().toISOString(),
        };
      });

      setInventory(nextInventory);
      saveLocationData(nextInventory, recipes, storageAreas, orders, invoices, suppliers, preppedRecipes);

      setInvoices(prev => {
        const nextInvoices = prev.map(invoice => (
          invoice.orderId === orderId ? { ...invoice, status: 'received' } : invoice
        ));
        saveLocationData(inventory, recipes, storageAreas, orders, nextInvoices, suppliers, preppedRecipes);
        return nextInvoices;
      });
    }
  };

  const addInvoice = (invoiceInput: Omit<InvoiceRecord, 'id'>) => {
    if (hasDuplicateInvoiceNumber(invoices, invoiceInput.invoiceNumber)) {
      throw new Error(`Invoice ${invoiceInput.invoiceNumber} already exists.`);
    }

    const newInvoice: InvoiceRecord = {
      ...invoiceInput,
      id: `${Date.now()}-invoice`,
      invoiceNumber: invoiceInput.invoiceNumber || `INV-${Math.floor(100000 + Math.random() * 900000)}`,
    };

    setInvoices(prev => {
      const nextInvoices = [...prev, newInvoice];
      saveLocationData(inventory, recipes, storageAreas, orders, nextInvoices, suppliers, preppedRecipes);
      return nextInvoices;
    });
    return newInvoice;
  };

  const updateInvoice = (invoiceId: string, updates: Partial<InvoiceRecord>) => {
    if (
      updates.invoiceNumber &&
      hasDuplicateInvoiceNumber(invoices.filter(invoice => invoice.id !== invoiceId), updates.invoiceNumber)
    ) {
      return {
        success: false,
        error: `Invoice ${updates.invoiceNumber} already exists.`,
      };
    }

    setInvoices(prev => {
      const nextInvoices = prev.map(invoice => {
        if (invoice.id !== invoiceId) return invoice;

        const nextInvoice = {
          ...invoice,
          ...updates,
        };

        if (updates.items) {
          nextInvoice.totalAmount = updates.totalAmount ?? nextInvoice.totalAmount;
        }

        return nextInvoice;
      });
      saveLocationData(inventory, recipes, storageAreas, orders, nextInvoices, suppliers, preppedRecipes);
      return nextInvoices;
    });
    return { success: true };
  };

  const importScannedInvoice = (invoiceInput: ScannedInvoiceInput): InvoiceMutationResult => {
    const invoiceNumber = invoiceInput.invoiceNumber.trim();
    if (!invoiceNumber) {
      return { success: false, error: 'An invoice number is required before saving.' };
    }
    if (hasDuplicateInvoiceNumber(invoices, invoiceNumber)) {
      return {
        success: false,
        error: `Invoice ${invoiceNumber} has already been saved. Inventory was not changed.`,
      };
    }

    const now = new Date().toISOString();
    const consolidatedSuppliers = mergeDuplicateSuppliers(suppliers);
    const supplierMatch = findBestSupplierMatch(invoiceInput.vendor, consolidatedSuppliers);
    const supplierName = supplierMatch?.supplier.name || invoiceInput.vendor.trim() || 'Unknown supplier';
    const normalizedSupplier = normalizeSupplierName(supplierName);
    const supplierSlug = normalizedSupplier.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'supplier';
    const nextInventory = inventory.map(item => ({
      ...item,
      history: item.history ? [...item.history] : undefined,
      priceHistory: item.priceHistory ? [...item.priceHistory] : undefined,
      purchaseOptions: item.purchaseOptions ? item.purchaseOptions.map(option => ({ ...option })) : undefined,
    }));
    const invoiceItems: OrderItem[] = [];

    invoiceInput.items.forEach((scannedItem, index) => {
      const normalizedName = normalizeInventoryItemName(scannedItem.name);
      const itemIndex = nextInventory.findIndex(item => (
        normalizedName.length > 0 && normalizeInventoryItemName(item.name) === normalizedName
      ));
      const quantity = Math.max(0, Number(scannedItem.quantity) || 0);
      const unitCost = Math.max(0, Number(scannedItem.unitCost) || 0);
      const totalCost = Math.max(0, Number(scannedItem.totalCost) || quantity * unitCost);

      if (itemIndex >= 0) {
        const existingItem = nextInventory[itemIndex];
        const shouldBecomePrimary = !existingItem.supplier || existingItem.supplier.toLowerCase() === 'unknown';
        const existingOptions = existingItem.purchaseOptions?.length
          ? existingItem.purchaseOptions
          : [{
              id: `${existingItem.id}-${existingItem.supplier.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'supplier'}`,
              productName: existingItem.name,
              supplier: existingItem.supplier,
              productCode: existingItem.vendorItemCode || '',
              packSize: existingItem.packSize || 1,
              packUnit: existingItem.packUnit || existingItem.unit,
              unitPrice: existingItem.unitCost,
              isMain: true,
              isLocal: true,
            }];
        const matchingOption = existingOptions.find(option => normalizeSupplierName(option.supplier) === normalizedSupplier);
        const isPrimarySupplier = shouldBecomePrimary || matchingOption?.isMain === true || normalizeSupplierName(existingItem.supplier) === normalizedSupplier;
        const supplierOption = {
          id: matchingOption?.id || `${existingItem.id}-${supplierSlug}`,
          productName: scannedItem.name.trim() || existingItem.name,
          supplier: supplierName,
          productCode: matchingOption?.productCode || '',
          packSize: matchingOption?.packSize || 1,
          packUnit: scannedItem.unit.trim() || matchingOption?.packUnit || existingItem.unit,
          unitPrice: unitCost,
          orderingStatus: matchingOption?.orderingStatus,
          isMain: isPrimarySupplier,
          isLocal: matchingOption?.isLocal ?? true,
        };
        const purchaseOptions = matchingOption
          ? existingOptions.map(option => option.id === matchingOption.id ? supplierOption : (isPrimarySupplier ? { ...option, isMain: false } : option))
          : [
              ...existingOptions.map(option => isPrimarySupplier ? { ...option, isMain: false } : option),
              supplierOption,
            ];
        const newStock = existingItem.currentStock + quantity;
        const nextPriceHistory = isPrimarySupplier && unitCost !== existingItem.unitCost
          ? [
              ...(existingItem.priceHistory || []),
              {
                date: now,
                oldPrice: existingItem.unitCost,
                newPrice: unitCost,
                reason: `Invoice ${invoiceNumber} from ${supplierName}`,
              },
            ]
          : existingItem.priceHistory;

        nextInventory[itemIndex] = {
          ...existingItem,
          currentStock: newStock,
          supplier: isPrimarySupplier ? supplierName : existingItem.supplier,
          unitCost: isPrimarySupplier ? unitCost : existingItem.unitCost,
          purchaseOptions,
          priceHistory: nextPriceHistory,
          lastUpdated: now,
          history: [
            ...(existingItem.history || []),
            {
              date: now,
              change: quantity,
              reason: `Invoice ${invoiceNumber} from ${supplierName}`,
              newStock,
            },
          ],
        };
        invoiceItems.push({ itemId: existingItem.id, quantity, cost: totalCost });
        return;
      }

      const itemId = `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 9)}`;
      nextInventory.push({
        id: itemId,
        name: scannedItem.name.trim() || 'Unknown item',
        category: scannedItem.category.trim() || 'Uncategorized',
        storageArea: 'Unassigned',
        currentStock: quantity,
        unit: scannedItem.unit.trim() || 'ea',
        unitCost,
        parLevel: quantity * 2,
        supplier: supplierName,
        reorderPoint: quantity * 0.5,
        lastUpdated: now,
        deletable: true,
        inactive: false,
        history: [{
          date: now,
          change: quantity,
          reason: `Initial stock from invoice ${invoiceNumber}`,
          newStock: quantity,
        }],
        purchaseOptions: [{
          id: `${itemId}-${supplierSlug}`,
          productName: scannedItem.name.trim() || 'Unknown item',
          supplier: supplierName,
          productCode: '',
          packSize: 1,
          packUnit: scannedItem.unit.trim() || 'ea',
          unitPrice: unitCost,
          isMain: true,
          isLocal: true,
        }],
      });
      invoiceItems.push({ itemId, quantity, cost: totalCost });
    });

    const nextSuppliers = consolidatedSuppliers.some(supplier => normalizeSupplierName(supplier.name) === normalizedSupplier)
      ? consolidatedSuppliers
      : [...consolidatedSuppliers, {
          id: `${Date.now()}-${supplierSlug}`,
          name: supplierName,
          contactPerson: '',
          email: '',
          phone: '',
          address: '',
          category: invoiceInput.items[0]?.category || 'Other',
          paymentTerms: '',
          notes: `Auto-added from invoice ${invoiceNumber}`,
          dateAdded: now,
          source: 'invoice' as const,
        }];
    const calculatedTotal = invoiceItems.reduce((sum, item) => sum + item.cost, 0);
    const newInvoice: InvoiceRecord = {
      id: `${Date.now()}-invoice-${Math.random().toString(36).slice(2, 9)}`,
      date: invoiceInput.date || now,
      invoiceNumber,
      supplier: supplierName,
      items: invoiceItems,
      totalAmount: Number.isFinite(invoiceInput.total) ? Math.max(0, invoiceInput.total) : calculatedTotal,
      status: 'received',
    };
    const nextInvoices = [...invoices, newInvoice];
    const nextStorageAreas = sortUniqueStorageAreas([
      ...storageAreas,
      ...nextInventory.map(item => normalizeStorageArea(item.storageArea)),
    ]);

    setInventory(nextInventory);
    setInvoices(nextInvoices);
    setSuppliers(nextSuppliers);
    setStorageAreas(nextStorageAreas);
    saveLocationData(nextInventory, recipes, nextStorageAreas, orders, nextInvoices, nextSuppliers, preppedRecipes);
    return { success: true };
  };

  const deleteInvoice = (invoiceId: string) => {
    setInvoices(prev => {
      const nextInvoices = prev.filter(invoice => invoice.id !== invoiceId);
      saveLocationData(inventory, recipes, storageAreas, orders, nextInvoices, suppliers, preppedRecipes);
      return nextInvoices;
    });
  };

  const addPreppedRecipe = (recipe: Omit<PreppedRecipe, 'id'>) => {
    const newRecipe = normalizePreppedRecipe({
      ...recipe,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    });
    setPreppedRecipes(prev => {
      const nextPreppedRecipes = [...prev, newRecipe];
      saveLocationData(inventory, recipes, storageAreas, orders, invoices, suppliers, nextPreppedRecipes);
      return nextPreppedRecipes;
    });
  };

  const updatePreppedRecipe = (id: string, updates: Partial<PreppedRecipe>) => {
    setPreppedRecipes(prev => {
      const nextPreppedRecipes = prev.map(item => (item.id === id ? normalizePreppedRecipe({ ...item, ...updates }) : item));
      saveLocationData(inventory, recipes, storageAreas, orders, invoices, suppliers, nextPreppedRecipes);
      return nextPreppedRecipes;
    });
  };

  const deletePreppedRecipe = (id: string) => {
    setPreppedRecipes(prev => {
      const nextPreppedRecipes = prev.filter(item => item.id !== id);
      saveLocationData(inventory, recipes, storageAreas, orders, invoices, suppliers, nextPreppedRecipes);
      return nextPreppedRecipes;
    });
  };

  const addSupplier = (supplier: Omit<Supplier, 'id' | 'dateAdded'>) => {
    const newSupplier: Supplier = {
      ...supplier,
      id: Date.now().toString(),
      dateAdded: new Date().toISOString(),
    };
    const nextSuppliers = [...suppliers, newSupplier];
    setSuppliers(nextSuppliers);
    saveLocationData(inventory, recipes, storageAreas, orders, invoices, nextSuppliers, preppedRecipes);
  };

  const updateSupplier = (id: string, updates: Partial<Supplier>) => {
    const nextSuppliers = suppliers.map(supplier => (supplier.id === id ? { ...supplier, ...updates } : supplier));
    setSuppliers(nextSuppliers);
    saveLocationData(inventory, recipes, storageAreas, orders, invoices, nextSuppliers, preppedRecipes);
  };

  const deleteSupplier = (id: string) => {
    const nextSuppliers = suppliers.filter(supplier => supplier.id !== id);
    setSuppliers(nextSuppliers);
    saveLocationData(inventory, recipes, storageAreas, orders, invoices, nextSuppliers, preppedRecipes);
  };

  const saveInventoryCount = (count: InventoryCount) => {
    const nextCounts = inventoryCounts.some(item => item.id === count.id)
      ? inventoryCounts.map(item => (item.id === count.id ? count : item))
      : [count, ...inventoryCounts];
    setInventoryCounts(nextCounts);
    saveLocationData(inventory, recipes, storageAreas, orders, invoices, suppliers, preppedRecipes, nextCounts);
  };

  const deleteInventoryCount = (countId: string) => {
    const nextCounts = inventoryCounts.filter(item => item.id !== countId);
    setInventoryCounts(nextCounts);
    saveLocationData(inventory, recipes, storageAreas, orders, invoices, suppliers, preppedRecipes, nextCounts);
  };

  const finalizeInventoryCount = (count: InventoryCount) => {
    const finalizedAt = count.finalizedAt || new Date().toISOString();
    const finalizedCount: InventoryCount = {
      ...count,
      status: 'finalized',
      locked: 'Yes',
      updatedAt: finalizedAt,
      finalizedAt,
      entries: count.entries.map(entry => ({
        ...entry,
        isCounted: true,
        value: entry.counted * entry.unitCost,
      })),
      value: count.entries.reduce((sum, entry) => sum + entry.counted * entry.unitCost, 0),
    };
    const countedByItem = new Map(finalizedCount.entries.map(entry => [entry.itemId, entry]));
    const now = new Date().toISOString();
    const nextInventory = inventory.map(item => {
      const countedEntry = countedByItem.get(item.id);
      if (!countedEntry) return item;
      const nextStock = Number(countedEntry.counted) || 0;
      const change = nextStock - item.currentStock;
      return {
        ...item,
        currentStock: nextStock,
        countOrder: countedEntry.shelfOrder ?? item.countOrder,
        lastCountedAt: now,
        lastUpdated: now,
        history: change === 0 ? item.history : [
          ...(item.history || []),
          { date: now, change, reason: `Inventory count finalized by ${finalizedCount.finalizedBy || 'manager'}`, newStock: nextStock },
        ],
      };
    });
    const nextCounts = inventoryCounts.some(item => item.id === finalizedCount.id)
      ? inventoryCounts.map(item => (item.id === finalizedCount.id ? finalizedCount : item))
      : [finalizedCount, ...inventoryCounts];
    setInventory(nextInventory);
    setInventoryCounts(nextCounts);
    saveLocationData(nextInventory, recipes, storageAreas, orders, invoices, suppliers, preppedRecipes, nextCounts);
  };

  return (
    <InventoryContext.Provider
      value={{
        inventory,
        storageAreas,
        recipes,
        forecasts,
        orders,
        invoices,
        suppliers,
        inventoryCounts,
        isLocationLoaded,
        addInventoryItem,
        addStorageArea,
        updateInventoryItem,
        deleteInventoryItem,
        adjustInventory,
        addRecipe,
        updateRecipe,
        deleteRecipe,
        syncToastMenuItems,
        addForecast,
        generateDailyOrder,
        placeOrder,
        updateOrderStatus,
        addInvoice,
        updateInvoice,
        deleteInvoice,
        importScannedInvoice,
        preppedRecipes,
        addPreppedRecipe,
        updatePreppedRecipe,
        deletePreppedRecipe,
        addSupplier,
        updateSupplier,
        deleteSupplier,
        saveInventoryCount,
        finalizeInventoryCount,
        deleteInventoryCount,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (context === undefined) {
    throw new Error('useInventory must be used within InventoryProvider');
  }
  return context;
}
