import test from 'node:test';
import assert from 'node:assert/strict';
import { hasVerifiedAuthenticator, requireEnrolledMfa } from './_mfa-policy.js';
const token = aal => `header.${Buffer.from(JSON.stringify({ aal })).toString('base64url')}.signature`;
const enabled = { factors: [{ factor_type: 'totp', status: 'verified' }] };
test('MFA enrollment is optional; unfinished setup does not lock out users', () => {
  for (const user of [{}, { factors: [] }, { factors: [{ factor_type: 'totp', status: 'unverified' }] }]) {
    assert.equal(hasVerifiedAuthenticator(user), false);
    assert.doesNotThrow(() => requireEnrolledMfa(user, token('aal1')));
  }
});
test('verified enrollment requires MFA regardless of role or rollout setting', () => {
  assert.equal(hasVerifiedAuthenticator(enabled), true);
  for (const role of ['Owner', 'Admin', 'Staff']) {
    assert.throws(() => requireEnrolledMfa({ ...enabled, role }, token('aal1')), { code: 'MFA_REQUIRED' });
    assert.doesNotThrow(() => requireEnrolledMfa({ ...enabled, role }, token('aal2')));
  }
  assert.throws(() => requireEnrolledMfa(enabled, 'invalid'), { code: 'MFA_REQUIRED' });
});
