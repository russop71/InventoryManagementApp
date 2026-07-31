import test from 'node:test';
import assert from 'node:assert/strict';
import { buildForecastFromHistory } from './forecasting.js';

test('boosts weekend brunch-style menu items and maps to ingredient usage', () => {
  const history = [
    { date: '2026-07-20', revenue: 3000, covers: 90, topItems: [{ itemName: 'Brunch Burger', quantity: 10, revenue: 250 }, { itemName: 'Margherita Pizza', quantity: 6, revenue: 150 }] },
    { date: '2026-07-21', revenue: 3200, covers: 92, topItems: [{ itemName: 'Brunch Burger', quantity: 11, revenue: 275 }, { itemName: 'Margherita Pizza', quantity: 7, revenue: 170 }] },
    { date: '2026-07-22', revenue: 3400, covers: 95, topItems: [{ itemName: 'Brunch Burger', quantity: 12, revenue: 300 }, { itemName: 'Margherita Pizza', quantity: 8, revenue: 190 }] },
    { date: '2026-07-23', revenue: 2800, covers: 78, topItems: [{ itemName: 'Brunch Burger', quantity: 9, revenue: 225 }, { itemName: 'Margherita Pizza', quantity: 5, revenue: 120 }] },
  ];

  const menuItems = [
    { name: 'Brunch Burger', price: 24, ingredients: [{ inventoryItemId: 'beef', quantity: 0.4 }] },
    { name: 'Margherita Pizza', price: 22, ingredients: [{ inventoryItemId: 'cheese', quantity: 0.3 }] },
  ];

  const result = buildForecastFromHistory({
    history,
    menuItems,
    inventory: [],
    payload: { expectedRevenue: 3600, date: '2026-07-25' },
  });

  const brunch = result.predictedMenuItems.find(item => item.name === 'Brunch Burger');
  const pizza = result.predictedMenuItems.find(item => item.name === 'Margherita Pizza');
  assert.ok(brunch && pizza);
  assert.ok(brunch.quantity >= pizza.quantity);
  assert.ok(result.ingredientUsage.some(item => item.itemId === 'beef'));
});

test('boosts comfort items when weather is cold and rainy', () => {
  const history = [
    { date: '2026-07-20', revenue: 2200, covers: 80, topItems: [{ itemName: 'Salad', quantity: 8, revenue: 180 }] },
    { date: '2026-07-21', revenue: 2300, covers: 82, topItems: [{ itemName: 'Salad', quantity: 9, revenue: 190 }] },
  ];

  const menuItems = [
    { name: 'Salad', price: 16, ingredients: [{ inventoryItemId: 'greens', quantity: 0.5 }] },
    { name: 'Soup', price: 14, ingredients: [{ inventoryItemId: 'broth', quantity: 0.4 }] },
  ];

  const result = buildForecastFromHistory({
    history,
    menuItems,
    inventory: [],
    payload: {
      expectedRevenue: 2400,
      date: '2026-07-25',
      weather: { tempC: 8, precipitationChance: 0.85, summary: 'Cold rain' },
    },
  });

  const soup = result.predictedMenuItems.find(item => item.name === 'Soup');
  const salad = result.predictedMenuItems.find(item => item.name === 'Salad');
  assert.ok(soup && salad);
  assert.ok(soup.quantity > salad.quantity);
});

test('boosts demand when a local event calendar includes a major event', () => {
  const result = buildForecastFromHistory({
    history: [],
    menuItems: [{ name: 'Chef Special', price: 20, ingredients: [{ inventoryItemId: 'special', quantity: 0.4 }] }],
    inventory: [],
    payload: {
      expectedRevenue: 3000,
      date: '2026-07-25',
      events: { localEvents: ['Toronto Food Festival', 'Street Fair'] },
    },
  });

  const special = result.predictedMenuItems.find(item => item.name === 'Chef Special');
  assert.ok(special);
  assert.ok(special.quantity >= 2);
});
