import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWeeklyManagerDigest, managerRecipients, summarizeLocationAttention, weekKey } from './_weekly-manager-digest.js';

test('managerRecipients includes active operational managers once', () => {
  assert.deepEqual(managerRecipients([
    { email: 'Owner@Example.ca', role: 'Owner', status: 'Active' },
    { email: 'owner@example.ca', role: 'Manager', status: 'Active' },
    { email: 'staff@example.ca', role: 'Staff', status: 'Active' },
    { email: 'old@example.ca', role: 'Manager', status: 'Inactive' },
  ]), ['owner@example.ca']);
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
