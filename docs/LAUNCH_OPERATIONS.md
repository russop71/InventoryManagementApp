# ZestIQ launch operations

## Required production configuration

Set these in Vercel Production and redeploy: `APP_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ADDITIONAL_LOCATION`, `STRIPE_WEBHOOK_SECRET`, `OPENAI_API_KEY`, `DEMO_ACCOUNT_PASSWORD`, and `ZESTIQ_PLATFORM_ADMIN_EMAILS`.

Optional controls: `ZESTIQ_AI_DAILY_USER_LIMIT` (default 60), `ZESTIQ_AI_DAILY_ACCOUNT_LIMIT` (default 600), `ZESTIQ_ALERT_WEBHOOK_URL`, and `ZESTIQ_BILLING_BYPASS_ACCOUNT_IDS`. Billing bypass IDs should only be used for explicitly approved internal accounts.

The Basic Stripe Price must be CAD $249.99 monthly for the first location. The additional-location Stripe Price must be CAD $199 monthly. Scheduling is a separate CAD $49.99 monthly account add-on; when purchased for the first location, it covers every location on that account. Trials are not used. Register the webhook at `https://zestiq.ca/api/stripe-webhook`.

## Go-live checks

1. Open `/api/health` and confirm `ok: true`.
2. As a configured platform administrator, open `/api/v1/platform/readiness`; this also validates both live Stripe Prices.
3. Complete one Stripe test-mode checkout, confirm the account changes to `active`, then refund/cancel it in Stripe test mode.
4. Confirm an unpaid owner is sent to Billing, paid owners enter onboarding, staff use ZestEmployee, and staff cannot modify company operations.
5. In two browsers, edit the same location and confirm the stale browser is stopped and refreshed.
6. Scan one invoice PDF and one recipe photo, then confirm usage events were recorded.
7. Import a POS CSV and confirm the dashboard uses those sales. Direct POS sync remains activation-based until each provider approves production access.

## Backups and recovery

Run a nightly encrypted backup from a secure runner with Supabase secrets:

`npm run backup -- --output /secure/zestiq-backups`

Verify each produced file:

`npm run backup:verify -- /secure/zestiq-backups/zestiq-backup-....json`

Keep backups outside GitHub, encrypt the storage volume, restrict access to ZestIQ operations staff, and test a restore into a separate Supabase staging project every month. Never test restores against production. Supabase platform database backups should also remain enabled as the primary point-in-time recovery layer.

## Incident response

If `/api/health` fails, review Vercel function logs and the configured alert destination. For suspected account exposure, disable the affected user, rotate server keys, preserve audit events, and document the timeline. For payment issues, use Stripe's event log and resend the affected webhook after correcting configuration.
