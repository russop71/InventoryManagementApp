import test from 'node:test';
import assert from 'node:assert/strict';
import { canAdministerAccount, canManageOperations, hasProductAccess, isDemoAdministrativeMutation, isShowcaseAccount, validateFinalizedCounts } from './_launch-controls.js';

test('new clients are gated until the CAD Premium subscription is active', () => {
  const account = { id: 'company-a', slug: 'company-a', billing_status: 'not_configured' };
  assert.equal(hasProductAccess({ account, authUser: { email: 'owner@company-a.ca' }, platformAdminEmails: '', billingBypassAccountIds: '' }), false);
  assert.equal(hasProductAccess({ account: { ...account, billing_status: 'active' }, authUser: { email: 'owner@company-a.ca' }, platformAdminEmails: '', billingBypassAccountIds: '' }), true);
  assert.equal(hasProductAccess({ account, authUser: { email: 'admin@zestiq.ca' }, platformAdminEmails: 'admin@zestiq.ca', billingBypassAccountIds: '' }), true);
});

test('ZestIQ Showcase has product access without a paid subscription', () => {
  const showcase = { slug: 'demo-zestiq-ca', name: 'ZestIQ Showcase', billing_status: 'not_configured' };
  assert.equal(isShowcaseAccount(showcase), true);
  assert.equal(hasProductAccess({ account: showcase, authUser: { email: 'demo@zestiq.ca' }, platformAdminEmails: '', billingBypassAccountIds: '' }), true);
  assert.equal(isDemoAdministrativeMutation(showcase, ['accounts', 'id', 'locations'], 'POST'), false);
});

test('manager permissions do not give staff access to company operations', () => {
  assert.equal(canManageOperations('Manager'), true);
  assert.equal(canManageOperations('BOH Manager'), true);
  assert.equal(canManageOperations('FOH Manager'), true);
  assert.equal(canManageOperations('Ordering'), false);
  assert.equal(canManageOperations('Staff'), false);
  assert.equal(canAdministerAccount('Admin'), true);
  assert.equal(canAdministerAccount('Manager'), false);
});

test('finalized counts cannot be edited, deleted, or finalized with missing lines', () => {
  const finalized = { id: 'count-1', status: 'finalized', entries: [{ itemId: 'a', counted: 2, isCounted: true }] };
  assert.equal(validateFinalizedCounts([finalized], [finalized]).valid, true);
  assert.equal(validateFinalizedCounts([finalized], []).valid, false);
  assert.equal(validateFinalizedCounts([finalized], [{ ...finalized, value: 999 }]).valid, false);
  assert.equal(validateFinalizedCounts([], [{ id: 'count-2', status: 'finalized', entries: [{ itemId: 'a', counted: 0, isCounted: false }] }]).valid, false);
});

test('public demo blocks administrative mutations but keeps operational data available', () => {
  const demo = { slug: 'demo-zestiq-com' };
  assert.equal(isDemoAdministrativeMutation(demo, ['accounts', 'id', 'users'], 'POST'), true);
  assert.equal(isDemoAdministrativeMutation(demo, ['accounts', 'id', 'billing', 'portal'], 'POST'), true);
  assert.equal(isDemoAdministrativeMutation(demo, ['accounts', 'id', 'locations'], 'POST'), true);
  assert.equal(isDemoAdministrativeMutation(demo, ['accounts', 'id', 'locations', 'loc', 'integrations', 'toast'], 'PUT'), true);
  assert.equal(isDemoAdministrativeMutation(demo, ['accounts', 'id', 'users'], 'GET'), false);
  assert.equal(isDemoAdministrativeMutation(demo, ['accounts', 'id', 'locations', 'loc', 'data'], 'PUT'), true);
  assert.equal(isDemoAdministrativeMutation({ slug: 'customer' }, ['accounts', 'id', 'users'], 'POST'), false);
});
