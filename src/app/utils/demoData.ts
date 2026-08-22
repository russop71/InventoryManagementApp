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

export const DEMO_DATA_VERSION = '2026-08-21-restaurant-v2';

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
        supplier: 'Lakeside Meats',
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
        supplier: 'Lakeside Meats',
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
        supplier: 'Harbour Specialty Foods',
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
        supplier: 'Maple Foodservice',
      },
      { id: 'demo-salmon', name: 'Atlantic Salmon', category: 'Proteins', storageArea: 'Walk-In Cooler', currentStock: 7, unit: 'lb', unitCost: 14.8, parLevel: 18, supplier: 'Great Lakes Seafood', notes: 'Latest price increased 8.4%' },
      { id: 'demo-olive-oil', name: 'Extra Virgin Olive Oil', category: 'Dry Goods', storageArea: 'Dry Storage', currentStock: 3, unit: 'L', unitCost: 12.4, parLevel: 10, supplier: 'Maple Foodservice' },
      { id: 'demo-flour', name: '00 Pizza Flour', category: 'Dry Goods', storageArea: 'Dry Storage', currentStock: 42, unit: 'kg', unitCost: 2.15, parLevel: 35, supplier: 'Harbour Specialty Foods' },
      { id: 'demo-parmigiano', name: 'Parmigiano Reggiano', category: 'Dairy', storageArea: 'Walk-In Cooler', currentStock: 2.5, unit: 'kg', unitCost: 31.5, parLevel: 8, supplier: 'Harbour Specialty Foods' },
      { id: 'demo-arugula', name: 'Baby Arugula', category: 'Produce', storageArea: 'Walk-In Cooler', currentStock: 5, unit: 'lb', unitCost: 7.2, parLevel: 8, supplier: 'Northern Produce Co.' },
      { id: 'demo-potatoes', name: 'Russet Potatoes', category: 'Produce', storageArea: 'Dry Storage', currentStock: 36, unit: 'lb', unitCost: 1.35, parLevel: 30, supplier: 'Northern Produce Co.' },
      { id: 'demo-brioche', name: 'Brioche Buns', category: 'Bakery', storageArea: 'Freezer', currentStock: 38, unit: 'each', unitCost: 0.82, parLevel: 50, supplier: 'Maple Foodservice' },
      { id: 'demo-wine', name: 'House Pinot Grigio', category: 'Beverage', storageArea: 'Wine Cellar', currentStock: 16, unit: 'bottle', unitCost: 13.9, parLevel: 24, supplier: 'Cellar Door Imports' },
      { id: 'demo-vodka', name: 'Premium Vodka 750ml', category: 'Liquor', storageArea: 'Bar', currentStock: 9, unit: 'bottle', unitCost: 29.5, parLevel: 12, supplier: 'Ontario Beverage Retail' },
      { id: 'demo-gin', name: 'London Dry Gin 750ml', category: 'Liquor', storageArea: 'Bar', currentStock: 7, unit: 'bottle', unitCost: 33.25, parLevel: 10, supplier: 'Ontario Beverage Retail' },
      { id: 'demo-lager', name: 'Local Lager 24-pack', category: 'Beer', storageArea: 'Bar', currentStock: 5, unit: 'case', unitCost: 54, parLevel: 8, supplier: 'Ontario Beer Supply' },
      { id: 'demo-eggs', name: 'Large Eggs', category: 'Dairy', storageArea: 'Walk-In Cooler', currentStock: 96, unit: 'each', unitCost: 0.38, parLevel: 144, supplier: 'Maple Foodservice' },
      { id: 'demo-bacon', name: 'Smoked Bacon', category: 'Proteins', storageArea: 'Walk-In Cooler', currentStock: 12, unit: 'lb', unitCost: 7.9, parLevel: 18, supplier: 'Lakeside Meats' },
      { id: 'demo-sourdough', name: 'Sourdough Loaf', category: 'Bakery', storageArea: 'Dry Storage', currentStock: 14, unit: 'loaf', unitCost: 5.6, parLevel: 20, supplier: 'Maple Foodservice' },
      { id: 'demo-avocado', name: 'Hass Avocado', category: 'Produce', storageArea: 'Walk-In Cooler', currentStock: 28, unit: 'each', unitCost: 1.45, parLevel: 42, supplier: 'Northern Produce Co.' },
      { id: 'demo-butter', name: 'Unsalted Butter', category: 'Dairy', storageArea: 'Walk-In Cooler', currentStock: 7, unit: 'lb', unitCost: 6.25, parLevel: 12, supplier: 'Maple Foodservice' },
      { id: 'demo-lemon', name: 'Fresh Lemon', category: 'Produce', storageArea: 'Walk-In Cooler', currentStock: 34, unit: 'each', unitCost: 0.72, parLevel: 48, supplier: 'Northern Produce Co.' },
      { id: 'demo-lime', name: 'Fresh Lime', category: 'Produce', storageArea: 'Walk-In Cooler', currentStock: 38, unit: 'each', unitCost: 0.64, parLevel: 60, supplier: 'Northern Produce Co.' },
      { id: 'demo-garlic', name: 'Peeled Garlic', category: 'Produce', storageArea: 'Walk-In Cooler', currentStock: 3, unit: 'lb', unitCost: 5.4, parLevel: 5, supplier: 'Northern Produce Co.' },
      { id: 'demo-espresso', name: 'Espresso Beans', category: 'Beverage', storageArea: 'Dry Storage', currentStock: 8, unit: 'kg', unitCost: 27, parLevel: 12, supplier: 'Northline Coffee Roasters' },
      { id: 'demo-milk', name: 'Whole Milk', category: 'Dairy', storageArea: 'Walk-In Cooler', currentStock: 18, unit: 'L', unitCost: 2.2, parLevel: 28, supplier: 'Maple Foodservice' },
      { id: 'demo-tonic', name: 'Premium Tonic Water', category: 'Beverage', storageArea: 'Bar', currentStock: 42, unit: 'bottle', unitCost: 1.35, parLevel: 72, supplier: 'Maple Foodservice' },
      { id: 'demo-prosecco', name: 'House Prosecco', category: 'Wine', storageArea: 'Wine Cellar', currentStock: 18, unit: 'bottle', unitCost: 14.6, parLevel: 30, supplier: 'Cellar Door Imports' },
      { id: 'demo-orange-juice', name: 'Orange Juice', category: 'Beverage', storageArea: 'Walk-In Cooler', currentStock: 10, unit: 'L', unitCost: 3.85, parLevel: 16, supplier: 'Maple Foodservice' },
      { id: 'demo-tequila', name: 'Blanco Tequila 750ml', category: 'Liquor', storageArea: 'Bar', currentStock: 8, unit: 'bottle', unitCost: 38.5, parLevel: 12, supplier: 'Ontario Beverage Retail' },
      { id: 'demo-triple-sec', name: 'Orange Liqueur 750ml', category: 'Liquor', storageArea: 'Bar', currentStock: 5, unit: 'bottle', unitCost: 27.8, parLevel: 8, supplier: 'Ontario Beverage Retail' },
      { id: 'demo-cabernet', name: 'House Cabernet', category: 'Wine', storageArea: 'Wine Cellar', currentStock: 15, unit: 'bottle', unitCost: 16.25, parLevel: 24, supplier: 'Cellar Door Imports' },
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
      { id: 'demo-avocado-tartine', menuItemName: 'Garden Avocado Tartine', category: 'Brunch', price: 18, ingredients: [{ inventoryItemId: 'demo-sourdough', quantity: 0.2, unit: 'loaf' }, { inventoryItemId: 'demo-avocado', quantity: 1, unit: 'each' }, { inventoryItemId: 'demo-eggs', quantity: 1, unit: 'each' }, { inventoryItemId: 'demo-olive-oil', quantity: 0.01, unit: 'L' }] },
      { id: 'demo-breakfast-plate', menuItemName: 'Sunrise Breakfast Plate', category: 'Brunch', price: 21, ingredients: [{ inventoryItemId: 'demo-eggs', quantity: 2, unit: 'each' }, { inventoryItemId: 'demo-bacon', quantity: 0.25, unit: 'lb' }, { inventoryItemId: 'demo-potatoes', quantity: 0.45, unit: 'lb' }, { inventoryItemId: 'demo-butter', quantity: 0.04, unit: 'lb' }] },
      { id: 'demo-crispy-chicken', menuItemName: 'Crispy Chicken Club', category: 'Sandwich', price: 22, ingredients: [{ inventoryItemId: 'demo-chicken-breast', quantity: 0.45, unit: 'lb' }, { inventoryItemId: 'demo-flour', quantity: 0.06, unit: 'kg' }, { inventoryItemId: 'demo-brioche', quantity: 1, unit: 'each' }, { inventoryItemId: 'demo-arugula', quantity: 0.06, unit: 'lb' }] },
      { id: 'demo-espresso-martini', menuItemName: 'Midnight Espresso Martini', category: 'Cocktail', price: 18, ingredients: [{ inventoryItemId: 'demo-vodka', quantity: 0.08, unit: 'bottle' }, { inventoryItemId: 'demo-espresso', quantity: 0.02, unit: 'kg' }] },
      { id: 'demo-gin-tonic', menuItemName: 'Botanical Gin & Tonic', category: 'Cocktail', price: 15, ingredients: [{ inventoryItemId: 'demo-gin', quantity: 0.08, unit: 'bottle' }, { inventoryItemId: 'demo-tonic', quantity: 1, unit: 'bottle' }, { inventoryItemId: 'demo-lime', quantity: 0.25, unit: 'each' }] },
      { id: 'demo-margarita', menuItemName: 'Golden Hour Margarita', category: 'Cocktail', price: 17, ingredients: [{ inventoryItemId: 'demo-tequila', quantity: 0.08, unit: 'bottle' }, { inventoryItemId: 'demo-triple-sec', quantity: 0.03, unit: 'bottle' }, { inventoryItemId: 'demo-lime', quantity: 1, unit: 'each' }] },
      { id: 'demo-mimosa', menuItemName: 'Citrus Mimosa', category: 'Cocktail', price: 13, ingredients: [{ inventoryItemId: 'demo-prosecco', quantity: 0.17, unit: 'bottle' }, { inventoryItemId: 'demo-orange-juice', quantity: 0.12, unit: 'L' }] },
      { id: 'demo-cabernet-glass', menuItemName: 'Cabernet · 5oz', category: 'Wine', price: 15, ingredients: [{ inventoryItemId: 'demo-cabernet', quantity: 0.2, unit: 'bottle' }] },
    ];
  const now = new Date().toISOString();
  return {
    inventory,
    recipes,
    storageAreas: ['Walk-In Cooler', 'Dry Storage', 'Freezer', 'Bar', 'Wine Cellar'],
    suppliers: [
      { id: 'demo-supplier-foodservice', name: 'Maple Foodservice', contactPerson: 'Account Representative', email: 'orders@example.test', phone: '416-555-0101', address: 'Toronto, ON', category: 'Broadline', paymentTerms: 'Net 30', notes: 'Tuesday and Friday delivery', dateAdded: now, source: 'manual' },
      { id: 'demo-supplier-seafood', name: 'Great Lakes Seafood', contactPerson: 'Order Desk', email: 'seafood@example.test', phone: '416-555-0118', address: 'Toronto, ON', category: 'Seafood', paymentTerms: 'Net 14', notes: 'Order before 2pm', dateAdded: now, source: 'manual' },
      { id: 'demo-supplier-produce', name: 'Northern Produce Co.', contactPerson: 'Order Desk', email: 'produce@example.test', phone: '416-555-0134', address: 'Toronto, ON', category: 'Produce', paymentTerms: 'Net 21', notes: 'Daily delivery', dateAdded: now, source: 'manual' },
      { id: 'demo-supplier-specialty', name: 'Harbour Specialty Foods', contactPerson: 'Account Representative', email: 'specialty@example.test', phone: '416-555-0172', address: 'Vaughan, ON', category: 'Specialty', paymentTerms: 'Net 30', notes: '', dateAdded: now, source: 'manual' },
      { id: 'demo-supplier-meat', name: 'Lakeside Meats', contactPerson: 'Order Desk', email: 'meat@example.test', phone: '416-555-0141', address: 'Oakville, ON', category: 'Meat', paymentTerms: 'Net 14', notes: 'Thursday delivery', dateAdded: now, source: 'manual' },
      { id: 'demo-supplier-wine', name: 'Cellar Door Imports', contactPerson: 'Licensee Desk', email: 'wine@example.test', phone: '416-555-0156', address: 'Toronto, ON', category: 'Wine', paymentTerms: 'Net 30', notes: 'Licensee pricing', dateAdded: now, source: 'manual' },
      { id: 'demo-supplier-spirits', name: 'Ontario Beverage Retail', contactPerson: 'Licensee Desk', email: 'licensee@example.test', phone: '416-555-0164', address: 'Toronto, ON', category: 'Liquor', paymentTerms: 'Due on order', notes: '', dateAdded: now, source: 'manual' },
      { id: 'demo-supplier-beer', name: 'Ontario Beer Supply', contactPerson: 'Licensee Desk', email: 'beer@example.test', phone: '416-555-0168', address: 'Toronto, ON', category: 'Beer', paymentTerms: 'Due on order', notes: '', dateAdded: now, source: 'manual' },
      { id: 'demo-supplier-coffee', name: 'Northline Coffee Roasters', contactPerson: 'Account Representative', email: 'coffee@example.test', phone: '416-555-0180', address: 'Toronto, ON', category: 'Coffee', paymentTerms: 'Net 14', notes: 'Weekly standing order', dateAdded: now, source: 'manual' },
    ],
    orders: [
      { id: 'demo-order-1', date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), items: [{ itemId: 'demo-salmon', quantity: 12, cost: 177.6 }, { itemId: 'demo-parmigiano', quantity: 6, cost: 189 }], totalCost: 366.6, status: 'pending' },
      { id: 'demo-order-2', date: new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10), items: [{ itemId: 'demo-potatoes', quantity: 30, cost: 40.5 }], totalCost: 40.5, status: 'received' },
    ],
    invoices: [
      { id: 'demo-invoice-1', date: new Date(Date.now() - 86400000).toISOString().slice(0, 10), invoiceNumber: 'GLS-10482', supplier: 'Great Lakes Seafood', items: [{ itemId: 'demo-salmon', quantity: 20, cost: 296 }], totalAmount: 296, status: 'received' },
      { id: 'demo-invoice-2', date: new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 10), invoiceNumber: 'NPC-88217', supplier: 'Northern Produce Co.', items: [{ itemId: 'demo-arugula', quantity: 8, cost: 57.6 }, { itemId: 'demo-potatoes', quantity: 40, cost: 54 }], totalAmount: 111.6, status: 'received' },
    ],
  };
}
