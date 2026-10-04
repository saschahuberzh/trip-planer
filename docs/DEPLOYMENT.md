# Deployment (Vercel, Phase 13)

The app is a static-first Next.js app with a service worker. It has no backend and no
server secrets; Vercel only serves the build. All user data stays in the browser (IndexedDB).

## Before the first deployment: choose the final address

IndexedDB is stored **per origin** (scheme + domain). Data created on
`my-app.vercel.app` is not visible on `travel.example.com`, and every Vercel preview URL is
its own origin with its own (empty) data. So:

- Decide early on the production address (Vercel subdomain or your own domain) and use only
  that one for real trips. Preview URLs are for testing.
- Moving to another domain later: Settings → Export backup on the old address,
  Import on the new one.
- On iPhone the installed app keeps the address it was installed from.

## Configuration in the repository

- `vercel.json`: framework Next.js, `npm ci`, and `npm run build` (needed: webpack build for
  Serwist and the `prebuild` step that copies the MapLibre worker into `public/vendor/`).
- Node.js 22 comes from `package.json` → `engines`.
- Headers (`next.config.ts`): `sw.js` is never cached (`no-cache, no-store, must-revalidate`)
  so updates are detected; the versioned MapLibre worker is cached long-term; basic security
  headers on all responses.
- Environment variables: optional and public only, see `.env.example`
  (`NEXT_PUBLIC_MAP_STYLE_URL`, `NEXT_PUBLIC_PHOTON_URL`). Never put secrets in
  `NEXT_PUBLIC_*` variables — they end up in the browser bundle. V1 needs none.

## Steps

1. Push the repository to GitHub (or GitLab/Bitbucket):
   `git remote add origin <repo URL>` and `git push -u origin main`.
2. In Vercel: **Add New → Project → Import** the repository. The settings from `vercel.json`
   are picked up; no changes needed. Environment variables: none required.
3. **Deploy.** Every push to `main` deploys production; other branches get preview URLs.
4. Optional: **Settings → Domains** to add your own domain (HTTPS is automatic).

## Verify the deployment

1. `npm run verify:deployment -- https://<your-app>.vercel.app`
   (HTTPS and HTTP→HTTPS redirect, PWA meta tags, manifest and icon sizes, `sw.js` headers,
   every precached URL returns 200, MapLibre worker MIME type). All checks must pass.
2. Desktop Chrome → DevTools → Application: Manifest without errors; Service Workers
   "activated and running"; Cache Storage contains the precache.
3. Offline (DEPLOY-006): open the app once, reload, then DevTools → Network → Offline
   (or Airplane Mode on the phone) and follow `docs/OFFLINE_VERIFICATION.md`.
4. Update flow (DEPLOY-006): with the app open, push a small change → after the new
   deployment, switch back to the app (or reload) → "Update available" → Reload →
   trips unchanged.
5. iPhone installation (DEPLOY-005): `docs/IPHONE_VERIFICATION.md`.

## Last verification

Production: https://trip-planer-sigma.vercel.app (2026-10-04)

- `npm run verify:deployment -- https://trip-planer-sigma.vercel.app`: all 25 checks passed
  (HTTPS, HTTP → HTTPS redirect (308), PWA meta tags, manifest and icons, `sw.js` not cached,
  all 66 precached URLs return 200, MapLibre worker MIME type).
- `PLAYWRIGHT_BASE_URL=https://trip-planer-sigma.vercel.app npx playwright test`: offline start,
  all features offline, backup export/restore — 3 of 3 passed.
- Online features from the production origin: Photon place search and OpenFreeMap tiles work.
- Update flow in production: pending (needs a second deployment).
- iPhone installation: pending (`docs/IPHONE_VERIFICATION.md`).

Local production build: `npm run verify:deployment -- http://localhost:3123 --allow-http` passed.
