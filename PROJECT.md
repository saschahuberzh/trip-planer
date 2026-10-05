# Travel Planner PWA

## 1. Project Goal

Build a personal, offline-first travel planning application inspired by the core travel-planning functionality of apps such as Wanderlog.

The application is intended primarily for a single user and should work as an installable Progressive Web App (PWA) on iPhone and desktop browsers.

The application must remain useful without an internet connection.

The primary source of truth for travel data is local storage on the device.

Cloud functionality is a possible future, optional backup/restore mechanism, not a requirement for using the application. V1 relies on local JSON import/export.

---

## 2. Core Principles

1. Offline-first
2. Local-first data storage
3. Mobile-first UI
4. No account required
5. Cloud backup is optional
6. User data must be exportable
7. Avoid vendor lock-in
8. Keep the architecture simple
9. Prefer maintainability over unnecessary abstraction
10. The application must be usable as an installed iPhone PWA

---

## 3. Core Features

### 3.1 Trips

Users can:

- create trips
- edit trips
- delete trips
- specify trip name
- specify any number of countries
- specify start date
- specify end date
- specify a base currency (reporting/budget currency only; any currency can be used within the trip)
- optionally specify a budget amount
- optionally add a cover image
- assign a status:
  - planned
  - active
  - completed

Status is set explicitly by the user and is not derived from dates.

Cover images are stored locally as separate image records, not inside trip data (see DATA_MODEL.md).

The main screen shows all trips.

---

### 3.2 Itinerary

Every trip contains an itinerary.

Trip days are stored records. Creating a trip creates one day per date; extending the trip creates the missing days.

Changing trip dates must never silently delete days containing user data. Such days outside the new range are preserved and shown as "outside trip dates" so the user can resolve them manually.

Users can:

- add activities to days
- assign optional times
- add places
- add notes
- reorder activities
- move activities between days
- create activities without a fixed time
- keep places/activities in an "Unplanned" section

Activities and transport entries share one ordered timeline per day. The user-defined order is authoritative; times are shown but do not reorder entries automatically.

Activities must support drag-and-drop/reordering where practical.

---

### 3.3 Places

A trip can contain places.

Supported place types:

- city
- attraction
- restaurant
- hotel
- airport
- train station
- custom

A place can contain:

- name
- type
- address
- latitude
- longitude
- website
- notes
- favorite flag
- visited flag

Places can exist without being assigned to a specific day.

A place is "planned" when it is referenced by an activity assigned to a day; otherwise it is "unplanned".

Places are collected independently of the itinerary (a list of places the user wants to visit)
and can be linked to activities. One place can be used by several activities.

Each day can list its "places of the day" (where the traveller is, e.g. "Tashkent → Samarkand"
on a travel day). They form the trip route shown on the map.

Places can be found with an online place search (name → address and coordinates), similar to
searching in Google Maps. The search provider is replaceable. Search results are copied into
the app's own Place records, so saved places never depend on the search provider and remain
available offline. Without internet, places can still be created manually (name only, or with
coordinates from a map link) and completed later.

---

### 3.4 Map

Each trip contains an interactive map.

The map should support:

- displaying all places
- displaying itinerary stops
- numbered route stops
- selecting map markers
- showing place information
- fitting the map to the complete trip
- filtering by day
- filtering by place type
- showing a single day's locations
- showing connections between major trip stops

The map should visually distinguish different place types.

The application itself must work offline.

Offline map tiles are NOT required for the initial version.

If map tiles are unavailable because the device is offline, the rest of the application must continue working normally.

Coordinates and stored place information must remain available offline.

---

### 3.5 Transport

Users can create transport connections.

Supported transport types:

- flight
- train
- bus
- car
- taxi
- ferry
- walking
- other

Transport contains:

- origin
- destination
- departure date/time
- arrival date/time
- optional duration (normally calculated from departure and arrival)
- price (informational)
- currency
- booking reference
- notes

Departure and arrival are stored as local date/time plus the IANA timezone of the location, so they display correctly regardless of the device timezone.

Transport entries appear inside the itinerary timeline together with activities.

---

### 3.6 Day View

Each day has its own detailed view.

Example:

12 June – Samarkand

09:00 Registan
↓ Walk – 15 min

11:00 Bibi-Khanum Mosque
↓ Taxi – 10 min

13:00 Lunch

15:30 Shah-i-Zinda

18:00 Train: Samarkand → Bukhara
Duration: 1h 45min

The day view should optionally include a map containing that day's places.

"Visit a place" (Add Place) in the day view means: select an existing place or create a new one, then create an activity linked to that place and day.

---

### 3.7 Budget

Every trip has a base currency and can have an optional budget amount.

Expenses are the only source of truth for budget calculations. Prices stored on transport, accommodation and bookings are informational and are never counted automatically. An expense may optionally reference the transport, accommodation, booking or activity it represents.

Expense categories:

- accommodation
- transport
- food
- activities
- shopping
- other

Expenses contain:

- title
- category
- status: planned (expected) or paid (spent)
- date
- original amount
- original currency (any ISO 4217 currency)
- exchange rate to base currency (optional)
- amount in base currency (stored when a rate is available)
- notes

The application should calculate:

- total planned costs
- total spent costs
- costs by category
- costs per day
- remaining budget

Multiple currencies must be supported. A trip may use any number of currencies (e.g. CHF, EUR, UZS, KZT, KGS, JPY, USD). The base currency is only used for reporting and the budget.

- The original amount and currency of each expense are always preserved and displayed.
- Exchange rates are entered manually per expense. Automatic exchange-rate fetching is not part of V1.
- When a rate is available, the converted amount is calculated once and stored. It does not change later unless the user edits that expense.
- Expenses in the base currency are always converted at rate 1.
- An expense in another currency without a rate is still valid. It is shown normally, counted in a separate total for its currency, and not included in the base-currency total.
- When any relevant expense is unconverted, the base-currency totals and the remaining budget are clearly marked as incomplete.
- Changing the base currency requires confirmation; conversions to the old base currency are cleared and must be re-entered.

Example (base currency CHF, budget CHF 3,000):

- 800000 UZS → 52 CHF
- 35000 KZT → 63 CHF
- 1200 KGS → no conversion
- 220 CHF → 220 CHF

Budget: CHF 3,000
Converted spending: CHF 335
Unconverted: KGS 1,200
Remaining CHF budget: incomplete, because one or more expenses have not been converted.

Exact rules are defined in DATA_MODEL.md.

---

### 3.8 Accommodation

Users can add accommodation.

Accommodation contains:

- name
- type
- check-in date (and optional time)
- check-out date (and optional time)
- address
- latitude
- longitude
- price (informational)
- currency
- booking reference
- booking URL
- notes

An accommodation may reference a place. In that case the place is authoritative for address and coordinates.

Accommodation should be visible:

- in the itinerary
- on the map
- in a dedicated accommodation view

---

### 3.9 Bookings

Users can store booking information.

Booking types:

- flight
- train
- accommodation
- activity
- other

Booking contains:

- title
- date/time
- price (informational)
- currency
- booking reference
- URL
- notes

A booking may reference the transport, accommodation or activity it represents.

File attachments can be added later and are not required for the initial implementation.

---

### 3.10 Search and Organization

Users can:

- search within a trip
- filter places
- filter by place type
- show favorites
- show visited places
- show unvisited places
- show planned places
- show unplanned places

---

## 4. PWA

The application must be installable as a Progressive Web App.

It must support:

- web app manifest
- application icons
- standalone display mode
- service worker
- caching of the application shell
- offline navigation fallback, including trip routes for trips created offline
- safe, user-confirmed application updates that never affect local data
- offline application startup

After the user has opened the application at least once, the application should be able to start without internet access.

The application should be usable when installed through:

Safari → Share → Add to Home Screen

on iPhone.

---

## 5. Local Data

Travel data must be stored locally using IndexedDB.

Local data is the primary source of truth.

The application must NOT require:

- login
- cloud connection
- active internet connection

for normal travel planning functionality.

### Storage durability

Browser/PWA storage can be removed by the operating system or browser, especially on iOS.

- The application requests persistent storage where supported.
- The UI makes clear that local storage is not guaranteed to be permanent.
- JSON export is the durable, user-controlled backup mechanism. Settings shows when the last export happened.

---

## 6. JSON Import / Export

The complete application data must be exportable as JSON.

Users must be able to:

- export all data (including cover images)
- download/save the JSON backup
- import a JSON backup
- validate the backup completely before importing
- restore data from the backup

Restore semantics:

- Restore is Replace: all current local data is replaced by the backup contents.
- The backup is validated completely before any existing data is modified.
- The user confirms the restore after seeing a summary.
- A safety backup of the current data is created automatically before replacing it.
- If restore fails, existing data remains unchanged.
- There is no merge and no automatic conflict resolution.

Every backup contains a format version. The exact format is defined in DATA_MODEL.md.

Trip-only export is a possible future feature once a safe format is defined.

---

## 7. Cloud Backup (Dropbox)

Cloud functionality is optional and off by default. The provider is Dropbox (client-side
OAuth with PKCE, no custom backend), behind the CloudBackupProvider abstraction.

Settings contains a switch "Automatic backup to Dropbox" (turning it on connects Dropbox).

After authentication users can:

- create a backup
- see the last backup time
- restore a backup
- disconnect the cloud account
- back up automatically after changes (after edits pause, at most every 2 minutes, and when
  the app is left); the 5 newest versions plus one per day for 14 days are kept
- when another device backed up newer data, load it after confirmation (Replace)

Cloud storage stores the same JSON backup format as local export.

Cloud restore uses the same Replace semantics as local import and requires explicit confirmation.

Local IndexedDB remains the primary data source. Cloud must never be required for normal use.

Do NOT implement complicated real-time synchronization for V1.

---

## 8. Deployment

The application must be deployable on Vercel.

Production deployments must use HTTPS.

The deployed application must remain compatible with PWA installation.

V1 requires no custom backend and no server-side secrets.

---

## 9. Explicitly Out of Scope for V1

Do NOT initially implement:

- social network functionality
- collaboration
- public profiles
- comments
- real-time multi-device synchronization
- AI itinerary generation
- automatic booking import
- email parsing
- automatic exchange-rate fetching
- merging backups / automatic conflict resolution
- trip-only export/import
- cloud backup provider (planned for a later release)
- custom backend
- full offline map tile downloads
- complex route optimization
- Android/iOS native applications
- payment functionality

These can be considered later.