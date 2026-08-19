import { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { locationScopedStorageKey, readScopedJson } from '../utils/storageScope';
import { apiRequest } from '../utils/api';
import { calculateForecastOrderQuantity } from '../utils/forecastOrderUtils';
import { buildDemoLocationData } from '../utils/demoData';
import { mergeLocationData } from '../utils/locationDataMerge.js';
import { hasDuplicateInvoiceNumber, normalizeInventoryItemName } from '../utils/invoiceWorkflow.js';

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
}

interface LocationPayload {
  inventory: InventoryItem[];
  recipes: Recipe[];
  storageAreas: string[];
  orders?: DailyOrder[];
  invoices?: InvoiceRecord[];
  suppliers?: Supplier[];
  preppedRecipes?: PreppedRecipe[];
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

  const MARKETMAN_SUPPLIER_TARGET_EMAIL = 'russop71@gmail.com';

  const MARKETMAN_SUPPLIER_CONTACTS: Record<string, Pick<Supplier, 'contactPerson' | 'email' | 'phone' | 'address' | 'paymentTerms' | 'notes'>> = {
    'daily seafood': {
      contactPerson: '',
      email: MARKETMAN_SUPPLIER_TARGET_EMAIL,
      phone: '416-4619449',
      address: '',
      paymentTerms: '',
      notes: '',
    },
    woodward: {
      contactPerson: '',
      email: MARKETMAN_SUPPLIER_TARGET_EMAIL,
      phone: '905-847-7200',
      address: '',
      paymentTerms: '',
      notes: '',
    },
    eccolo: {
      contactPerson: '',
      email: MARKETMAN_SUPPLIER_TARGET_EMAIL,
      phone: '416-661-1994',
      address: '',
      paymentTerms: '',
      notes: '',
    },
    bondi: {
      contactPerson: '',
      email: MARKETMAN_SUPPLIER_TARGET_EMAIL,
      phone: '',
      address: '',
      paymentTerms: '',
      notes: '',
    },
  };

  const getMarketmanContactByName = (name: string) => {
    const normalized = name.trim().toLowerCase();
    if (normalized.includes('daily seafood')) return MARKETMAN_SUPPLIER_CONTACTS['daily seafood'];
    if (normalized.includes('woodward')) return MARKETMAN_SUPPLIER_CONTACTS.woodward;
    if (normalized.includes('eccolo')) return MARKETMAN_SUPPLIER_CONTACTS.eccolo;
    if (normalized.includes('bondi')) return MARKETMAN_SUPPLIER_CONTACTS.bondi;
    return null;
  };

  const createMarketmanSeedSuppliers = (): Supplier[] => {
    const now = new Date().toISOString();
    return [
      {
        id: `${Date.now()}-daily-seafood`,
        name: 'Daily Seafood',
        ...MARKETMAN_SUPPLIER_CONTACTS['daily seafood'],
        category: 'Seafood',
        dateAdded: now,
        source: 'manual',
      },
      {
        id: `${Date.now()}-woodward`,
        name: 'Woodward',
        ...MARKETMAN_SUPPLIER_CONTACTS.woodward,
        category: 'Other',
        dateAdded: now,
        source: 'manual',
      },
      {
        id: `${Date.now()}-eccolo`,
        name: 'Eccolo',
        ...MARKETMAN_SUPPLIER_CONTACTS.eccolo,
        category: 'Other',
        dateAdded: now,
        source: 'manual',
      },
      {
        id: `${Date.now()}-bondi-produce`,
        name: 'Bondi Produce',
        ...MARKETMAN_SUPPLIER_CONTACTS.bondi,
        category: 'Produce',
        dateAdded: now,
        source: 'manual',
      },
    ];
  };

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [storageAreas, setStorageAreas] = useState<string[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [forecasts, setForecasts] = useState<ForecastData[]>([]);
  const [orders, setOrders] = useState<DailyOrder[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [preppedRecipes, setPreppedRecipes] = useState<PreppedRecipe[]>([]);
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
  ) => {
    const inventoryKey = localKey('inventory');
    const recipesKey = localKey('recipes');
    const storageAreasKey = localKey('storageAreas');
    const ordersKey = localKey('orders');
    const invoicesKey = localKey('invoices');
    const suppliersKey = localKey('suppliers');
    const preppedRecipesKey = localKey('preppedRecipes');
    if (inventoryKey) localStorage.setItem(inventoryKey, JSON.stringify(nextInventory));
    if (recipesKey) localStorage.setItem(recipesKey, JSON.stringify(nextRecipes));
    if (storageAreasKey) localStorage.setItem(storageAreasKey, JSON.stringify(nextStorageAreas));
    if (ordersKey) localStorage.setItem(ordersKey, JSON.stringify(nextOrders));
    if (invoicesKey) localStorage.setItem(invoicesKey, JSON.stringify(nextInvoices));
    if (suppliersKey) localStorage.setItem(suppliersKey, JSON.stringify(nextSuppliers));
    if (preppedRecipesKey) localStorage.setItem(preppedRecipesKey, JSON.stringify(nextPreppedRecipes));
  };

  const saveLocationData = (
    nextInventory: InventoryItem[],
    nextRecipes: Recipe[],
    nextStorageAreas: string[],
    nextOrders: DailyOrder[] = orders,
    nextInvoices: InvoiceRecord[] = invoices,
    nextSuppliers: Supplier[] = suppliers,
    nextPreppedRecipes: PreppedRecipe[] = preppedRecipes,
  ) => {
    if (!accountId || !activeLocationId) return;
    const currentLocalInventory = readScopedJson<InventoryItem[]>(localKey('inventory'), []);
    const currentLocalRecipes = readScopedJson<Recipe[]>(localKey('recipes'), []);
    const currentLocalStorageAreas = readScopedJson<string[]>(localKey('storageAreas'), []);
    const currentLocalOrders = readScopedJson<DailyOrder[]>(localKey('orders'), []);
    const currentLocalInvoices = readScopedJson<InvoiceRecord[]>(localKey('invoices'), []);
    const currentLocalSuppliers = readScopedJson<Supplier[]>(localKey('suppliers'), []);
    const currentLocalPreppedRecipes = readScopedJson<PreppedRecipe[]>(localKey('preppedRecipes'), []);

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

    persistLocalLocationData(
      effectiveInventory,
      effectiveRecipes,
      effectiveStorageAreas,
      effectiveOrders,
      effectiveInvoices,
      effectiveSuppliers,
      effectivePreppedRecipes,
    );
    if (!token) return;
    void apiRequest<LocationPayload>(`/api/v1/accounts/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(activeLocationId)}/data`, {
      method: 'PUT',
      body: JSON.stringify({
        inventory: effectiveInventory,
        recipes: effectiveRecipes,
        storageAreas: effectiveStorageAreas,
        orders: effectiveOrders,
        invoices: effectiveInvoices,
        suppliers: effectiveSuppliers,
        preppedRecipes: effectivePreppedRecipes,
      }),
    }).catch(error => {
      console.error('Failed to sync location data', error);
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

    const demoData = buildDemoLocationData();
    const fallbackInventory = demoData.inventory as unknown as InventoryItem[];
    const fallbackRecipes = demoData.recipes as unknown as Recipe[];
    const fallbackStorageAreas = demoData.storageAreas;

    if (!token) {
      const nextStorageAreas = sortUniqueStorageAreas([
        ...DEFAULT_STORAGE_AREAS,
        ...localStorageAreas,
        ...localInventory.map(item => normalizeStorageArea(item.storageArea)),
      ]);
      setInventory(localInventory.length > 0 ? localInventory : fallbackInventory);
      setRecipes(localRecipes.length > 0 ? localRecipes : fallbackRecipes);
      setStorageAreas(nextStorageAreas.length > 0 ? nextStorageAreas : fallbackStorageAreas);
      setOrders(readScopedJson<DailyOrder[]>(localKey('orders'), []));
      setInvoices(readScopedJson<InvoiceRecord[]>(localKey('invoices'), []));
      setSuppliers(readScopedJson<Supplier[]>(localKey('suppliers'), []));
      setPreppedRecipes(readScopedJson<PreppedRecipe[]>(localKey('preppedRecipes'), []).map(recipe => normalizePreppedRecipe(recipe)));
      setIsLocationLoaded(true);
      return;
    }

    try {
      const payload = await apiRequest<LocationPayload>(`/api/v1/accounts/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(activeLocationId)}/data`);
      const merged = mergeLocationData(
        {
          inventory: localInventory,
          recipes: localRecipes,
          storageAreas: localStorageAreas,
          orders: readScopedJson<DailyOrder[]>(localKey('orders'), []),
          invoices: readScopedJson<InvoiceRecord[]>(localKey('invoices'), []),
          suppliers: readScopedJson<Supplier[]>(localKey('suppliers'), []),
          preppedRecipes: readScopedJson<PreppedRecipe[]>(localKey('preppedRecipes'), []).map(recipe => normalizePreppedRecipe(recipe)),
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

      const serverHasData = apiInventory.length > 0 || apiRecipes.length > 0 || apiStorageAreas.length > 0 || apiOrders.length > 0 || apiInvoices.length > 0 || apiSuppliers.length > 0 || apiPreppedRecipes.length > 0;
      const hasLocalData = localInventory.length > 0 || localRecipes.length > 0 || localStorageAreas.length > 0 || readScopedJson<DailyOrder[]>(localKey('orders'), []).length > 0 || readScopedJson<InvoiceRecord[]>(localKey('invoices'), []).length > 0 || readScopedJson<Supplier[]>(localKey('suppliers'), []).length > 0 || readScopedJson<PreppedRecipe[]>(localKey('preppedRecipes'), []).length > 0;
      const shouldPreferLocalInventory = !serverHasData && localInventory.length > 0;
      const apiIngredientCount = apiRecipes.reduce((count, recipe) => count + (recipe.ingredients?.length || 0), 0);
      const localIngredientCount = localRecipes.reduce((count, recipe) => count + (recipe.ingredients?.length || 0), 0);
      const shouldPreferLocalRecipes = shouldPreferLocalInventory || (!serverHasData && localIngredientCount > apiIngredientCount);

      const nextInventory = serverHasData ? apiInventory : (shouldPreferLocalInventory ? localInventory : (hasLocalData ? localInventory : fallbackInventory));
      const nextRecipes = serverHasData ? apiRecipes : (shouldPreferLocalRecipes ? localRecipes : (hasLocalData ? localRecipes : fallbackRecipes));
      const nextStorageAreas = serverHasData ? apiStorageAreas : (shouldPreferLocalInventory ? localStorageAreas : (hasLocalData ? localStorageAreas : fallbackStorageAreas));
      const nextOrders = serverHasData ? apiOrders : readScopedJson<DailyOrder[]>(localKey('orders'), []);
      const nextInvoices = serverHasData ? apiInvoices : readScopedJson<InvoiceRecord[]>(localKey('invoices'), []);
      const nextSuppliers = serverHasData ? apiSuppliers : readScopedJson<Supplier[]>(localKey('suppliers'), []);
      const nextPreppedRecipes = serverHasData ? apiPreppedRecipes : readScopedJson<PreppedRecipe[]>(localKey('preppedRecipes'), []).map(recipe => normalizePreppedRecipe(recipe));

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
      setIsLocationLoaded(true);

      if (serverHasData && (nextInventory.length > 0 || nextRecipes.length > 0 || nextOrders.length > 0 || nextInvoices.length > 0 || nextSuppliers.length > 0 || nextPreppedRecipes.length > 0)) {
        persistLocalLocationData(nextInventory, nextRecipes, nextStorageAreas, nextOrders, nextInvoices, nextSuppliers, nextPreppedRecipes);
      }
    } catch (error) {
      const localStorageAreas = sortUniqueStorageAreas([
        ...DEFAULT_STORAGE_AREAS,
        ...readScopedJson<string[]>(localKey('storageAreas'), []),
        ...localInventory.map(item => normalizeStorageArea(item.storageArea)),
      ]);
      const fallbackInventory = buildDemoLocationData().inventory as unknown as InventoryItem[];
      const fallbackRecipes = buildDemoLocationData().recipes as unknown as Recipe[];
      const fallbackStorageAreas = buildDemoLocationData().storageAreas;
      setInventory(localInventory.length > 0 ? localInventory : fallbackInventory);
      setRecipes(localRecipes.length > 0 ? localRecipes : fallbackRecipes);
      setStorageAreas(localStorageAreas.length > 0 ? localStorageAreas : fallbackStorageAreas);
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
      setIsLocationLoaded(true);
      return;
    }

    setIsLocationLoaded(false);
    void loadLocationData();

    const forecastKey = localKey('forecasts');
    const ordersKey = localKey('orders');
    const invoicesKey = localKey('invoices');
    const suppliersKey = localKey('suppliers');
    const suppliersSeedKey = localKey('suppliers-seed-marketman-russop71-v1');
    const preppedKey = localKey('preppedRecipes');
    const normalizedEmail = user?.email?.trim().toLowerCase() || '';

    setForecasts(readScopedJson<ForecastData[]>(forecastKey, []));
    setOrders(readScopedJson<DailyOrder[]>(ordersKey, []));
    setInvoices(readScopedJson<InvoiceRecord[]>(invoicesKey, []));
    const existingSuppliers = readScopedJson<Supplier[]>(suppliersKey, []);
    const hasSeededSuppliers = suppliersSeedKey ? localStorage.getItem(suppliersSeedKey) === 'true' : false;

    if (
      normalizedEmail === MARKETMAN_SUPPLIER_TARGET_EMAIL &&
      existingSuppliers.length === 0 &&
      !hasSeededSuppliers
    ) {
      const seeded = createMarketmanSeedSuppliers();
      setSuppliers(seeded);
      if (suppliersKey) {
        localStorage.setItem(suppliersKey, JSON.stringify(seeded));
      }
      if (suppliersSeedKey) {
        localStorage.setItem(suppliersSeedKey, 'true');
      }
    } else {
      setSuppliers(existingSuppliers);
    }

    setPreppedRecipes(readScopedJson<PreppedRecipe[]>(preppedKey, []).map(recipe => normalizePreppedRecipe(recipe)));
  }, [accountId, activeLocationId, user?.email, token]);

  useEffect(() => {
    if (!accountId || !activeLocationId || !token) return;
    if (pollRef.current) window.clearInterval(pollRef.current);

    pollRef.current = window.setInterval(() => {
      void loadLocationData(true);
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
    const key = localKey('preppedRecipes');
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(preppedRecipes));
  }, [preppedRecipes, accountId, activeLocationId]);

  useEffect(() => {
    if (!accountId || !activeLocationId) return;
    const normalizedEmail = user?.email?.trim().toLowerCase() || '';
    if (normalizedEmail !== MARKETMAN_SUPPLIER_TARGET_EMAIL) return;

    const suppliersKey = localKey('suppliers');
    if (!suppliersKey || suppliers.length === 0) return;

    let changed = false;
    const nextSuppliers = suppliers.map(supplier => {
      const marketmanDefaults = getMarketmanContactByName(supplier.name);
      if (!marketmanDefaults) return supplier;

      const nextSupplier: Supplier = { ...supplier };
      if (!nextSupplier.contactPerson && marketmanDefaults.contactPerson) {
        nextSupplier.contactPerson = marketmanDefaults.contactPerson;
        changed = true;
      }
      if (!nextSupplier.email && marketmanDefaults.email) {
        nextSupplier.email = marketmanDefaults.email;
        changed = true;
      }
      if (!nextSupplier.phone && marketmanDefaults.phone) {
        nextSupplier.phone = marketmanDefaults.phone;
        changed = true;
      }
      if (!nextSupplier.address && marketmanDefaults.address) {
        nextSupplier.address = marketmanDefaults.address;
        changed = true;
      }
      return nextSupplier;
    });

    if (changed) {
      setSuppliers(nextSuppliers);
      localStorage.setItem(suppliersKey, JSON.stringify(nextSuppliers));
    }
  }, [suppliers, accountId, activeLocationId, user?.email]);

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
    const supplierName = invoiceInput.vendor.trim() || 'Unknown supplier';
    const normalizedSupplier = supplierName.toLowerCase();
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
        const matchingOption = existingOptions.find(option => option.supplier.trim().toLowerCase() === normalizedSupplier);
        const isPrimarySupplier = shouldBecomePrimary || matchingOption?.isMain === true || existingItem.supplier.trim().toLowerCase() === normalizedSupplier;
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

    const nextSuppliers = suppliers.some(supplier => supplier.name.trim().toLowerCase() === normalizedSupplier)
      ? suppliers
      : [...suppliers, {
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
