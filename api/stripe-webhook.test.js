import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'crypto';

import { verifyStripeSignature } from './stripe-webhook.js';

test('verifyStripeSignature accepts a fresh valid Stripe signature', () => {
  const secret = 'whsec_test';
  const timestamp = 1_800_000_000;
  const payload = Buffer.from('{"type":"checkout.session.completed"}');
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.${payload.toString('utf8')}`)
    .digest('hex');

  assert.equal(
    verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, secret, timestamp * 1000),
    true,
  );
});

test('verifyStripeSignature rejects stale or modified payloads', () => {
  const payload = Buffer.from('{}');
  assert.equal(verifyStripeSignature(payload, 't=1,v1=bad', 'whsec_test', 1_800_000_000_000), false);
});
