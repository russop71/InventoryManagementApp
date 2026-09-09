# ZestIQ Demo Launch Fix Checklist

Last updated: 2026-09-08

Legend: `[x]` completed and verified locally; `[ ]` still requires work or live deployment.

## Critical — public demo safety

- [x] Replace the shared mutable public-demo workspace with a disposable, browser-isolated operational demo copy.
- [x] Hide real customer/team identity information from the public demo UI and user-list API.
- [x] Make account, billing, user, location, password, and destructive controls read-only in the public demo interface.
- [x] Prevent all public-demo account and location mutations—including billing, users, passwords, MFA, recovery, integrations and operational data—at the API layer.
- [x] Make the visible POS/integration setup controls read-only in the public demo interface.
- [x] Remove shared-data save conflicts by keeping each visitor’s demo changes local and stopping demo polling/server writes.
- [x] Verify every demo route using a fresh public-demo session after deployment.

## High — broken or misleading product behaviour

- [x] Inventory sort offers working A–Z, Z–A, stock, status, value, supplier, and recently updated choices.
- [x] Selected inventory items can be merged while retaining invoice/vendor aliases for future matching.
- [x] Inventory items support stock in multiple storage areas.
- [x] Inventory Count view button opens the active count, selected count, most recent count, or a new count as appropriate.
- [x] Orders sorting provides working newest, oldest, total, and supplier choices.
- [x] The local Try Demo Account button signs in successfully (verified through the local API).
- [x] Fix beverage recipe costs and margins in the seeded public demo, including a safe fallback for stale records.
- [x] Display distinct, useful purchase-order references and supplier names in demo orders.
- [x] Reconcile the forecasting empty-state message with the visible seven-day projections.
- [x] Seed believable shifts/hours/costs on the demo Labour page, including recovery from older empty schedules.
- [x] Stop an unconnected POS choice from replacing the currently connected provider.
- [x] Persist notification preferences across browser refreshes and clearly disable/label quiet hours until background delivery exists.
- [x] Clearly label the current order alarms as browser-only, in-app reminders that require ZestIQ to remain open.

## Medium — trust, support, and polish

- [x] Make Help categories and articles open the relevant working product areas.
- [x] Replace the hard-coded system-status claim with honest availability copy and a working issue-report action.
- [x] Remove fake US account defaults and use safe, clearly fictional Canadian demo information.
- [x] Replace non-working or “coming soon” buttons with working actions or visibly disabled controls.
- [x] Run keyboard, mobile, empty-state, and error-state checks across every demo route.
- [x] Add automated end-to-end coverage for the public demo’s core visitor path.

## Release gate

- [x] Production build passes.
- [x] Automated test suites pass (61/61 deployable app; 33/33 current-design preview).
- [x] Changes are deployed to zestiq.ca.
- [x] Live smoke test passes on desktop and mobile widths.

## External production configuration discovered during release

- [ ] Configure the missing Vercel production Stripe values: secret key, Basic price, additional-location price, Scheduling price, and webhook secret. `/api/health` remains intentionally not-ready until these values exist.
- [ ] Reconcile the Supabase migration history reported by the GitHub Supabase Preview check; remote migration versions are currently absent from the repository’s local migration directory.
