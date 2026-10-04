# Implementation Plan

Development must happen incrementally.

Do not attempt to implement the entire application at once.

Every phase must leave the application in a working state.

---

# Phase 1 – Foundation

Tasks:

FOUND-001
Create Next.js (App Router) + TypeScript project with npm and Node.js 22 LTS
(`engines`, `.nvmrc`). Do not use `output: "export"`.

FOUND-002
Configure Tailwind.

FOUND-003
Enable TypeScript strict mode.

FOUND-004
Create basic mobile-first application shell (safe-area handling, iOS meta tags).

FOUND-005
Create navigation structure:
- global navigation: Trips, Settings
- placeholder pages for all routes in TECH_STACK.md
- trip section navigation (Plan, Map, Places, Budget, Accommodation, Bookings)
- one shared hook that reads route IDs from the actual URL

FOUND-006
Configure ESLint and Vitest (with fake-indexeddb available for later phases).
Add npm scripts: `dev`, `build`, `start`, `typecheck`, `lint`, `test`.

FOUND-007
PWA foundation with Serwist:
- Web App Manifest, placeholder icons, `apple-touch-icon`
- service worker precaching the app shell and trip route templates
- offline navigation fallback
- versioned update flow: waiting worker + "Update available" prompt, no automatic `skipWaiting`
- service worker disabled in development

FOUND-008
Verify offline routing in a production build (`npm run build && npm run start`):
- open the app online once
- go offline
- reload `/`, `/settings`
- open `/trips/<new random UUID>/plan` and other trip sections
- confirm the correct section renders and the hook returns the URL's ID
- confirm an update prompt appears after rebuilding with a change

Document the manual verification steps in the repository.
If the App Router cannot support this reliably, stop and report before continuing.

Acceptance criteria:

- application starts
- typecheck passes
- lint passes
- tests run (at least one example test)
- production build succeeds
- installed/production app starts offline after first visit
- unvisited trip routes render their section offline

---

# Phase 2 – Local Database

DATA-001
Install/configure Dexie.

DATA-002
Implement database schema for all entities in DATA_MODEL.md, including
`images`, `appMeta` and `safetyBackups` tables and a unique `[tripId+date]` index for TripDays.

DATA-003
Implement shared domain types and date/time utilities
(calendar dates, `LocalDateTime`, IANA timezone validation, duration calculation).

DATA-004
Implement repository layer (repositories set `createdAt`/`updatedAt`).

DATA-005
Implement schema versioning/migrations and `versionchange`/blocked handling.

DATA-006
Request persistent storage (`navigator.storage.persist()`) and record the result in AppMeta.

Acceptance criteria:

- data persists after browser restart
- UI does not directly access IndexedDB
- database has explicit version
- date/time utilities and repositories have tests

---

# Phase 3 – Trips

TRIP-001
Display trips.

TRIP-002
Create trip (including base currency and optional budget amount; creates TripDays for the range).

TRIP-003
Edit trip (date changes create missing TripDays; empty out-of-range days are removed;
days with user data are preserved).

TRIP-004
Delete trip with confirmation (deletes owned entities and cover image).

TRIP-005
Trip detail screen.

TRIP-006
Cover image: downscale client-side, store as ImageAsset, reference by ID.

Acceptance criteria:

A user can completely manage trips offline.
Trip date-change behavior has tests.

---

# Phase 4 – Itinerary

PLAN-001
Display trip days.

PLAN-002
Implement itinerary ordering service (shared `sortOrder` per bucket, see DATA_MODEL.md).

PLAN-003
Create activities.

PLAN-004
Edit activities.

PLAN-005
Delete activities (unlink referencing bookings/expenses once those exist).

PLAN-006
Reorder timeline entries.

PLAN-007
Move entries between days and Unplanned.

PLAN-008
Unplanned section.

PLAN-009
"Outside trip dates" section with manual resolution actions.

PLAN-010
Sort a day by time (explicit action).

Acceptance criteria:

Ordering service and out-of-range handling have tests.

---

# Phase 5 – Places

PLACE-001
Create places.

PLACE-002
Edit places.

PLACE-003
Delete places (confirmation; unlink references as defined in DATA_MODEL.md).

PLACE-004
Favorite places.

PLACE-005
Visited status.

PLACE-006
Search.

PLACE-007
Filters (including planned/unplanned as defined in DATA_MODEL.md).

PLACE-008
"Add Place" from Day View (select/create place, create linked activity).

PLACE-009
Place search behind the `PlaceSearchProvider` abstraction (TECH_STACK.md "Place Search");
Photon as the initial provider; results mapped into our own Place model (`externalRef` informational).

PLACE-010
Place field in the activity form: select existing, create new, remove link; existing activities can be linked.

PLACE-011
Manual places (name only, no search result required); coordinates from pasted map links
and manual entry (works offline); search results usable as a starting point.

PLACE-012
Place Detail "assign to day" and list of activities using the place.

Acceptance criteria:

Places can be created, edited and linked to activities offline (without search).
Search failures never block place editing.
Provider mapping, map-link parsing and place delete/unlink behavior have tests.

---

# Phase 6 – Map

MAP-001
Integrate map component (lazy, client-only, failure contained).

MAP-002
Display places as markers.

MAP-003
Marker details.

MAP-004
Fit map to trip.

MAP-005
Day filtering.

MAP-006
Place category filtering.

MAP-007
Route/order visualization (numbering and straight-line connections as defined in SCREENS.md "Map").

MAP-008
Map picker: set or correct a place's position by tapping/dragging a pin, available from
Create / Edit Place ("Set on map") and for places listed as "not on map" on the Map screen.
Map failure leaves link/manual coordinate entry usable.

The application must remain usable if map loading fails.

---

# Phase 7 – Transport

TRANSPORT-001
Create transport (`LocalDateTime` departure/arrival, calculated duration with optional override).

TRANSPORT-002
Edit transport.

TRANSPORT-003
Delete transport.

TRANSPORT-004
Display transport in the shared itinerary timeline.

TRANSPORT-005
Display relevant connections on map.

---

# Phase 8 – Accommodation & Bookings

ACCOM-001
Accommodation CRUD (place-linked vs. own location fields).

ACCOM-002
Accommodation itinerary integration (shown on nights within check-in/check-out).

BOOK-001
Booking CRUD (optional link to transport, accommodation or activity).

BOOK-002
Booking overview.

---

# Phase 9 – Budget

BUDGET-001
Expense CRUD (status, original amount/currency, optional manual exchange rate,
stored amountInBaseCurrency, optional linked entity).

BUDGET-002
Planned vs spent totals in base currency with completeness flag.

BUDGET-003
Category totals.

BUDGET-004
Daily totals (including undated).

BUDGET-005
Remaining budget (marked incomplete when paid expenses are unconverted).

BUDGET-006
Per-currency totals for unconverted expenses.

BUDGET-007
Base-currency change with confirmation (clears conversions as defined in DATA_MODEL.md).

Acceptance criteria:

Budget calculations have tests, including the mixed-currency example in DATA_MODEL.md,
stability of stored converted amounts, and base-currency changes.

---

# Phase 10 – PWA Hardening

PWA-001
Final application icons and manifest details.

PWA-002
Review precache contents and update flow against all implemented routes.

PWA-003
Verify offline startup and editing with all features.

PWA-004
Verify standalone iPhone mode.

PWA-005
Optional: introduce Playwright for critical offline/PWA flows.

Acceptance test:

1. Open application online.
2. Create trip.
3. Close application.
4. Disable internet.
5. Start installed PWA.
6. Trip remains available.
7. Trip can still be edited.
8. A trip created offline can be opened in every section.

---

# Phase 11 – JSON Backup

BACKUP-001
Serialize complete database (including images as base64).

BACKUP-002
Export JSON (record last export date).

BACKUP-003
Validate JSON completely (schema, formats, unique IDs, references).

BACKUP-004
Import JSON with Replace semantics in a single transaction after confirmation.

BACKUP-005
Handle backup format versions (in-memory migration of older versions).

BACKUP-006
Create safety backup before restore; list/export safety backups.

BACKUP-007
Storage durability UI in Settings (persistence status, warning, last export date).

Acceptance criteria:

- A fresh installation can restore all travel data from exported JSON.
- An invalid backup leaves existing data unchanged.
- A failed restore leaves existing data unchanged.

---

# Phase 12 – Cloud Backup (Deferred)

Not part of the first release. Requires a cloud provider decision first.

CLOUD-001
Define CloudBackupProvider interface (no provider).

CLOUD-002
Choose provider (prefer client-side authentication, no custom backend).

CLOUD-003
Implement authentication (including iOS standalone PWA redirect handling).

CLOUD-004
Upload JSON backup.

CLOUD-005
Download JSON backup.

CLOUD-006
Show last backup timestamp.

CLOUD-007
Restore backup using the same validation and Replace flow as local import, with confirmation.

CLOUD-008
Disconnect account.

Cloud functionality must remain optional.

The application must continue working if the cloud provider is unavailable.

---

# Phase 13 – Vercel

DEPLOY-001
Configure Vercel deployment (including no-cache headers for the service worker).

DEPLOY-002
Configure environment variables (public map configuration only; no server secrets in V1).

DEPLOY-003
Verify HTTPS.

DEPLOY-004
Verify PWA manifest.

DEPLOY-005
Test installation on iPhone.

DEPLOY-006
Test offline behavior and update flow of production deployment.

---

# Phase 14 – Polish

POLISH-001
Loading states.

POLISH-002
Error states.

POLISH-003
Empty states.

POLISH-004
Confirmation dialogs.

POLISH-005
Mobile UX improvements.

POLISH-006
Accessibility review.

POLISH-007
Performance review.

POLISH-008
Final production build.
