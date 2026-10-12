export const ASSISTANT_ROUTES = new Set(['/app', '/app/onboarding', '/app/inventory', '/app/suppliers', '/app/recipes', '/app/beverages', '/app/invoices', '/app/orders', '/app/forecasting', '/app/costs', '/app/usage-variance', '/app/waste', '/app/integrations', '/app/labor', '/app/users', '/app/account', '/app/payment-method', '/app/notifications', '/app/help', '/app/contact']);

export function assistantScopeKey(accountId, userId, locationId) {
  return JSON.stringify([accountId || '', userId || '', locationId || '']);
}

export function assistantTextParts(content) {
  return String(content).split(/(\/app(?:\/[a-z-]+)?)(?=[\s.,;:!?)]|$)/g).filter(Boolean)
    .map(value => ({ text: value, route: ASSISTANT_ROUTES.has(value) ? value : null }));
}
