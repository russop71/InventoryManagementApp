
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

  ## Important data note

  Current app data is stored in browser localStorage. That means:

  - Data persists for a user on the same browser/device.
  - Data is not automatically shared across different devices.

  If you want true cloud sync for accounts, users, and locations across all devices, the next step is adding a backend database and auth API.

  ## Live shared data layer

  The app now includes a backend API for shared data across users/devices:

  - Accounts
  - Users
  - Locations
  - Inventory
  - Recipes

  Current backend persistence uses a server-side JSON store at `server/data/live-data.json`.
  