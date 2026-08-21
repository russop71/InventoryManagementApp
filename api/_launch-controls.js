const ACTIVE_BILLING_STATUSES = new Set(['active']);
const MANAGEMENT_ROLES = new Set(['Owner', 'Admin', 'Manager']);
const ACCOUNT_ADMIN_ROLES = new Set(['Owner', 'Admin']);

export function configuredValues(value = '') {
  return new Set(String(value).split(',').map(item => item.trim().toLowerCase()).filter(Boolean));
}

export function isPlatformAdminEmail(email, configuredEmails = process.env.ZESTIQ_PLATFORM_ADMIN_EMAILS) {
  return configuredValues(configuredEmails).has(String(email || '').trim().toLowerCase());
}

export function isDemoAccount(account) {
  return String(account?.slug || '').trim().toLowerCase() === 'demo-zestiq-com';
}

export function hasActiveSubscription(account) {
  return ACTIVE_BILLING_STATUSES.has(String(account?.billing_status || '').trim().toLowerCase());
}

export function hasProductAccess({ account, authUser, platformAdminEmails, billingBypassAccountIds } = {}) {
  if (!account) return false;
  if (isDemoAccount(account)) return true;
  if (isPlatformAdminEmail(authUser?.email, platformAdminEmails)) return true;
  const bypassIds = configuredValues(billingBypassAccountIds ?? process.env.ZESTIQ_BILLING_BYPASS_ACCOUNT_IDS);
  if (bypassIds.has(String(account.id || '').trim().toLowerCase())) return true;
  return hasActiveSubscription(account);
}

export function canManageOperations(role) {
  return MANAGEMENT_ROLES.has(String(role || ''));
}

export function canAdministerAccount(role) {
  return ACCOUNT_ADMIN_ROLES.has(String(role || ''));
}

export function assertRole(role, allowedRoles, message) {
  if (!allowedRoles.includes(role)) {
    throw Object.assign(new Error(message || 'You do not have permission to perform this action'), { status: 403 });
  }
}

export function validateFinalizedCounts(previousCounts = [], nextCounts = []) {
  const previousById = new Map((Array.isArray(previousCounts) ? previousCounts : []).map(count => [String(count?.id || ''), count]));
  const nextById = new Map((Array.isArray(nextCounts) ? nextCounts : []).map(count => [String(count?.id || ''), count]));
  for (const [id, previous] of previousById) {
    if (previous?.status !== 'finalized') continue;
    const next = nextById.get(id);
    if (!next || JSON.stringify(previous) !== JSON.stringify(next)) {
      return { valid: false, error: 'Finalized inventory counts are locked and cannot be edited or deleted' };
    }
  }
  for (const count of nextById.values()) {
    if (count?.status !== 'finalized') continue;
    const entries = Array.isArray(count?.entries) ? count.entries : [];
    if (!entries.length || entries.some(entry => entry?.isCounted !== true || !Number.isFinite(Number(entry?.counted)))) {
      return { valid: false, error: 'Every inventory line must be counted before a count can be finalized' };
    }
  }
  return { valid: true };
}
