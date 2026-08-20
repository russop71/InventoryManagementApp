import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePosImportPayload } from './pos-import.js';

test('normalizes a Marketman-style sales export into Toast data', () => {
  const payload = {
    salesData: [
      {
        date: '2025-07-20',
        covers: 88,
        revenue: 3120,
        topItems: [{ itemName: 'Margherita Pizza', quantity: 24, revenue: 560 }],
      },
      {
        date: '2025-07-21',
        covers: 93,
        revenue: 3460,
        topItems: [{ itemName: 'Spaghetti Pomodoro', quantity: 15, revenue: 420 }],
      },
    ],
    menuItems: [
      { name: 'Margherita Pizza', category: 'Pizza', price: 24, ingredients: [] },
      { name: 'Spaghetti Pomodoro', category: 'Pasta', price: 22, ingredients: [] },
    ],
  };

  const result = normalizePosImportPayload(payload);

  assert.equal(result.salesData.length, 2);
  assert.equal(result.salesData[0].revenue, 3120);
  assert.equal(result.menuItems[0].name, 'Margherita Pizza');
  assert.equal(result.menuItems[1].category, 'Pasta');
});

test('derives menu items from top-selling item names when no menuItems array exists', () => {
  const payload = {
    history: [
      {
        date: '2025-07-22',
        revenue: 2800,
        covers: 75,
        topItems: [{ itemName: 'Cavolo Nero', quantity: 12, revenue: 300 }],
      },
    ],
  };

  const result = normalizePosImportPayload(payload);

  assert.equal(result.salesData.length, 1);
  assert.equal(result.menuItems[0].name, 'Cavolo Nero');
  assert.equal(result.menuItems[0].category, 'Unknown');
});

test('keeps only Marketman rows with positive quantity sold', () => {
  const payload = {
    marketmanReport: [
      {
        'Menu item name': 'Chicken Sandwich',
        'Qty sold': 3,
        'Total sales': 45,
      },
      {
        'Menu item name': 'Burger',
        'Qty sold': 0,
        'Total sales': 0,
      },
    ],
  };

  const result = normalizePosImportPayload(payload);

  assert.equal(result.salesData[0].topItems.length, 1);
  assert.equal(result.salesData[0].topItems[0].itemName, 'Chicken Sandwich');
  assert.equal(result.salesData[0].topItems[0].quantity, 3);
  assert.equal(result.menuItems[0].name, 'Chicken Sandwich');
});

test('parses HTML table rows from a Marketman-style report', () => {
  const payload = {
    html: `
      <table>
        <tr><th>Menu item name</th><th>Qty sold</th><th>Total sales</th><th>Category</th></tr>
        <tr><td>Caesar Salad</td><td>2</td><td>24</td><td>Salads</td></tr>
        <tr><td>Soup</td><td>0</td><td>0</td><td>Starters</td></tr>
      </table>
    `,
  };

  const result = normalizePosImportPayload(payload);

  assert.equal(result.salesData[0].topItems.length, 1);
  assert.equal(result.salesData[0].topItems[0].itemName, 'Caesar Salad');
  assert.equal(result.salesData[0].topItems[0].quantity, 2);
});

test('normalizes common Canadian POS CSV headings, currency and business dates', () => {
  const result = normalizePosImportPayload({
    provider: 'touchbistro',
    rows: [
      { 'Business Date': '2026-08-18', 'Item Name': 'House Lager', 'Quantity Sold': '12', 'Net Sales': '$108.00', Category: 'Beer', 'Menu Price': '$9.00', Covers: '8' },
      { 'Business Date': '2026-08-18', 'Item Name': 'House Lager', 'Quantity Sold': '3', 'Net Sales': '$27.00', Category: 'Beer', 'Menu Price': '$9.00', Covers: '0' },
      { 'Business Date': '2026-08-19', Product: 'Cedar Salmon', 'Units Sold': '5', Sales: '$170.00', Department: 'Mains', Price: '$34.00', Guests: '5' },
    ],
  });

  assert.equal(result.salesData.length, 2);
  assert.equal(result.salesData[0].revenue, 135);
  assert.equal(result.salesData[0].topItems[0].quantity, 15);
  assert.equal(result.salesData[1].covers, 5);
  assert.equal(result.menuItems[0].category, 'Beer');
  assert.equal(result.menuItems[1].price, 34);
});
