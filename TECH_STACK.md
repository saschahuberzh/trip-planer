# Technical Stack

## Application

- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS

Use the current stable versions unless the existing project specifies otherwise.

TypeScript strict mode must be enabled.

## Tooling

- Package manager: npm (commit `package-lock.json`)
- Runtime: Node.js 22 LTS (pin via `engines` and `.nvmrc`)
- Unit/integration tests: Vitest
- IndexedDB tests: fake-indexeddb
- E2E tests: Playwright may be introduced later for important PWA/offline flows

Required npm scripts:

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run typecheck`
- `npm run lint`
- `npm test`

---

## Architecture

The application is client-first and local-first.

Data flow:

UI
↓
Application / Service Layer
↓
Repository Layer
↓
IndexedDB

React components must NOT access IndexedDB directly.

Use repository/service abstractions so that storage implementation details remain separate from UI components.

### Next.js Rendering Model

- Use the App Router. Do NOT use `output: "export"`.
- V1 has no custom backend: no API routes, Server Actions or databases for user data.
- All user data is read and written in the browser via IndexedDB.
- Pages render a static client shell on the server. Data loading happens in client components.
- Server-rendered output must not depend on user data or on dynamic route parameter values,
  so that route HTML is identical for every ID and can be cached by the service worker.
- Code touching IndexedDB, `window`, `navigator` or the service worker runs only on the client.

### Routes

```
/                              Trips (home)
/settings                      Settings (global)
/trips/[id]                    Trip overview
/trips/[id]/plan               Itinerary
/trips/[id]/plan/[dayId]       Day view
/trips/[id]/map                Map
/trips/[id]/places             Places
/trips/[id]/places/[placeId]   Place detail
/trips/[id]/budget             Budget
/trips/[id]/accommodation      Accommodation
/trips/[id]/bookings           Bookings
```

Create/edit forms may be routes or modal sheets; decide per ticket.

### Offline Dynamic Routes

Trip IDs are created locally (including while offline), so the service worker cannot rely on
having previously cached a specific `/trips/<id>/...` URL.

Strategy:

- The service worker answers navigations to `/trips/<any id>/<section>` with a precached
  route template for that section when the network is unavailable.
- Client code reads route IDs from the actual URL, through one shared hook,
  so a template response works for any ID.
- Client-side navigation that fails to fetch route data offline must fall back to a full
  navigation that the service worker can answer.

Phase 1 must verify this strategy in a production build (see FOUND-008).
If it cannot work reliably with the App Router, stop and escalate before continuing.
Do not silently switch routing models.

---

## Local Database

Use IndexedDB via Dexie.js.

IndexedDB is the primary persistent data store.

Requirements:

- Database schema versions are explicit and migrations are versioned.
- Migrations must preserve existing data. Never delete/recreate the database to fix a migration.
- Handle `versionchange`/blocked events: an older open tab must close its connection and ask
  the user to reload instead of blocking the upgrade.
- Multi-entity changes (reordering, deletes with unlinking, restore) run in a single transaction.
- Images are stored as Blobs in a separate table (see DATA_MODEL.md).

### Storage Durability

- On first meaningful use, call `navigator.storage.persist()` where supported and record the result.
- The UI must explain that browser/PWA storage can still be removed by the operating system
  or browser (notably on iOS), and that JSON export is the durable backup.
- Settings shows the last JSON export date and encourages regular exports.

---

## Dates and Times

Follow DATA_MODEL.md conventions:

- calendar dates `YYYY-MM-DD`
- local event date/times as `LocalDateTime` (`local` + IANA `timeZone`)
- metadata instants as ISO 8601 UTC

Never reinterpret travel dates or times in the device timezone.
Prefer the built-in `Intl` APIs. A small date library may be added only if a concrete need arises.

---

## Maps

Prefer MapLibre GL JS.

Map-related functionality must be encapsulated so the map provider can be replaced later.

Load the map library lazily on the client only. Map failure must be contained in the map component.

Map tiles are not cached for offline use and do not need to work offline.

If the user is offline and map tiles cannot load:

- itinerary still works
- places still work
- coordinates remain visible
- budget still works
- bookings still work
- editing still works

The tile source and any API key are configured via public environment variables.
Only keys intended for browser use may be exposed.

---

## PWA

Use Serwist for the service worker.

Implement:

- Web App Manifest (`display: standalone`)
- icons, including `apple-touch-icon`
- iOS meta tags and safe-area handling (`viewport-fit=cover`)
- precaching of the application shell and route templates
- navigation fallback for offline use
- offline startup after first online visit

Rules:

- User data comes only from IndexedDB. The service worker never caches or stores user data.
- Do not cache API or third-party responses blindly. Map tiles are not runtime-cached.
- The service worker is disabled in `next dev`. Test PWA behavior with a production build.
- Use the Serwist integration that matches the Next.js bundler. If it requires webpack,
  build with webpack explicitly.

### Service Worker Updates

- Precache entries are versioned by Serwist's build manifest (content revisions).
- A new service worker installs in the background and waits. No automatic `skipWaiting`.
- The app shows an "Update available" prompt. On user confirmation, the app tells the
  waiting worker to activate and reloads once.
- Outdated precaches are cleaned up on activation.
- Service worker updates must never clear or modify IndexedDB.
- Database migrations run in the app (Dexie) on startup, never in the service worker.
- New app code must be able to open and migrate databases created by any earlier released version.

---

## Cloud

Cloud backup is a future feature. No provider is chosen and none is implemented in V1.

Cloud backup must be abstracted behind a CloudBackupProvider interface.

Conceptual interface:

```ts
interface CloudBackupProvider {
  authenticate(): Promise<void>
  disconnect(): Promise<void>
  uploadBackup(data: BackupData): Promise<void>
  downloadBackup(): Promise<BackupData>
  getLastBackupDate(): Promise<Date | null>
}
```

Constraints for a future provider:

- Prefer client-side authentication (e.g. OAuth with PKCE) that requires no custom backend and no client secret.
- Must account for OAuth redirect behavior in iOS standalone PWAs.
- Downloaded backups go through the same validation and Replace restore as local JSON import.
- Cloud is never required for normal application use.

Do not couple application components directly to a specific cloud provider.

---

## Backup

See DATA_MODEL.md for the backup format, validation and restore rules.

- JSON backup format is versioned independently of the database schema.
- The primary export contains the complete application data, including images.
- Restore is Replace, after complete validation, confirmation and an automatic safety backup.
- Invalid backups must never modify existing local data.
- Trip-only export/import is out of scope until a safe format is defined.

---

## Deployment

Hosting:

Vercel

Requirements:

- HTTPS
- production build succeeds
- PWA remains installable
- `sw.js` is served with no-cache headers so updates are detected
- environment variables must not be committed
- secrets must never be included in client bundles; V1 has no server secrets

---

## Testing

Use Vitest for:

- data repositories (with fake-indexeddb)
- migrations
- itinerary ordering
- trip date-change handling
- delete/unlink behavior
- date/time utilities
- budget calculations
- backup serialization, validation and restore

UI tests should focus on important user flows rather than implementation details.

Offline/PWA behavior is verified manually against a production build until Playwright is introduced.

---

## Quality

Before considering a task complete run:

1. `npm run typecheck`
2. `npm run lint`
3. `npm test`
4. `npm run build` when appropriate

Do not leave TypeScript errors or lint errors.
