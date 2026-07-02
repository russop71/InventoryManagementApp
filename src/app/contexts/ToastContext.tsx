import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

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
  price: number;
  ingredients: {
    inventoryItemId: string;
    quantity: number;
  }[];
}

interface ToastContextType {
  isConnected: boolean;
  apiKey: string;
  restaurantId: string;
  salesData: ToastSalesData[];
  menuItems: ToastMenuItem[];
  connectToast: (apiKey: string, restaurantId: string) => void;
  disconnectToast: () => void;
  syncData: () => Promise<void>;
  lastSync: string | null;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(() => {
    return localStorage.getItem('toastConnected') === 'true';
  });
  
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem('toastApiKey') || '';
  });
  
  const [restaurantId, setRestaurantId] = useState(() => {
    return localStorage.getItem('toastRestaurantId') || '';
  });

  const [lastSync, setLastSync] = useState<string | null>(() => {
    return localStorage.getItem('toastLastSync');
  });

  // Mock Toast sales data
  const [salesData, setSalesData] = useState<ToastSalesData[]>(() => {
    const saved = localStorage.getItem('toastSalesData');
    return saved ? JSON.parse(saved) : [
      {
        date: '2026-03-26',
        covers: 145,
        revenue: 3250.50,
        topItems: [
          { itemName: 'Grilled Chicken Sandwich', quantity: 35, revenue: 420.00 },
          { itemName: 'Caesar Salad', quantity: 28, revenue: 336.00 },
          { itemName: 'Ribeye Steak', quantity: 22, revenue: 638.00 },
          { itemName: 'Margherita Pizza', quantity: 30, revenue: 450.00 },
        ]
      },
      {
        date: '2026-03-25',
        covers: 132,
        revenue: 2980.75,
        topItems: [
          { itemName: 'Grilled Chicken Sandwich', quantity: 32, revenue: 384.00 },
          { itemName: 'Caesar Salad', quantity: 25, revenue: 300.00 },
          { itemName: 'Ribeye Steak', quantity: 18, revenue: 522.00 },
          { itemName: 'Margherita Pizza', quantity: 27, revenue: 405.00 },
        ]
      },
      {
        date: '2026-03-24',
        covers: 158,
        revenue: 3520.25,
        topItems: [
          { itemName: 'Grilled Chicken Sandwich', quantity: 40, revenue: 480.00 },
          { itemName: 'Caesar Salad', quantity: 32, revenue: 384.00 },
          { itemName: 'Ribeye Steak', quantity: 25, revenue: 725.00 },
          { itemName: 'Margherita Pizza', quantity: 35, revenue: 525.00 },
        ]
      },
    ];
  });

  // Mock Toast menu items with ingredient mappings
  const [menuItems, setMenuItems] = useState<ToastMenuItem[]>(() => {
    const saved = localStorage.getItem('toastMenuItems');
    return saved ? JSON.parse(saved) : [
      {
        id: 'toast-1',
        name: 'Grilled Chicken Sandwich',
        category: 'Entrees',
        price: 12.00,
        ingredients: [
          { inventoryItemId: '1', quantity: 0.33 }, // Chicken Breast
          { inventoryItemId: '8', quantity: 0.15 }, // Lettuce
          { inventoryItemId: '3', quantity: 0.1 },  // Tomatoes
        ]
      },
      {
        id: 'toast-2',
        name: 'Caesar Salad',
        category: 'Salads',
        price: 12.00,
        ingredients: [
          { inventoryItemId: '8', quantity: 0.25 }, // Lettuce
          { inventoryItemId: '5', quantity: 0.1 },  // Mozzarella (as parmesan substitute)
        ]
      },
      {
        id: 'toast-3',
        name: 'Ribeye Steak',
        category: 'Entrees',
        price: 29.00,
        ingredients: [
          { inventoryItemId: '2', quantity: 0.75 }, // Ground Beef (as steak substitute)
          { inventoryItemId: '4', quantity: 0.1 },  // Onions
        ]
      },
      {
        id: 'toast-4',
        name: 'Margherita Pizza',
        category: 'Pizza',
        price: 15.00,
        ingredients: [
          { inventoryItemId: '7', quantity: 0.2 },  // Pasta (as dough substitute)
          { inventoryItemId: '5', quantity: 0.3 },  // Mozzarella
          { inventoryItemId: '3', quantity: 0.2 },  // Tomatoes
          { inventoryItemId: '6', quantity: 0.05 }, // Olive Oil
        ]
      },
    ];
  });

  useEffect(() => {
    localStorage.setItem('toastSalesData', JSON.stringify(salesData));
  }, [salesData]);

  useEffect(() => {
    localStorage.setItem('toastMenuItems', JSON.stringify(menuItems));
  }, [menuItems]);

  const connectToast = (key: string, id: string) => {
    setApiKey(key);
    setRestaurantId(id);
    setIsConnected(true);
    localStorage.setItem('toastApiKey', key);
    localStorage.setItem('toastRestaurantId', id);
    localStorage.setItem('toastConnected', 'true');
  };

  const disconnectToast = () => {
    setIsConnected(false);
    setApiKey('');
    setRestaurantId('');
    localStorage.removeItem('toastApiKey');
    localStorage.removeItem('toastRestaurantId');
    localStorage.setItem('toastConnected', 'false');
  };

  const syncData = async () => {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // In a real app, this would fetch from Toast API
    // For now, we'll just update the last sync time
    const now = new Date().toISOString();
    setLastSync(now);
    localStorage.setItem('toastLastSync', now);
  };

  return (
    <ToastContext.Provider
      value={{
        isConnected,
        apiKey,
        restaurantId,
        salesData,
        menuItems,
        connectToast,
        disconnectToast,
        syncData,
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
