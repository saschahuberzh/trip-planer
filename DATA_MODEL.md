# Data Model

All entities use UUID strings as IDs.

Do not use array positions as persistent identifiers.

---

# Conventions

## Date and Time Formats

| Kind | Format | Example | Used for |
|---|---|---|---|
| Calendar date | `YYYY-MM-DD` | `2026-06-12` | trip start/end, TripDay, check-in/out date, expense date |
| Wall-clock time | `HH:mm` (24h) | `09:30` | activity start/end, check-in/out time |
| Local event date/time | `LocalDateTime` (see below) | | transport departure/arrival, booking date/time |
| Instant (metadata) | ISO 8601 UTC | `2026-10-03T19:00:00.000Z` | `createdAt`, `updatedAt`, `exportedAt` |

Calendar dates, wall-clock times and local event date/times are NOT instants.

Never parse them with `new Date(...)` and never reinterpret them in the device timezone.
A flight departing 08:00 in Tashkent must display 08:00 regardless of where the device is.

```ts
// A date/time as experienced at a specific location.
LocalDateTime {
  local: string      // "YYYY-MM-DDTHH:mm", no offset, no "Z"
  timeZone: string   // IANA timezone, e.g. "Asia/Tashkent"
}
```

Activity times are wall-clock times on the date of their TripDay at the activity's location.
They are displayed as entered and are never converted.

Use one shared date/time utility module for parsing, validation, formatting and duration calculation.

## Money

- Amounts are stored as numbers in major units (e.g. `12.5` = 12.50).
- Currencies are ISO 4217 codes (`"CHF"`, `"EUR"`, `"UZS"`, `"KZT"`, `"KGS"`, `"JPY"`, `"USD"`), uppercase, validated against the ISO 4217 list.
- A trip may use any number of currencies. `Trip.baseCurrency` does not restrict which currencies can be used.
- Stored converted amounts (`amountInBaseCurrency`) are rounded to the base currency's minor-unit precision when calculated.
- Other values are rounded only for display, using the currency's precision.

## Metadata

Every persistent domain entity has:

```ts
createdAt: string  // ISO 8601 UTC instant
updatedAt: string  // ISO 8601 UTC instant, updated on every change
```

Repositories set these fields. UI code does not.

---

# Entities

## Trip

```ts
Trip {
  id: string
  name: string
  countries: string[]          // any number of countries

  startDate: string            // YYYY-MM-DD
  endDate: string              // YYYY-MM-DD, >= startDate

  status: "planned" | "active" | "completed"   // stored explicitly, never derived

  baseCurrency: string         // ISO 4217; reporting/budget currency only
  budgetAmount?: number        // in baseCurrency

  coverImageId?: string        // references ImageAsset

  notes?: string
  createdAt: string
  updatedAt: string
}
```

---

## TripDay

```ts
TripDay {
  id: string
  tripId: string
  date: string                 // YYYY-MM-DD, unique per trip
  title?: string
  notes?: string
  createdAt: string
  updatedAt: string
}
```

TripDays are persisted records.

Rules:

- Exactly one TripDay per `(tripId, date)`.
- Creating a trip creates one TripDay per date in the range.
- Changing trip dates creates missing TripDays for the new range.
- A TripDay "contains user data" if it has a title, notes, or any Activity or Transport referencing it.
- After a date change, TripDays outside the new range:
  - without user data are deleted automatically
  - with user data are preserved and shown as "outside trip dates" for manual resolution
    (move items to another day / Unplanned, adjust trip dates, or explicitly delete with confirmation)
- "Outside trip dates" is derived (`date < startDate || date > endDate`), not stored.

---

## Place

```ts
Place {
  id: string
  tripId: string

  name: string

  type:
    | "city"
    | "attraction"
    | "restaurant"
    | "hotel"
    | "airport"
    | "train_station"
    | "custom"

  address?: string
  latitude?: number
  longitude?: number

  website?: string
  notes?: string

  favorite: boolean
  visited: boolean

  externalRef?: {              // where the place was found; informational only
    provider: string           // e.g. "photon"
    id: string                 // provider's ID for the place, e.g. "N123456" (OSM node)
  }

  createdAt: string
  updatedAt: string
}
```

Provider independence:

- A Place is always a complete record in our own model. Name, type, address and coordinates are
  copied from the search result when the user saves it and can then be edited freely.
- `externalRef` is optional and informational. The app never needs the provider to display,
  edit, back up or restore a place, and never re-fetches or overwrites place data automatically.
- `latitude`/`longitude` are WGS 84 decimal degrees and are set together or not at all.
- Places without coordinates are valid; they are listed normally and not shown on the map.

A place is **planned** when at least one Activity with a `tripDayId` references it.
Otherwise it is **unplanned**. This is derived, not stored.

---

## Itinerary Ordering

Activities and Transports share one ordering model so they appear in a single timeline.

Both entities carry:

```ts
tripDayId?: string     // undefined = Unplanned
sortOrder: number      // position within its bucket
```

A **bucket** is either one TripDay or the trip's Unplanned section.

Rules:

- The timeline of a bucket = all Activities and Transports in that bucket, sorted by `sortOrder`, ties broken by `id`.
- `sortOrder` values share one ordering space across both entity types within a bucket.
- `sortOrder` is authoritative. Times are displayed but do not automatically reorder entries.
  An explicit "sort by time" action may rewrite `sortOrder`.
- New entries are appended (`max(sortOrder) + 1` in the bucket).
- Reordering or moving entries rewrites `sortOrder` for the affected bucket(s) as consecutive integers in a single transaction.
- Ordering logic lives in one itinerary service, not in UI components or in entity-specific repositories.

Accommodation is not part of the ordered timeline.
It is displayed on each TripDay whose date is within `[checkInDate, checkOutDate]`.

---

## Activity

```ts
Activity {
  id: string
  tripId: string
  tripDayId?: string
  placeId?: string

  title: string

  startTime?: string   // HH:mm
  endTime?: string     // HH:mm

  notes?: string

  sortOrder: number

  createdAt: string
  updatedAt: string
}
```

An Activity may reference one Place (`placeId`); a Place may be referenced by any number of Activities.

- The activity form lets the user select an existing place of the trip, create a new place
  (search or manual), or remove the link. Existing activities can be linked later.
- When a place is selected and the title is empty, the title defaults to the place name.
  The title is stored on the Activity and is not updated when the place is renamed.
- Deleting an Activity never deletes its Place.

"Add Place" from a Day View is a shortcut: it opens place selection/creation directly and creates
an Activity with `placeId` and `tripDayId` set (title = place name), appended to the day.
"Assign to day" on a Place does the same for a chosen day.

---

## Transport

```ts
Transport {
  id: string
  tripId: string
  tripDayId?: string     // normally the departure day

  type:
    | "flight"
    | "train"
    | "bus"
    | "car"
    | "taxi"
    | "ferry"
    | "walking"
    | "other"

  originPlaceId?: string
  destinationPlaceId?: string

  originText?: string        // used when no Place is referenced
  destinationText?: string

  departure?: LocalDateTime
  arrival?: LocalDateTime

  durationMinutes?: number   // explicit override, see below

  price?: number             // informational only, not counted in budget
  currency?: string

  bookingReference?: string
  notes?: string

  sortOrder: number

  createdAt: string
  updatedAt: string
}
```

Duration:

- If both `departure` and `arrival` exist, the displayed duration is calculated from them (timezone-aware).
- `durationMinutes` is stored only when the user explicitly enters it (e.g. no exact times known).
  An explicit value takes precedence for display.

---

## Accommodation

```ts
Accommodation {
  id: string
  tripId: string
  placeId?: string

  name: string
  type?: string

  checkInDate: string        // YYYY-MM-DD
  checkOutDate: string       // YYYY-MM-DD, >= checkInDate
  checkInTime?: string       // HH:mm, local
  checkOutTime?: string      // HH:mm, local

  // Location fields: only used when placeId is undefined.
  address?: string
  latitude?: number
  longitude?: number

  price?: number             // informational only, not counted in budget
  currency?: string

  bookingReference?: string
  bookingUrl?: string

  notes?: string

  createdAt: string
  updatedAt: string
}
```

Location authority:

- If `placeId` is set, the referenced Place is authoritative for address and coordinates,
  and the Accommodation's own `address`, `latitude`, `longitude` must be undefined.
- If `placeId` is undefined, the Accommodation's own location fields are used.
- `name` always belongs to the Accommodation.

---

## Booking

```ts
Booking {
  id: string
  tripId: string

  type:
    | "flight"
    | "train"
    | "accommodation"
    | "activity"
    | "other"

  title: string

  dateTime?: LocalDateTime

  price?: number             // informational only, not counted in budget
  currency?: string

  bookingReference?: string
  url?: string

  notes?: string

  linkedEntity?: {
    type: "transport" | "accommodation" | "activity"
    id: string
  }

  createdAt: string
  updatedAt: string
}
```

---

## Expense

Expense is the only source of truth for budget calculations.

```ts
Expense {
  id: string
  tripId: string

  title: string

  category:
    | "accommodation"
    | "transport"
    | "food"
    | "activities"
    | "shopping"
    | "other"

  status: "planned" | "paid"   // planned = expected cost, paid = actually spent

  date?: string                // YYYY-MM-DD, used for costs per day

  originalAmount: number       // > 0, as entered
  originalCurrency: string     // ISO 4217, any currency, always preserved

  exchangeRateToBase?: number      // 1 unit of originalCurrency = N units of trip.baseCurrency
  amountInBaseCurrency?: number    // stored value used for budget reporting

  notes?: string

  linkedEntity?: {
    type: "transport" | "accommodation" | "booking" | "activity"
    id: string
  }

  createdAt: string
  updatedAt: string
}
```

### Currency Conversion

An Expense is **converted** when both `exchangeRateToBase` and `amountInBaseCurrency` are set,
otherwise **unconverted**. Both fields are set together or not at all.

- `originalAmount` and `originalCurrency` are always preserved and displayed.
- If `originalCurrency === trip.baseCurrency`: the expense is always converted with
  `exchangeRateToBase = 1` and `amountInBaseCurrency = originalAmount`.
- Otherwise the exchange rate is entered manually (V1 has no automatic exchange-rate fetching).
  `amountInBaseCurrency = round(originalAmount × exchangeRateToBase)` to base-currency precision,
  calculated when the expense is saved and then stored.
- An unconverted expense is valid. It is stored, listed and displayed normally.

Stability:

- `amountInBaseCurrency` is recalculated only when the user edits that expense's
  `originalAmount`, `originalCurrency` or `exchangeRateToBase`.
- It never changes because of other expenses, later rates, recalculation passes or app updates.
- Changing `Trip.baseCurrency` invalidates conversions (they refer to the old base currency).
  This requires explicit confirmation showing the number of affected expenses. After confirmation:
  expenses in the new base currency get rate 1; all others become unconverted
  (`exchangeRateToBase` and `amountInBaseCurrency` cleared) until the user enters new rates.

### Budget Calculations

Only Expenses are counted. Prices on Transport, Accommodation and Booking are never counted automatically.

For any set of expenses (whole trip, a category, a day):

- **Converted total** = sum of `amountInBaseCurrency` of converted expenses, in `trip.baseCurrency`.
- **Unconverted totals** = sum of `originalAmount` of unconverted expenses, grouped by `originalCurrency`.
  Never added to the base-currency total.
- **Complete** = the set contains no unconverted expenses.
  If not complete, every base-currency total derived from it must be marked as incomplete.

Trip-level figures:

- **Spent** = expenses with `status = "paid"`.
- **Planned** = expenses with `status = "planned"` (expected, not yet paid).
- **Projected total** = Spent + Planned.
- **Remaining budget** = `budgetAmount − converted Spent total`. Only shown when `budgetAmount` is set.
  If any paid expense is unconverted, Remaining is marked incomplete and must not be presented as final.
- **Costs by category** and **costs per day** use the same converted/unconverted/complete rules.
  Expenses without a date are grouped as "undated".

Example (`baseCurrency = CHF`, `budgetAmount = 3000`, all paid):

| Expense | Converted |
|---|---|
| 800000 UZS | 52 CHF |
| 35000 KZT | 63 CHF |
| 1200 KGS | — (no rate) |
| 220 CHF | 220 CHF |

Result: converted spending CHF 335; unconverted KGS 1,200;
remaining CHF budget incomplete (provisional CHF 2,665) because one expense is not converted.

---

## ImageAsset

Image binary data is stored separately from entity records.

```ts
ImageAsset {
  id: string
  mimeType: "image/jpeg" | "image/png" | "image/webp"
  blob: Blob
  width: number
  height: number
  createdAt: string
  updatedAt: string
}
```

Rules:

- Entities reference images by ID (`Trip.coverImageId`). Never store base64 images in entity records.
- Images are downscaled client-side before storage (longest side max 1600 px, re-encoded as JPEG or WebP).
- Removing a cover image or deleting its trip deletes the ImageAsset.

---

## AppMeta (non-domain)

Local key/value store for application state that is not user travel data.

Examples:

- last JSON export timestamp
- storage persistence status
- last safety backup timestamp

AppMeta is NOT included in backups and is not replaced by restore.

---

## SafetyBackup (non-domain)

```ts
SafetyBackup {
  id: string
  createdAt: string
  reason: "before_restore"
  data: BackupData           // complete serialized backup
}
```

Stored in a separate IndexedDB table that restore never touches.
Keep only the most recent 3 safety backups. They can be exported as JSON from Settings.

---

# Backup Format

## BackupData

```ts
BackupData {
  format: "travel-planner-backup"
  version: number              // backup format version, starts at 1
  exportedAt: string           // ISO 8601 UTC instant
  appVersion: string
  databaseVersion: number      // informational

  trips: Trip[]
  tripDays: TripDay[]
  places: Place[]
  activities: Activity[]
  transports: Transport[]
  accommodations: Accommodation[]
  bookings: Booking[]
  expenses: Expense[]
  images: BackupImage[]
}

BackupImage {
  id: string
  mimeType: string
  width: number
  height: number
  dataBase64: string           // image bytes, base64-encoded
  createdAt: string
  updatedAt: string
}
```

The backup format `version` is independent of the IndexedDB schema version.

## Images in Backups

- The complete backup includes all ImageAssets in the separate `images` array as base64.
- Base64 is used only in the backup file, never in IndexedDB entity records.
- On restore, images are decoded back to Blobs in the `images` table.
- A missing or invalid image must not block restoring travel data;
  the referencing `coverImageId` is cleared and the user is informed.

## Validation

A backup is valid only if all of the following hold. Validation must complete before any existing data is modified.

- `format` matches and `version` is supported (older versions are migrated in memory first)
- every record matches its schema (types, enums, date formats, IANA timezones, ISO 4217 codes)
- expense conversion fields are consistent (both set or both absent; rate 1 and equal amounts when `originalCurrency` equals the trip's `baseCurrency`); stored `amountInBaseCurrency` values are restored as-is, never recalculated
- IDs are unique per table
- every reference (`tripId`, `tripDayId`, `placeId`, `linkedEntity`, `coverImageId`, …) resolves within the backup
- TripDay `(tripId, date)` pairs are unique

## Restore

Restore is **Replace**:

1. Validate the backup completely.
2. Show a summary and require explicit confirmation.
3. Create a SafetyBackup of current data.
4. In a single IndexedDB transaction, clear all domain tables and write backup contents.
5. If any step fails, the transaction is aborted and existing data remains unchanged.

No merge, no automatic conflict resolution.
Cloud restore (future) uses the same Replace flow.

---

# Relationships

```
Trip
├── TripDay[]
├── Place[]
├── Activity[]
├── Transport[]
├── Accommodation[]
├── Booking[]
├── Expense[]
└── ImageAsset (cover)

TripDay
├── Activity[]
└── Transport[]

Place
├── Activity[]
├── Transport origin/destination
└── Accommodation

Booking  → Transport | Accommodation | Activity   (optional)
Expense  → Transport | Accommodation | Booking | Activity   (optional)
```

---

# Delete Behavior

Important user data is never silently cascade-deleted. All deletes run in a single transaction
in the repository/service layer.

| Deleted entity | Effect on related data |
|---|---|
| Trip | Deletes all owned entities and its ImageAsset. Requires explicit confirmation showing what will be deleted. |
| TripDay | Not deletable while it contains user data unless the user explicitly chooses to delete its items (confirmation listing them) or moves them first. Empty days are removed automatically only when outside the trip range. |
| Place | Requires confirmation if referenced. References are unlinked: Activity keeps its title; Transport gets `originText`/`destinationText` set to the place name; Accommodation receives the place's address/coordinates in its own fields. |
| Activity | Bookings and Expenses linking to it are unlinked (`linkedEntity` removed), not deleted. |
| Transport | Bookings and Expenses linking to it are unlinked, not deleted. |
| Accommodation | Bookings and Expenses linking to it are unlinked, not deleted. |
| Booking | Expenses linking to it are unlinked, not deleted. |
| Expense | No dependents. |

Never leave dangling references.
