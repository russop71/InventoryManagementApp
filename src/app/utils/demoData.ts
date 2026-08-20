export interface DemoLocationData {
  inventory: Array<{
    id: string;
    name: string;
    category: string;
    storageArea: string;
    currentStock: number;
    unit: string;
    unitCost: number;
    parLevel: number;
    supplier: string;
    notes?: string;
  }>;
  recipes: Array<{
    id: string;
    menuItemName: string;
    category: string;
    price: number;
    ingredients: Array<{
      inventoryItemId: string;
      quantity: number;
      unit: string;
    }>;
  }>;
  storageAreas: string[];
  suppliers: Array<Record<string, unknown>>;
  orders: Array<Record<string, unknown>>;
  invoices: Array<Record<string, unknown>>;
}

export function buildDemoLocationData(): DemoLocationData {
  const inventory = [
      {
        id: 'demo-ground-beef',
        name: 'Ground Beef',
        category: 'Proteins',
        storageArea: 'Freezer',
        currentStock: 10,
        unit: 'lb',
        unitCost: 8.5,
        parLevel: 15,
        supplier: 'Woodward Meats',
        notes: 'High-volume weekend item',
      },
      {
        id: 'demo-chicken-breast',
        name: 'Chicken Breast',
        category: 'Proteins',
        storageArea: 'Walk-In Cooler',
        currentStock: 8,
        unit: 'lb',
        unitCost: 5.2,
        parLevel: 12,
        supplier: 'Bondi Produce',
      },
      {
        id: 'demo-mozzarella',
        name: 'Mozzarella',
        category: 'Dairy',
        storageArea: 'Walk-In Cooler',
        currentStock: 6,
        unit: 'lb',
        unitCost: 4.8,
        parLevel: 10,
        supplier: 'Eccolo',
      },
      {
        id: 'demo-tomato-sauce',
        name: 'Tomato Sauce',
        category: 'Other',
        storageArea: 'Dry Storage',
        currentStock: 12,
        unit: 'case',
        unitCost: 3.2,
        parLevel: 18,
        supplier: 'GFS',
      },
      { id: 'demo-salmon', name: 'Atlantic Salmon', category: 'Proteins', storageArea: 'Walk-In Cooler', currentStock: 7, unit: 'lb', unitCost: 14.8, parLevel: 18, supplier: 'Daily Seafood', notes: 'Latest price increased 8.4%' },
      { id: 'demo-olive-oil', name: 'Extra Virgin Olive Oil', category: 'Dry Goods', storageArea: 'Dry Storage', currentStock: 3, unit: 'L', unitCost: 12.4, parLevel: 10, supplier: 'GFS' },
      { id: 'demo-flour', name: '00 Pizza Flour', category: 'Dry Goods', storageArea: 'Dry Storage', currentStock: 42, unit: 'kg', unitCost: 2.15, parLevel: 35, supplier: 'Eccolo' },
      { id: 'demo-parmigiano', name: 'Parmigiano Reggiano', category: 'Dairy', storageArea: 'Walk-In Cooler', currentStock: 2.5, unit: 'kg', unitCost: 31.5, parLevel: 8, supplier: 'Eccolo' },
      { id: 'demo-arugula', name: 'Baby Arugula', category: 'Produce', storageArea: 'Walk-In Cooler', currentStock: 5, unit: 'lb', unitCost: 7.2, parLevel: 8, supplier: 'Bondi Produce' },
      { id: 'demo-potatoes', name: 'Russet Potatoes', category: 'Produce', storageArea: 'Dry Storage', currentStock: 36, unit: 'lb', unitCost: 1.35, parLevel: 30, supplier: 'Bondi Produce' },
      { id: 'demo-brioche', name: 'Brioche Buns', category: 'Bakery', storageArea: 'Freezer', currentStock: 38, unit: 'each', unitCost: 0.82, parLevel: 50, supplier: 'GFS' },
      { id: 'demo-wine', name: 'House Pinot Grigio', category: 'Beverage', storageArea: 'Wine Cellar', currentStock: 16, unit: 'bottle', unitCost: 13.9, parLevel: 24, supplier: 'Vine Agency' },
      { id: 'demo-vodka', name: 'Premium Vodka 750ml', category: 'Liquor', storageArea: 'Bar', currentStock: 9, unit: 'bottle', unitCost: 29.5, parLevel: 12, supplier: 'LCBO' },
      { id: 'demo-gin', name: 'London Dry Gin 750ml', category: 'Liquor', storageArea: 'Bar', currentStock: 7, unit: 'bottle', unitCost: 33.25, parLevel: 10, supplier: 'LCBO' },
      { id: 'demo-lager', name: 'Local Lager 24-pack', category: 'Beer', storageArea: 'Bar', currentStock: 5, unit: 'case', unitCost: 54, parLevel: 8, supplier: 'The Beer Store' },
    ];
  const recipes = [
      {
        id: 'demo-brunch-burger',
        menuItemName: 'Brunch Burger',
        category: 'Sandwich',
        price: 24,
        ingredients: [
          { inventoryItemId: 'demo-ground-beef', quantity: 0.5, unit: 'lb' },
          { inventoryItemId: 'demo-mozzarella', quantity: 0.1, unit: 'lb' },
        ],
      },
      {
        id: 'demo-margherita-pizza',
        menuItemName: 'Margherita Pizza',
        category: 'Pizza',
        price: 22,
        ingredients: [
          { inventoryItemId: 'demo-mozzarella', quantity: 0.3, unit: 'lb' },
          { inventoryItemId: 'demo-tomato-sauce', quantity: 0.2, unit: 'case' },
        ],
      },
      {
        id: 'demo-chicken-sandwich',
        menuItemName: 'Chicken Sandwich',
        category: 'Sandwich',
        price: 19,
        ingredients: [
          { inventoryItemId: 'demo-chicken-breast', quantity: 0.4, unit: 'lb' },
          { inventoryItemId: 'demo-mozzarella', quantity: 0.05, unit: 'lb' },
        ],
      },
      { id: 'demo-salmon', menuItemName: 'Crispy Skin Salmon', category: 'Main', price: 34, ingredients: [{ inventoryItemId: 'demo-salmon', quantity: 0.5, unit: 'lb' }, { inventoryItemId: 'demo-potatoes', quantity: 0.4, unit: 'lb' }, { inventoryItemId: 'demo-olive-oil', quantity: 0.03, unit: 'L' }] },
      { id: 'demo-arugula-salad', menuItemName: 'Arugula & Parmigiano', category: 'Starter', price: 17, ingredients: [{ inventoryItemId: 'demo-arugula', quantity: 0.15, unit: 'lb' }, { inventoryItemId: 'demo-parmigiano', quantity: 0.04, unit: 'kg' }, { inventoryItemId: 'demo-olive-oil', quantity: 0.02, unit: 'L' }] },
      { id: 'demo-smash-burger', menuItemName: 'Double Smash Burger', category: 'Main', price: 26, ingredients: [{ inventoryItemId: 'demo-ground-beef', quantity: 0.5, unit: 'lb' }, { inventoryItemId: 'demo-brioche', quantity: 1, unit: 'each' }, { inventoryItemId: 'demo-mozzarella', quantity: 0.08, unit: 'lb' }] },
      { id: 'demo-fries', menuItemName: 'Sea Salt Fries', category: 'Side', price: 9, ingredients: [{ inventoryItemId: 'demo-potatoes', quantity: 0.6, unit: 'lb' }, { inventoryItemId: 'demo-olive-oil', quantity: 0.03, unit: 'L' }] },
      { id: 'demo-wine-glass', menuItemName: 'Pinot Grigio · 5oz', category: 'Wine', price: 14, ingredients: [{ inventoryItemId: 'demo-wine', quantity: 0.2, unit: 'bottle' }] },
      { id: 'demo-martini', menuItemName: 'House Martini', category: 'Cocktail', price: 18, ingredients: [{ inventoryItemId: 'demo-gin', quantity: 0.08, unit: 'bottle' }] },
      { id: 'demo-vodka-soda', menuItemName: 'Vodka Soda', category: 'Cocktail', price: 13, ingredients: [{ inventoryItemId: 'demo-vodka', quantity: 0.06, unit: 'bottle' }] },
      { id: 'demo-lager-pint', menuItemName: 'Local Lager', category: 'Beer', price: 9, ingredients: [{ inventoryItemId: 'demo-lager', quantity: 0.0417, unit: 'case' }] },
    ];
  const now = new Date().toISOString();
  return {
    inventory,
    recipes,
    storageAreas: ['Walk-In Cooler', 'Dry Storage', 'Freezer', 'Bar'],
    suppliers: [
      { id: 'demo-supplier-gfs', name: 'GFS', contactPerson: 'Alex Morgan', email: 'orders@example.test', phone: '416-555-0101', address: 'Toronto, ON', category: 'Broadline', paymentTerms: 'Net 30', notes: 'Tuesday and Friday delivery', dateAdded: now, source: 'manual' },
      { id: 'demo-supplier-seafood', name: 'Daily Seafood', contactPerson: 'Sam Lee', email: 'seafood@example.test', phone: '416-555-0118', address: 'Toronto, ON', category: 'Seafood', paymentTerms: 'Net 14', notes: 'Order before 2pm', dateAdded: now, source: 'manual' },
      { id: 'demo-supplier-produce', name: 'Bondi Produce', contactPerson: 'Taylor Singh', email: 'produce@example.test', phone: '416-555-0134', address: 'Toronto, ON', category: 'Produce', paymentTerms: 'Net 21', notes: 'Daily delivery', dateAdded: now, source: 'manual' },
      { id: 'demo-supplier-eccolo', name: 'Eccolo', contactPerson: 'Jordan Rossi', email: 'specialty@example.test', phone: '416-555-0172', address: 'Vaughan, ON', category: 'Specialty', paymentTerms: 'Net 30', notes: '', dateAdded: now, source: 'manual' },
    ],
    orders: [
      { id: 'demo-order-1', date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), items: [{ itemId: 'demo-salmon', quantity: 12, cost: 177.6 }, { itemId: 'demo-parmigiano', quantity: 6, cost: 189 }], totalCost: 366.6, status: 'pending' },
      { id: 'demo-order-2', date: new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10), items: [{ itemId: 'demo-potatoes', quantity: 30, cost: 40.5 }], totalCost: 40.5, status: 'received' },
    ],
    invoices: [
      { id: 'demo-invoice-1', date: new Date(Date.now() - 86400000).toISOString().slice(0, 10), invoiceNumber: 'DS-10482', supplier: 'Daily Seafood', items: [{ itemId: 'demo-salmon', quantity: 20, cost: 296 }], totalAmount: 296, status: 'received' },
      { id: 'demo-invoice-2', date: new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 10), invoiceNumber: 'BP-88217', supplier: 'Bondi Produce', items: [{ itemId: 'demo-arugula', quantity: 8, cost: 57.6 }, { itemId: 'demo-potatoes', quantity: 40, cost: 54 }], totalAmount: 111.6, status: 'received' },
    ],
  };
}
