# ZestIQ Demo Launch Fix Checklist

Last updated: 2026-09-09

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

## Deployment safeguards

- [x] Restore the approved current-design frontend as the single production source in GitHub `main`.
- [x] Add a production build gate that blocks deployment when the approved homepage, navigation, employee routes, inventory merge/storage features, or lemon brand asset are missing.
- [x] Archive and clearly label the former standalone preview copy so it cannot be mistaken for the deployable production project.
- [x] Protect GitHub `main` so deployments require review and passing checks.

## External production configuration discovered during release

- [ ] Configure the missing Vercel production Stripe values: secret key, Basic price, additional-location price, Scheduling price, and webhook secret. `/api/health` remains intentionally not-ready until these values exist.
- [ ] Reconcile the Supabase migration history reported by the GitHub Supabase Preview check; remote migration versions are currently absent from the repository’s local migration directory.

## Full product function audit — 2026-09-09

### Verified in this audit

- [x] All 78 automated unit/API tests pass.
- [x] All 30 local end-to-end browser checks pass across desktop and mobile; the two production-only AI checks are intentionally excluded from routine runs and passed separately against zestiq.ca.
- [x] The production build and approved-design guard pass.
- [x] All public-demo routes load without runtime, authentication-token, or horizontal-overflow errors at desktop and mobile widths.
- [x] The recipe camera flow obtains camera media, captures a JPEG image, sends it to the scanner, and opens human review at desktop and mobile widths using an emulated camera.
- [x] A controlled handwritten recipe photo is read successfully by the live production AI service.
- [x] Clear handwritten ingredients match the closest safe inventory items while unsafe substitutions remain unapproved for human review.
- [x] Users can correct the scanned ingredient name, inventory match, quantity, and unit before approving the scan, and can edit the resulting recipe again before saving.
- [x] Restaurant packaging units such as `case` and `bottle` cost correctly when the scanned and inventory units are the same.
- [x] Camera startup and capture failures show an actionable message instead of silently doing nothing, and camera access is released when the scanner closes or the user navigates away.
- [x] Invoice camera capture works at desktop and mobile widths, and users can correct the supplier, invoice number, date, item details, package quantities, and costs before posting.
- [x] Invoice-review labels are connected to their fields for keyboard and assistive-technology use.
- [x] Correcting invoice package size or package count recalculates the total received quantity and line cost.
- [x] Invoice upload accepts JPEG, PNG, WebP, and PDF; rejects unsupported or oversized files with clear feedback; and leaves the scanner usable after a service failure.
- [x] Invoice review preserves tax and credits separately, requires acknowledgement for low-confidence or unmatched extraction, labels newly created suppliers/items, blocks duplicate invoice stock updates, and rejects scans with no readable lines.
- [x] Inventory items support validated creation, refresh persistence, editing, invoice-alias search, multiple storage areas with correct roll-ups, duplicate merging with alias retention, and deletion.
- [x] Inventory counts support draft saving/resume, the same item in multiple storage areas, finalization, inventory roll-up, and locked finalized records.
- [x] Inventory item creation and multi-area count controls provide clear validation and accessible field names.
- [x] Menu items support validated creation, current-cost calculation, compatible unit conversion, duplicate-ingredient prevention, missing-cost display, refresh persistence, editing and deletion.
- [x] Prepared recipes support validated ingredients and yields, per-yield cost recalculation, refresh persistence, editing and deletion; prepared recipes cannot be selected as their own ingredients, preventing circular references by design.
- [x] POS-informed forecasts can be generated, reviewed, saved and restored after refresh, and the forecast date remains visible and editable.
- [x] Forecast ordering deducts expected usage, replenishes to par, applies selectable 5%, 10% or 15% safety buffers, and only applies minimum-order quantities when a shortage exists.
- [x] Multi-supplier approvals create one persistent order per supplier, resist double-click duplicates, and preserve reviewed quantity overrides in supplier email drafts.
- [x] Supplier email drafts support editable recipients, CC, subjects, bodies and quantities, explain missing supplier email setup, and download a branded reviewed-order PDF.
- [x] Saved purchase orders support editable quantities, costs and receipt dates; edits persist after refresh and update linked invoice information.
- [x] Mobile pages leave enough scroll clearance that the floating AI assistant and bottom navigation do not block end-of-page actions.

### Still required before calling every function client-ready

- [ ] Run a real-device camera check on physical iPhone and Android browsers, including first-time permission, denied permission, rear-camera selection, rotation, retake, poor light, and large-photo behaviour. Browser emulation cannot prove physical camera behaviour.
- [ ] Test handwriting recognition with a broader, consented sample set covering cursive, faint ink, crossed-out lines, fractions, abbreviations, mixed units, multi-page recipes, shadows, rotation, and partially obscured text; define and meet an acceptance threshold.
- [x] Add end-to-end create, edit, validation, save, refresh, and delete coverage for inventory items, multi-area counts, merges and invoice aliases.
- [x] Extend invoice end-to-end coverage beyond the completed camera, image/PDF upload, review, failure-recovery, and post paths to include duplicates, tax, credits, unknown suppliers/items, low-confidence extraction, and rejected/illegible photos.
- [x] Add end-to-end coverage for recipe create/edit/delete, yield changes, unit conversions, missing costs, duplicate ingredients, prepped recipes, and circular recipe references.
- [x] Add end-to-end coverage for forecast generation, selectable order buffers, order editing, approval, supplier grouping, PDF/email output, and failed delivery.
- [ ] Add end-to-end coverage for waste, labour schedules, employee requests, POS imports, permissions/roles, onboarding, billing, password recovery/MFA, exports, and notification behaviour.
- [ ] Verify graceful error and recovery behaviour for offline use, slow requests, request timeouts, expired sessions, double-clicked submissions, refresh during editing, and API/service outages.
- [x] Run an accessibility audit across every public-demo route on desktop and mobile. Added persistent automated checks for document landmarks, control names, image alternatives, ARIA references, keyboard focus visibility, reduced motion, and 200%-equivalent reflow; corrected the issues found.
- [x] Run a performance audit and split the main JavaScript bundle. Public routes now load on demand; the live production main chunk is 294.50 kB minified (94.43 kB gzip), down from 618.75 kB, and the 500 kB warning is gone.
