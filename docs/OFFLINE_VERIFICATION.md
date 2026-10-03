# Offline Routing Verification (FOUND-008)

The service worker is disabled in `next dev`. Always verify PWA/offline behavior
against a production build.

## How offline routing works

- Every trip route is prerendered once for the placeholder ID `_template`
  (e.g. `/trips/_template/plan`, see `src/lib/routing/routes.ts`).
- The service worker precaches these templates plus `/`, `/settings` and `/~offline`.
- Navigations are network-first (5 s timeout). If the network fails, the service
  worker answers `/trips/<any id>/<section>` with the precached template for that
  section. Unknown paths get `/~offline`.
- Client code reads IDs from the real URL via `useAppRoute()`, never from Next.js
  `params`, so a template works for any ID.
- Offline client-side navigation: Next.js fails to fetch the RSC payload and falls
  back to a full browser navigation ("Falling back to browser navigation" in the
  console), which the service worker answers from the templates.

## Manual steps

Use Chrome (DevTools → Application) or Safari.

1. `npm run build && npm run start`
2. Open <http://localhost:3000> once while online. In DevTools → Application →
   Service Workers, confirm `sw.js` is activated. Reload once.
3. Go offline: stop the server (Ctrl+C) **and/or** tick "Offline" in DevTools.
4. Reload `/` → Trips page renders. Open `/settings` → Settings renders.
5. Open `/trips/<new random UUID>/plan` (e.g. from `crypto.randomUUID()` in the console):
   - "Plan" renders and the header shows exactly that UUID.
   - The URL is unchanged.
6. Repeat for `/trips/<uuid>`, `/map`, `/places`, `/budget`, `/accommodation`,
   `/bookings`, `/plan/<dayId>` and `/places/<placeId>` (day/place pages show their ID).
7. While offline, tap other section tabs and the bottom navigation → correct
   section renders with the same trip ID.
8. Open an unknown path (e.g. `/nope`) → "You are offline" page.
9. Update flow:
   - Go back online, change some visible text, `npm run build && npm run start`.
   - Load the app → "Update available" prompt appears. In DevTools the new worker
     is "waiting to activate" until you confirm.
   - Click "Reload" → the page reloads once with the new version.
   - IndexedDB contents (DevTools → Application → IndexedDB) are unchanged.

## Last verification

2026-10-03, Next.js 16.3.8 / Serwist 9.5.12, Chrome 154 (headless, scripted via
playwright-core outside the repo). All steps above passed in 6 consecutive runs,
both with browser offline emulation and with the server stopped.
Not yet verified on an iPhone (planned in PWA-004).
