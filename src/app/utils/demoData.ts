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
}

export function buildDemoLocationData(): DemoLocationData {
  return {
    inventory: [
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
    ],
    recipes: [
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
    ],
    storageAreas: ['Walk-In Cooler', 'Dry Storage', 'Freezer', 'Bar'],
  };
}
