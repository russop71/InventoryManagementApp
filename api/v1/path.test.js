import test from 'node:test';
import assert from 'node:assert/strict';

import { identifierFilter } from './[...path].js';

test('identifierFilter uses UUID columns for canonical database IDs', () => {
  const accountId = 'b74c80db-0c0b-4fc0-8a89-b5d2cbd808f5';

  assert.equal(identifierFilter('id', 'slug', accountId), `id=eq.${accountId}`);
});

test('identifierFilter uses slug columns for fallback session identifiers', () => {
  assert.equal(identifierFilter('id', 'slug', 'russop71'), 'slug=eq.russop71');
  assert.equal(identifierFilter('id', 'slug', 'Main Location'), 'slug=eq.Main%20Location');
});
