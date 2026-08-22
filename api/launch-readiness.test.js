import test from 'node:test';
import assert from 'node:assert/strict';
import { launchReadiness } from './_launch-readiness.js';

test('launch readiness fails closed when billing, AI, or admin configuration is missing', () => {
  assert.equal(launchReadiness({}).ready, false);
  const ready = launchReadiness({
    APP_URL: 'https://zestiq.ca',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SECRET_KEY: 'configured',
    STRIPE_SECRET_KEY: 'configured',
    STRIPE_PRICE_MONTHLY: 'price_monthly',
    STRIPE_PRICE_ADDITIONAL_LOCATION: 'price_location',
    STRIPE_WEBHOOK_SECRET: 'configured',
    OPENAI_API_KEY: 'configured',
    ZESTIQ_PLATFORM_ADMIN_EMAILS: 'admin@zestiq.ca',
    DEMO_ACCOUNT_PASSWORD: 'configured',
  });
  assert.equal(ready.ready, true);
});
