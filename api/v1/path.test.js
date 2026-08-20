import test from 'node:test';
import assert from 'node:assert/strict';

import { accountSlugFromEmail, findDuplicateInvoiceNumber, identifierFilter, isPlatformAdmin, summarizeUsage } from './[...path].js';

test('identifierFilter uses UUID columns for canonical database IDs', () => {
  const accountId = 'b74c80db-0c0b-4fc0-8a89-b5d2cbd808f5';

  assert.equal(identifierFilter('id', 'slug', accountId), `id=eq.${accountId}`);
});

test('identifierFilter uses slug columns for fallback session identifiers', () => {
  assert.equal(identifierFilter('id', 'slug', 'russop71'), 'slug=eq.russop71');
  assert.equal(identifierFilter('id', 'slug', 'Main Location'), 'slug=eq.Main%20Location');
});

test('company account slugs keep businesses with similar usernames separate', () => {
  assert.equal(accountSlugFromEmail('owner@company-a.ca'), 'owner-company-a-ca');
  assert.equal(accountSlugFromEmail('owner@company-b.ca'), 'owner-company-b-ca');
  assert.notEqual(accountSlugFromEmail('owner@company-a.ca'), accountSlugFromEmail('owner@company-b.ca'));
  assert.notEqual(accountSlugFromEmail('demo@zestiq.com'), accountSlugFromEmail('russop71@gmail.com'));
});

test('platform administration is independent from a company owner role', () => {
  assert.equal(isPlatformAdmin({ email: 'russop71@gmail.com' }), true);
  assert.equal(isPlatformAdmin({ email: 'owner@another-company.ca' }), false);
});

test('findDuplicateInvoiceNumber rejects formatting variants of the same invoice number', () => {
  const duplicate = findDuplicateInvoiceNumber([
    { invoiceNumber: 'INV-100 42' },
    { invoiceNumber: 'inv10042' },
  ]);

  assert.equal(duplicate, 'inv10042');
  assert.equal(findDuplicateInvoiceNumber([{ invoiceNumber: 'INV-1' }, { invoiceNumber: 'INV-2' }]), null);
});

test('summarizeUsage reports activity and the most-used app area per user', () => {
  const usage = summarizeUsage(
    [{ id: 'owner' }, { id: 'staff' }],
    [
      { user_id: 'owner', path: '/app/inventory', created_at: '2026-08-19T15:00:00.000Z' },
      { user_id: 'owner', path: '/app/inventory/123', created_at: '2026-08-19T15:01:00.000Z' },
      { user_id: 'owner', path: '/app/recipes', created_at: '2026-08-19T15:02:00.000Z' },
    ],
  );

  assert.deepEqual(usage.owner, {
    eventCount: 3,
    lastActive: '2026-08-19T15:02:00.000Z',
    topArea: 'inventory',
  });
  assert.deepEqual(usage.staff, { eventCount: 0, lastActive: null, topArea: null });
});
