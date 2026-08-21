import test from 'node:test';
import assert from 'node:assert/strict';
import { clearDemoSessionReset, markDemoSessionReset, shouldResetDemoSession } from './demoSession.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
}

test('a fresh demo login requires one clean dataset reset', () => {
  const storage = memoryStorage();
  assert.equal(shouldResetDemoSession('v1', storage), true);
  markDemoSessionReset('v1', storage);
  assert.equal(shouldResetDemoSession('v1', storage), false);
  clearDemoSessionReset(storage);
  assert.equal(shouldResetDemoSession('v1', storage), true);
});

test('a new demo dataset version triggers another reset', () => {
  const storage = memoryStorage();
  markDemoSessionReset('v1', storage);
  assert.equal(shouldResetDemoSession('v2', storage), true);
});
