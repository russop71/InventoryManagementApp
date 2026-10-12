import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWeeklyManagerDigest, hasAttention, managerRecipients, summarizeLocationAttention, weekKey } from './_weekly-manager-digest.js';

test('managerRecipients includes active operational managers once', () => {
  assert.deepEqual(managerRecipients([
    { email: 'Owner@Example.ca', role: 'Owner', status: 'Active' },
    { email: 'owner@example.ca', role: 'Manager', status: 'Active' },
    { email: 'staff@example.ca', role: 'Staff', status: 'Active' },
    { email: 'old@example.ca', role: 'Manager', status: 'Inactive' },
  ]), ['owner@example.ca']);
});

test('weekly activity excludes old and future records and uses recorded invoice dates', () => {
  const summary = summarizeLocationAttention({
    inventory: [{ id: 'fish', name: 'Fish', priceHistory: [
      { date: '2026-10-06T12:00:00Z', oldPrice: 10, newPrice: 12 },
      { date: '2026-09-01T12:00:00Z', oldPrice: 8, newPrice: 10 },
      { date: '2026-11-01T12:00:00Z', oldPrice: 12, newPrice: 13 },
      { date: '2026-10-07', oldPrice: null, newPrice: 15 },
    ] }],
    invoices: [{ id: 'recent', date: '2026-10-11', status: 'received' }, { id: 'old', date: '2026-08-01' }, { id: 'future', date: '2026-11-01' }],
  }, new Date('2026-10-05T13:00:00Z'), { until: new Date('2026-10-12T13:00:00Z') });
  assert.equal(summary.priceChanges.length, 1);
  assert.deepEqual(summary.recentInvoices.map(invoice => invoice.id), ['recent']);
});

test('food-cost exceptions use the account target and the same package conversion as recipes', () => {
  const summary = summarizeLocationAttention({
    inventory: [{ id: 'oil', name: 'Oil', unit: 'case', packSize: 1, packUnit: 'l', unitsPerPack: 6, unitCost: 60 }],
    recipes: [
      { menuItemName: 'Costed dish', price: 10, ingredients: [{ inventoryItemId: 'oil', quantity: 500, unit: 'ml' }] },
      { menuItemName: 'Incomplete dish', price: 10, ingredients: [{ inventoryItemId: 'missing', quantity: 1, unit: 'kg' }] },
      { menuItemName: 'No ingredients', price: 10, ingredients: [] },
    ],
  }, new Date('2026-10-05'), { foodCostTarget: '30' });
  assert.equal(summary.foodCostExceptions.length, 1);
  assert.equal(summary.foodCostExceptions[0].cost, 5);
  assert.equal(summary.foodCostExceptions[0].foodCostPercent, 50);
  assert.equal(summary.foodCostExceptions[0].target, 30);
  assert.equal(summary.incompleteRecipeCount, 2);
});

test('missing food-cost targets are not replaced with an invented maximum', () => {
  const summary = summarizeLocationAttention({ recipes: [{ menuItemName: 'Dish', price: 10, ingredients: [] }] }, new Date('2026-10-05'));
  assert.equal(summary.foodCostTarget, null);
  assert.equal(summary.foodCostExceptions.length, 0);
});

test('invoice-only weekly activity qualifies for a summary', () => {
  const summary = summarizeLocationAttention({ invoices: [{ date: '2026-10-11', status: 'received' }] }, new Date('2026-10-05'), { until: new Date('2026-10-12') });
  assert.equal(hasAttention(summary), true);
  assert.equal(summary.openInvoices.length, 0);
});

test('table email is branded, bounded, escaped and does not invent savings or scan provenance', () => {
  const summary = summarizeLocationAttention({ name: '<script>Restaurant</script>', inventory: [{ name: 'Salmon', priceHistory: [{ date: '2026-10-07T12:00:00Z', oldPrice: 10, newPrice: 12 }] }], invoices: Array.from({ length: 8 }, (_, i) => ({ date: '2026-10-11', invoiceNumber: `INV-${i}`, supplier: 'Supplier <One>', status: 'open' })) }, new Date('2026-10-05'), { until: new Date('2026-10-12') });
  const message = buildWeeklyManagerDigest({ recipientName: 'Chef <Pat>', accountName: 'Company & Co', periodStart: new Date('2026-10-05T13:00:00Z'), periodEnd: new Date('2026-10-12T13:00:00Z'), locations: [summary] });
  assert.match(message.html, /Previous price/);
  assert.match(message.html, /Invoices recorded this week: 8/);
  assert.match(message.html, /\(3 more\)/);
  assert.match(message.html, /Oct 11/);
  assert.match(message.html, /#F58220/);
  assert.doesNotMatch(message.html, /#f5d62e|<script>|Potential Savings|Scanned invoices|Monthly COGS/i);
  assert.match(message.html, /&lt;script&gt;Restaurant/);
  assert.match(message.html, /href="https:\/\/zestiq.ca\/app\/account"/);
});

test('summarizeLocationAttention captures recent price and operational attention', () => {
  const summary = summarizeLocationAttention({
    name: 'King Street',
    inventory: [{ name: 'Salmon', currentStock: 2, parLevel: 8, unitCost: 12, lastCountedAt: '2026-08-20T00:00:00Z', priceHistory: [{ date: '2026-09-08T10:00:00Z', oldPrice: 10, newPrice: 12 }] }],
    invoices: [{ status: 'open' }], orders: [{ status: 'pending' }],
  }, new Date('2026-09-02T00:00:00Z'));
  assert.equal(summary.priceChanges.length, 1);
  assert.equal(summary.priceChanges[0].percent, 20);
  assert.equal(summary.lowStock.length, 1);
  assert.equal(summary.overdueCounts.length, 1);
  assert.equal(summary.openInvoices.length, 1);
  assert.equal(summary.pendingOrders.length, 1);
});

test('buildWeeklyManagerDigest renders price movement and attention link', () => {
  const message = buildWeeklyManagerDigest({ recipientName: 'Pat Russo', accountName: 'Zestaurant', periodStart: new Date('2026-09-02T00:00:00Z'), periodEnd: new Date('2026-09-09T00:00:00Z'), locations: [{ name: 'King Street', priceChanges: [{ itemName: 'Salmon', supplier: 'Ocean Foods', oldPrice: 10, newPrice: 12, percent: 20 }], lowStock: [{}], overdueCounts: [], openInvoices: [], pendingOrders: [] }] });
  assert.match(message.subject, /1 price change/);
  assert.match(message.text, /Salmon: \$10\.00 → \$12\.00 \(\+20\.0%\)/);
  assert.match(message.html, /Open ZestIQ attention centre/);
  assert.equal(weekKey(new Date('2026-09-09T00:00:00Z')), '2026-W37');
});
