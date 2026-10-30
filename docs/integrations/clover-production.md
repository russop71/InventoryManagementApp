# Clover production activation

The production connector uses North American Clover OAuth v2. Sandbox credentials and merchant API keys are not accepted by the restaurant setup form. The connector stays unavailable until all server configuration is present.

## Restaurant experience

1. Select a ZestIQ restaurant location, open Integrations → Clover Dining → Direct connection.
2. Click **Connect Clover securely**, sign in on Clover, select the matching restaurant and approve access.
3. Return to ZestIQ. Check the authorized merchant name and click **Sync Clover now**. Confirm the restaurant before replacing the current POS feed.
4. Daily updates run at 10:00 UTC. The page shows the last successful sync and provider errors. **Stop automatic Clover sync** removes stored credentials and pending authorizations. Existing sales remain until separately disconnected/replaced.

Each Clover merchant can be connected to only one ZestIQ location at a time. Owner/admin users can manage their account's locations; managers must have location access. Ordering and staff users cannot manage Clover. Demo accounts cannot connect real merchants.

## ZestIQ operator setup

1. Create or use ZestIQ's Clover developer app. Complete Clover's sandbox validation and production approval process. This code does not create or approve the app.
2. Configure the app as a server/web app using expiring OAuth v2 tokens. Request the minimum read permissions for merchant information, orders/line items and inventory/categories. No write access to Clover is used.
3. Register the Site URL `https://zestiq.ca` and callback `https://zestiq.ca/api/clover/callback`. Configure the Alternate Launch Path to `https://zestiq.ca/app/integrations` so an App Market launch leads into the signed-in location selection flow; it must not bypass a ZestIQ-initiated, browser-bound authorization.
4. Apply `supabase/migrations/20261030140000_clover_production_connector.sql` in the production Supabase SQL editor using an administrator connection. The new tables/functions are restricted to the service role, with RLS and no browser grants. Back up the database before the usual production migration process.
5. Set these Vercel **Production** environment variables in the deployment dashboard, not in chat or source control:

| Variable | Value |
| --- | --- |
| `CLOVER_CLIENT_ID` | Approved production Clover app ID |
| `CLOVER_CLIENT_SECRET` | Production app secret |
| `CLOVER_ENCRYPTION_KEY` | New 32-byte key encoded as 64 hexadecimal characters; generate locally with `openssl rand -hex 32` |
| `CLOVER_PRODUCTION_ENABLED` | `true`, after the migration and Clover approval are complete |
| `APP_URL` | `https://zestiq.ca` |
| `CRON_SECRET` | Strong existing or new scheduler secret |
| `SUPABASE_URL` | Existing project URL |
| `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` | Existing server-only service role credential |

6. Redeploy the current main commit. Confirm `GET /api/clover/status` returns `{"available":true}`. This validates local configuration/table availability, **not** Clover approval or actual merchant authorization.
7. Connect an authorized test restaurant through the real UI, verify the displayed merchant, run a sync, compare sales/menu values with Clover, then verify the next scheduled run. Review Vercel cron logs; a 503 indicates a failed/incomplete batch. Do not call the cron against all live customers merely to test configuration.

The current environment has no connected Vercel or Supabase administrator tooling, so applying the production SQL and setting secrets requires the operator's dashboard access. Never paste secrets into a GitHub issue or chat. Keep a secure backup of the encryption key; changing it without re-encrypting existing credentials requires restaurants to reconnect.

## Reporting scope and operational limits

- Sync refreshes the last **seven complete calendar days**, grouped by each ZestIQ location's configured timezone, including daylight saving changes. Today is excluded. Existing historical Clover days from the **same merchant** outside that window remain unchanged.
- Revenue is item sales after item/order discounts and modifiers, **before refunds**, excluding tax and tips. It is not bank settlement or a refund-adjusted accounting report. Only locked, paid/refunded orders are included; open/deleted/test orders and deleted/non-revenue lines are omitted. Clover does not supply covers here, so counts are left at zero and described as unavailable.
- Line item reporting prices must be present. Missing pricing, an incomplete page, a provider failure or an exceeded batch/time limit fails without publishing partial sales. Weighted items use Clover's thousandths scaling.
- Inventory/catalog items become POS menu items; recipe ingredient and cost-category mappings are retained by ID. This connector does not create inventory ingredients or mutate Clover orders, menus or stock.
- Daily sync is one bounded Vercel cron run. It processes oldest successful sync first, with a 250-second total budget and a 1,000-connection safety limit. Each connection has a 180-second provider budget and a 10,000-record/page safety bound. A failed or unprocessed connection produces a non-200 cron response. Monitor and increase worker capacity before customer volume exceeds a single run; no unlimited throughput is claimed.
- One database lease per location prevents manual/scheduled sync overlap and concurrent refresh-token use. Disconnect cancels the lease, making an in-flight publish fail. Refreshed tokens are encrypted and saved before the next API call. Unrecoverable refresh failures require reauthorization.
- An atomic database publish updates only the POS snapshot. A trigger prevents stale client saves from replacing server-owned Clover data while retaining ingredient/cost-category mappings and other location integrations.

## Validation

`npm test`, `npm run build`, and `PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright npx playwright test tests/e2e/clover-activation.spec.ts`.

SQL regression checks are in `supabase/tests/clover_production.sql`. Run them only in a disposable database with the migration applied; fixtures use fixed test UUIDs and roll back. Application tests mock Clover/Supabase, so they do not establish that a production merchant has authorized the app.

Official references:
- https://docs.clover.com/dev/docs/high-trust-app-auth-flow
- https://docs.clover.com/dev/docs/generate-expiring-tokens-using-v2-oauth-flow
- https://docs.clover.com/dev/docs/use-refresh-token-to-generate-new-expiring-token
- https://docs.clover.com/dev/reference/ordergetorders
- https://docs.clover.com/dev/reference/ordergetorderlineitems
- https://docs.clover.com/dev/docs/using-cors
