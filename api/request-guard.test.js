import test from 'node:test';
import assert from 'node:assert/strict';
import { checkRateLimit, resetRateLimitsForTests } from './_request-guard.js';

test('rate limits isolate identities and reset after the time window', () => {
  resetRateLimitsForTests();
  assert.equal(checkRateLimit('login:one', { limit: 2, windowMs: 1000 }, 100).allowed, true);
  assert.equal(checkRateLimit('login:one', { limit: 2, windowMs: 1000 }, 101).allowed, true);
  assert.equal(checkRateLimit('login:one', { limit: 2, windowMs: 1000 }, 102).allowed, false);
  assert.equal(checkRateLimit('login:two', { limit: 2, windowMs: 1000 }, 102).allowed, true);
  assert.equal(checkRateLimit('login:one', { limit: 2, windowMs: 1000 }, 1100).allowed, true);
});
