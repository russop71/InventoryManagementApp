import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  unit: string;
  unitCost: number;
  parLevel: number;
  supplier: string;
  reorderPoint?: number;
  lastUpdated?: string;
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
  status: 'pending' | 'ordered' | 'received';
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

interface InventoryContextType {
  inventory: InventoryItem[];
  recipes: Recipe[];
  forecasts: ForecastData[];
  orders: DailyOrder[];
  suppliers: Supplier[];
  addInventoryItem: (item: Omit<InventoryItem, 'id'>) => void;
  updateInventoryItem: (id: string, item: Partial<InventoryItem>) => void;
  deleteInventoryItem: (id: string) => void;
  adjustInventory: (id: string, change: number, reason: string) => void;
  addRecipe: (recipe: Omit<Recipe, 'id'>) => void;
  updateRecipe: (id: string, recipe: Partial<Recipe>) => void;
  deleteRecipe: (id: string) => void;
  syncToastMenuItems: (toastMenuItems: any[]) => void;
  addForecast: (forecast: Omit<ForecastData, 'id'>) => void;
  generateDailyOrder: (forecastId: string) => void;
  updateOrderStatus: (orderId: string, status: DailyOrder['status']) => void;
  addSupplier: (supplier: Omit<Supplier, 'id' | 'dateAdded'>) => void;
  updateSupplier: (id: string, supplier: Partial<Supplier>) => void;
  deleteSupplier: (id: string) => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    const saved = localStorage.getItem('inventory');
    return saved ? JSON.parse(saved) : [
      {
        id: '1',
        name: 'Chicken Breast',
        category: 'Proteins',
        currentStock: 50,
        unit: 'lbs',
        unitCost: 4.50,
        parLevel: 100,
        supplier: 'Fresh Farms',
        reorderPoint: 30,
        lastUpdated: '2026-03-25',
        priceHistory: [
          {
            date: '2026-03-01T10:00:00.000Z',
            oldPrice: 4.25,
            newPrice: 4.50,
            reason: 'Price increase from supplier'
          },
          {
            date: '2026-02-15T14:30:00.000Z',
            oldPrice: 4.00,
            newPrice: 4.25,
            reason: 'Seasonal price adjustment'
          }
        ],
        history: [
          {
            date: '2026-03-25T09:00:00.000Z',
            change: 25,
            reason: 'Delivery received',
            newStock: 50
          },
          {
            date: '2026-03-24T16:00:00.000Z',
            change: -15,
            reason: 'Count adjustment',
            newStock: 25
          }
        ]
      },
      {
        id: '2',
        name: 'Ground Beef',
        category: 'Proteins',
        currentStock: 30,
        unit: 'lbs',
        unitCost: 6.75,
        parLevel: 80,
        supplier: 'Quality Meats Co',
        reorderPoint: 25,
        lastUpdated: '2026-03-24'
      },
      {
        id: '3',
        name: 'Roma Tomatoes',
        category: 'Produce',
        currentStock: 20,
        unit: 'lbs',
        unitCost: 2.25,
        parLevel: 50,
        supplier: 'Farm Fresh Produce',
        reorderPoint: 15,
        lastUpdated: '2026-03-26'
      },
      {
        id: '4',
        name: 'Onions',
        category: 'Produce',
        currentStock: 35,
        unit: 'lbs',
        unitCost: 1.50,
        parLevel: 60,
        supplier: 'Farm Fresh Produce',
        reorderPoint: 20,
        lastUpdated: '2026-03-26'
      },
      {
        id: '5',
        name: 'Mozzarella Cheese',
        category: 'Dairy',
        currentStock: 15,
        unit: 'lbs',
        unitCost: 5.25,
        parLevel: 40,
        supplier: 'Dairy Direct',
        reorderPoint: 12,
        lastUpdated: '2026-03-25'
      },
      {
        id: '6',
        name: 'Olive Oil',
        category: 'Pantry',
        currentStock: 8,
        unit: 'gallons',
        unitCost: 22.00,
        parLevel: 15,
        supplier: 'Global Foods',
        reorderPoint: 5,
        lastUpdated: '2026-03-20'
      },
      {
        id: '7',
        name: 'Pasta',
        category: 'Pantry',
        currentStock: 40,
        unit: 'lbs',
        unitCost: 1.75,
        parLevel: 80,
        supplier: 'Global Foods',
        reorderPoint: 25,
        lastUpdated: '2026-03-23'
      },
      {
        id: '8',
        name: 'Lettuce',
        category: 'Produce',
        currentStock: 12,
        unit: 'heads',
        unitCost: 1.25,
        parLevel: 30,
        supplier: 'Farm Fresh Produce',
        reorderPoint: 10,
        lastUpdated: '2026-03-26'
      }
    ];
  });

  const [recipes, setRecipes] = useState<Recipe[]>(() => {
    const saved = localStorage.getItem('recipes');
    return saved ? JSON.parse(saved) : [
      {
        id: '1',
        menuItemName: 'Chicken Parmesan',
        category: 'Main Course',
        price: 15.99,
        ingredients: [
          { inventoryItemId: '1', quantity: 1, unit: 'lbs' },
          { inventoryItemId: '5', quantity: 0.5, unit: 'lbs' },
          { inventoryItemId: '6', quantity: 0.25, unit: 'gallons' },
          { inventoryItemId: '7', quantity: 0.5, unit: 'lbs' },
        ],
        modifiers: [
          {
            name: 'Add Mushrooms',
            ingredientChanges: [
              { inventoryItemId: '3', quantity: 0.5 },
            ],
          },
        ],
      },
      {
        id: '2',
        menuItemName: 'Beef Stew',
        category: 'Main Course',
        price: 14.99,
        ingredients: [
          { inventoryItemId: '2', quantity: 1, unit: 'lbs' },
          { inventoryItemId: '3', quantity: 1, unit: 'lbs' },
          { inventoryItemId: '4', quantity: 1, unit: 'lbs' },
          { inventoryItemId: '5', quantity: 0.5, unit: 'lbs' },
        ],
      },
    ];
  });

  const [forecasts, setForecasts] = useState<ForecastData[]>(() => {
    const saved = localStorage.getItem('forecasts');
    return saved ? JSON.parse(saved) : [
      {
        id: '1',
        date: '2026-03-28',
        expectedCovers: 150,
        items: [
          { itemId: '1', expectedUsage: 25 },
          { itemId: '2', expectedUsage: 15 },
          { itemId: '3', expectedUsage: 10 },
          { itemId: '4', expectedUsage: 8 },
          { itemId: '5', expectedUsage: 12 },
        ]
      }
    ];
  });

  const [orders, setOrders] = useState<DailyOrder[]>(() => {
    const saved = localStorage.getItem('orders');
    return saved ? JSON.parse(saved) : [];
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    const saved = localStorage.getItem('suppliers');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('inventory', JSON.stringify(inventory));
  }, [inventory]);

  useEffect(() => {
    localStorage.setItem('recipes', JSON.stringify(recipes));
  }, [recipes]);

  useEffect(() => {
    localStorage.setItem('forecasts', JSON.stringify(forecasts));
  }, [forecasts]);

  useEffect(() => {
    localStorage.setItem('orders', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem('suppliers', JSON.stringify(suppliers));
  }, [suppliers]);

  const addInventoryItem = (item: Omit<InventoryItem, 'id'>) => {
    const newItem = {
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    setInventory(prev => [...prev, newItem]);
  };

  const updateInventoryItem = (id: string, updates: Partial<InventoryItem>) => {
    setInventory(inventory.map(item => {
      if (item.id === id) {
        // Track price changes
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
            }
          ];
          return { ...item, ...updates, priceHistory: newPriceHistory };
        }
        return { ...item, ...updates };
      }
      return item;
    }));
  };

  const deleteInventoryItem = (id: string) => {
    setInventory(inventory.filter(item => item.id !== id));
  };

  const adjustInventory = (id: string, change: number, reason: string) => {
    setInventory(inventory.map(item => {
      if (item.id === id) {
        const newStock = item.currentStock + change;
        const newHistory = [
          ...(item.history || []),
          {
            date: new Date().toISOString(),
            change,
            reason,
            newStock,
          }
        ];
        return {
          ...item,
          currentStock: newStock,
          history: newHistory,
        };
      }
      return item;
    }));
  };

  const addRecipe = (recipe: Omit<Recipe, 'id'>) => {
    const newRecipe = {
      ...recipe,
      id: Date.now().toString(),
    };
    setRecipes([...recipes, newRecipe]);
  };

  const updateRecipe = (id: string, updates: Partial<Recipe>) => {
    setRecipes(recipes.map(recipe => 
      recipe.id === id ? { ...recipe, ...updates } : recipe
    ));
  };

  const deleteRecipe = (id: string) => {
    setRecipes(recipes.filter(recipe => recipe.id !== id));
  };

  const syncToastMenuItems = (toastMenuItems: any[]) => {
    const newRecipes: Recipe[] = toastMenuItems.map(item => ({
      id: Date.now().toString(),
      menuItemName: item.name,
      category: item.category,
      price: item.price,
      ingredients: item.ingredients.map((ingredient: any) => ({
        inventoryItemId: ingredient.inventoryItemId,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
      })),
      modifiers: item.modifiers ? item.modifiers.map((modifier: any) => ({
        name: modifier.name,
        ingredientChanges: modifier.ingredientChanges.map((change: any) => ({
          inventoryItemId: change.inventoryItemId,
          quantity: change.quantity,
        })),
      })) : [],
      source: 'toast' as const,
      externalId: item.id,
    }));
    setRecipes([...recipes, ...newRecipes]);
  };

  const addForecast = (forecast: Omit<ForecastData, 'id'>) => {
    const newForecast = {
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

      const projectedStock = item.currentStock - expectedUsage;
      
      if (projectedStock < item.parLevel) {
        const quantityNeeded = item.parLevel - projectedStock;
        orderItems.push({
          itemId,
          quantity: quantityNeeded,
          cost: quantityNeeded * item.unitCost,
        });
      }
    });

    const totalCost = orderItems.reduce((sum, item) => sum + item.cost, 0);

    const newOrder: DailyOrder = {
      id: Date.now().toString(),
      date: forecast.date,
      items: orderItems,
      totalCost,
      status: 'pending',
    };

    setOrders([...orders, newOrder]);
  };

  const updateOrderStatus = (orderId: string, status: DailyOrder['status']) => {
    setOrders(orders.map(order =>
      order.id === orderId ? { ...order, status } : order
    ));
  };

  const addSupplier = (supplier: Omit<Supplier, 'id' | 'dateAdded'>) => {
    const newSupplier = {
      ...supplier,
      id: Date.now().toString(),
      dateAdded: new Date().toISOString(),
    };
    setSuppliers([...suppliers, newSupplier]);
  };

  const updateSupplier = (id: string, updates: Partial<Supplier>) => {
    setSuppliers(suppliers.map(supplier => 
      supplier.id === id ? { ...supplier, ...updates } : supplier
    ));
  };

  const deleteSupplier = (id: string) => {
    setSuppliers(suppliers.filter(supplier => supplier.id !== id));
  };

  return (
    <InventoryContext.Provider
      value={{
        inventory,
        recipes,
        forecasts,
        orders,
        suppliers,
        addInventoryItem,
        updateInventoryItem,
        deleteInventoryItem,
        adjustInventory,
        addRecipe,
        updateRecipe,
        deleteRecipe,
        syncToastMenuItems,
        addForecast,
        generateDailyOrder,
        updateOrderStatus,
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
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
}