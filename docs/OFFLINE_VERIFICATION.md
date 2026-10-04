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
   - "Plan" renders and the header shows "Trip not found" (no trip has that ID).
   - The URL is unchanged.
6. Repeat for `/trips/<uuid>`, `/map`, `/places`, `/budget`, `/accommodation`,
   `/bookings`, `/plan/<dayId>` and `/places/<placeId>` (day and place pages show "Trip not found").
7. While offline, tap other section tabs and the bottom navigation → correct
   section renders with the same trip ID.
7a. Trips (Phase 3), still offline:
   - On `/` create a trip with several countries, a budget and a cover photo →
     the app opens `/trips/<new id>` and the header shows the trip's name and dates.
   - Reload → the overview still shows the trip; open the section tabs → the
     header shows the same trip.
   - Edit the trip (shorten its dates, change the cover) → changes appear immediately.
   - Delete the trip → confirmation lists what will be deleted; after confirming the
     app returns to `/` and the trip is gone.
7b. Itinerary (Phase 4), still offline:
   - Open the trip's Plan → one card per day, plus the Unplanned section.
   - Add activities with and without times, edit one (change its day), delete one.
   - Reorder → ↑/↓ change the order; "Sort by time" sorts the day; the move button
     moves an entry to another day or Unplanned. Reload → order is kept.
   - Open a day → date, title, notes and timeline; edit title/notes.
   - Shorten the trip so a day with activities falls outside → "Outside trip dates"
     section with Move all items / Change trip dates / Delete day.
7c. Places (Phase 5), still offline:
   - Places → Add: the online search says it needs an internet connection; enter a
     place manually (name only), save → it appears in the list as "No location yet".
   - Edit it: paste `41.311, 69.240` (or a Google Maps link with `@lat,lng`) → coordinates
     are filled; save. Toggle favorite/visited; filters and search work.
   - In a day: "Visit a place" → pick the place → an activity named after it is added.
     In an activity's form: choose/remove a place. Place detail lists where it's used.
   - Delete the place → its activities stay with their title.
7d. Map (Phase 6):
   - Online: Map → Route shows places of the day numbered and connected; Day and
     All places views work; tapping a marker opens the place panel; "Set position"
     for a place without coordinates places it by tapping the map.
   - Offline: the map area says it can't be shown; stops/places with coordinates are
     still listed below; Plan, Places and editing keep working.
7e. Transport (Phase 7), offline:
   - In a day: Transport → train from a place to a place with departure/arrival times
     and time zones → duration is calculated; on a day without places of the day the app
     offers to set them. The entry appears in the timeline with symbol, times and duration.
   - An overnight flight shows "+1"; arrival before departure is rejected.
   - Reorder/move it like an activity; delete it with confirmation.
   - Online: the Map's route segment between the two places shows the transport symbol.
7f. Accommodation & bookings (Phase 8), offline:
   - Accommodation → Add: link a place (or enter an address/coordinates), dates, times,
     price, booking link → the card shows nights and location; the summary counts nights
     without accommodation. Days show "Check-in / Night x of y / Check-out".
   - Bookings → Add: link a transport → title, date/time, price and reference are filled in.
     Bookings are grouped as Upcoming / Without date / Past; the linked entry opens its day.
   - Delete an accommodation with a linked booking → the booking stays without the link.
7g. Budget (Phase 9), offline:
   - Trip with base currency CHF and budget 3000. Add 800000 UZS at rate 0.000065,
     35000 KZT as "Amount in CHF" 63, 1200 KGS without rate, 220 CHF → Spent CHF 335,
     Remaining "Incomplete – provisional CHF 2,665", "Not converted: KGS 1,200".
   - Add a rate to the KGS expense → Remaining is final. Category and per-day totals follow.
   - Edit the trip's base currency → confirmation lists the conversions that will be cleared.
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
