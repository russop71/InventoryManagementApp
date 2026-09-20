# Clover connector — sandbox implementation, NOT production-ready

## Sandbox provisioning status (2026-09-20)

- Created the separate Free-plan Supabase project **ZestIQ Clover Sandbox**, reference `xaimpnzcvlolbnavijme`. The existing live project was not modified.
- Disabled automatic public table grants and enabled automatic RLS at project creation. Used the provider-generated database password without exporting it.
- Installed the core schema and app-user/session schema (equivalent to the first two migrations, with additional PUBLIC revokes) and the Clover connector migration in one SQL transaction. Later application migrations still need applying before an end-to-end app preview; no migration-history entries were fabricated.
- Real Postgres smoke checks passed: connector RLS, checked client grants, cross-tenant lease/disconnect denial, lease exclusivity, snapshot completion, duplicate-merchant uniqueness, and disconnect. All temporary fixture rows were rolled back.
- No Clover secret, hosting environment variables, OAuth connection, scheduled sync, or production deployment has been configured yet. No paid plan was authorized.
- Follow-up: installed the remaining application schema columns/tables/indexes from the later migrations in the empty sandbox, with explicit service-role grants and PUBLIC/client revokes. Supabase returned `Sandbox application schema ready`. Historical-data updates were unnecessary because the sandbox has no accounts. Clover developer login expired again before credential configuration; user sign-in is required.

## Implemented

- Owner/admin-only, tenant/location-scoped connect/status/disconnect and test snapshot endpoints under `/api/v1/clover`.
- Clover v2 authorization-code exchange with a 10-minute, single-use database nonce bound to a secure browser cookie. Callback rechecks membership and location.
- AES-256-GCM encrypted tokens with tenant/location/environment associated data; private RLS tables with service-role-only grants. Tokens never enter client storage or `location_data`.
- Expiring token refresh, database sync lease, bounded pagination, isolated seven-day order/menu snapshots, safe provider errors and status display.
- One merchant per location per environment; a merchant cannot silently be connected to a different client.

## Deployment prerequisites — not applied automatically

1. Apply `supabase/migrations/20260921090000_clover_connections.sql` to a staging database. Test constraints/RPCs and concurrency on real Postgres before release.
2. Configure server-only `CLOVER_CLIENT_ID`, `CLOVER_CLIENT_SECRET`, `CLOVER_TOKEN_KEY` (a random 32-byte base64 AES key), `CLOVER_ENVIRONMENT=sandbox`, `APP_URL` (HTTPS origin). Never put secrets in VITE variables, git, client JavaScript, or chat. Back up the encryption key securely; losing it requires merchant reconnection.
3. Set `CLOVER_ENABLED=true` only after the migration and credentials are ready. Default is disabled. Use the existing sandbox app, not a production merchant subscription.
4. In Clover REST settings configure Site URL to the staging origin, Alternate Launch Path `/app/integrations`, and use Code response mode. Callback is `<APP_URL>/api/v1/clover/callback`; verify Clover accepts its redirect URI. App Market launches go to ZestIQ sign-in/location selection; do not accept unsolicited callback codes without state.
5. Grant only read permissions needed for the data being tested. No employee data is requested by this implementation. A human must approve any Clover permissions/agreements and authorize their test merchant.
6. Test cancellation, replay, cross-account/location access, invalid merchant IDs, expired tokens, concurrent sync, reconnect/disconnect races, and interrupted token refresh. Confirm that the real Clover response echoes state and client ID.

## Remaining before plug-and-play launch

This is a connection foundation, not an accounting integration. Snapshots DO NOT update dashboard revenue, covers, recipes, or actual-vs-theoretical usage. No scheduled synchronization is enabled. Existing file imports remain available.

- Implement normalized sales/menu publication with real fixture coverage for tax, tips, discounts, refunds, voids, weighted items, modifiers, guest counts, local business-day boundaries and currency. Fetch complete line items; do not treat an order total as net sales or order count as covers.
- Add idempotent daily data replacement, ingredient mapping review and provenance, preserving imported/historical data. Protect publication against concurrent location-data writes.
- Add scheduled jobs with bounded batches, retries/backoff, monitoring, incremental backfill and uninstall/revocation handling. Snapshot sync currently limits one collection to 10,000 records and rejects partial results.
- Exercise token refresh recovery after storage failure and disconnect/callback races. Disconnect removes server credentials/snapshot; users separately uninstall/revoke the app in Clover if required.
- Complete Clover developer verification, production app creation and app approval. Use separate production credentials/key; explicitly authorize real restaurant access. Never mix sandbox results with customer reporting.

Reference: https://docs.clover.com/dev/docs/high-trust-app-auth-flow
Reference: https://docs.clover.com/dev/docs/refresh-access-tokens
