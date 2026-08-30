
  # zestIQ - Restaurant Inventory Management

  This project is a Vite + React web app.

  ## Local development

  1. Install dependencies:

  ```bash
  pnpm install
  ```

  2. Start the dev server:

  ```bash
  pnpm dev
  ```

  3. In another terminal, start the API server (required for shared account/location data):

  ```bash
  pnpm server
  ```

  3. Build for production:

  ```bash
  pnpm build
  ```

  The production output is generated in `dist/`.

  ## Build the ZestIQ iOS app

  The native iPhone and iPad project lives in `ios/` and uses the bundle ID
  `ca.zestiq.app`.

  1. Build the production web bundle and copy it into the native app:

  ```bash
  npm run build:ios
  ```

  2. Open the project in Xcode:

  ```bash
  npm run ios:open
  ```

  3. In Xcode, select the `App` target, choose the ZestIQ Apple Developer team,
     and confirm automatic signing. Use Product > Archive to create the build
     for TestFlight and App Store Connect.

  Camera, photo-library, and location permission descriptions are included for
  invoice scanning, recipe capture, and weather-aware forecasting. The native
  production build sends API requests to `https://zestiq.ca`.

  ## Deploy to zestiq.ca

  Yes, you can use `zestiq.ca` for this app.

  This repo now includes SPA routing config for:

  - Vercel (`vercel.json`)
  - Netlify (`netlify.toml`)

  Choose one hosting provider below.

  ## Option A: Vercel (recommended)

  1. Push this repo to GitHub.
  2. In Vercel, import the repo.
  3. Build settings:
    - Framework preset: `Vite`
    - Build command: `pnpm build`
    - Output directory: `dist`
  4. Deploy.
  5. In Vercel project settings, add domain:
    - `zestiq.ca`
    - `www.zestiq.ca`
  6. At your DNS provider, create records Vercel gives you.

  ## Option B: Netlify

  1. Connect the repo in Netlify.
  2. Build settings:
    - Build command: `pnpm build`
    - Publish directory: `dist`
  3. Deploy.
  4. Add custom domain in Netlify:
    - `zestiq.ca`
    - `www.zestiq.ca`
  5. At your DNS provider, add Netlify DNS records.

  ## DNS checklist for zestiq.ca

  Use records provided by your host. Typical setup is:

  - Apex/root: `zestiq.ca` -> `A` or `ALIAS/ANAME` record from host
  - Subdomain: `www.zestiq.ca` -> `CNAME` to host target

  After DNS propagates, HTTPS certificates are issued automatically by Vercel/Netlify.

  ## Live shared data layer

  Production uses Supabase authentication and a company/location-scoped PostgreSQL data layer. The API provides shared data across authorized users and devices for:

  - Accounts
  - Users
  - Locations
  - Inventory
  - Recipes, invoices, counts, ordering, labour, billing metadata, and audit events

  Browser storage is only a scoped local cache. The Express JSON server under `server/` is a local-development fallback and is not the production database. See `docs/LAUNCH_OPERATIONS.md` for production configuration, readiness checks, billing validation, backups, and incident response.
