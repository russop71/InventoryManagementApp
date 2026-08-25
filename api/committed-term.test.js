import test from 'node:test';
import assert from 'node:assert/strict';
import { canRequestNonRenewal, commitmentDates } from './v1/[...path].js';

test('committed term ends one year after activation and requires 90 days notice', () => {
  const term = commitmentDates('2026-01-01T00:00:00.000Z');
  assert.equal(term.endsAt, '2027-01-01T00:00:00.000Z');
  assert.equal(term.noticeDeadline, '2026-10-03T00:00:00.000Z');
  assert.equal(canRequestNonRenewal(term.endsAt, new Date('2026-10-03T00:00:00.000Z')), true);
  assert.equal(canRequestNonRenewal(term.endsAt, new Date('2026-10-04T00:00:00.000Z')), false);
});
