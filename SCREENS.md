# Screens

The UI must be designed mobile-first.

The primary target is an iPhone-sized screen.

Desktop layouts can use additional available space.

Routes are defined in TECH_STACK.md.

---

# 0. Global Navigation

Always reachable (e.g. bottom bar on mobile, sidebar on desktop):

- Trips (`/`)
- Settings (`/settings`)

Inside a trip, the trip section navigation is shown in addition (see Trip Overview).

Global UI elements:

- "Update available" prompt when a new app version is waiting (reload on confirmation)
- non-blocking offline indicator

---

# 1. Trips Screen

Default/home screen.

Displays:

- upcoming trips
- active trip
- completed trips
- create trip button

Trip card:

- cover image
- name
- countries
- dates
- duration
- status

Actions:

- open
- edit
- delete

---

# 2. Create / Edit Trip

Fields:

- name
- countries
- start date
- end date
- status
- base currency (reporting/budget currency; does not limit currencies used in the trip)
- budget amount (optional)
- cover image
- notes

Changing trip dates must not silently delete existing itinerary data.

Changing the base currency shows how many expense conversions will be cleared and requires confirmation.

If a date change leaves days with user data outside the new range, the user is told
before saving that these days will be kept and shown as "outside trip dates".

---

# 3. Trip Overview

Header:

- trip name
- countries
- dates

Navigation:

- Plan
- Map
- Places
- Budget
- Accommodation
- Bookings

On mobile, six sections may require a scrollable tab bar or a "More" entry; keep all reachable in one tap from the overview.

Actions:

- edit trip
- delete trip (confirmation lists what will be deleted)

Trip-only export is not part of V1. Full export is available in Settings.

---

# 4. Plan / Itinerary

Chronological itinerary.

Example:

Day 1
3 June
Tashkent

09:00 Activity
11:30 Activity

Train
Tashkent → Samarkand

Day 2
4 June
Samarkand

...

Each day shows one timeline of activities and transport in user-defined order.
Accommodation for that night is shown on the day but is not part of the reorderable timeline.

Users can:

- add activity
- add transport
- reorder entries
- move entries between days and Unplanned
- sort a day by time (explicit action)
- open day details

An "Unplanned" section appears separately.

If days with user data fall outside the trip dates, an "Outside trip dates" section appears with actions:

- move items to another day or Unplanned
- adjust trip dates
- delete the day and its items (explicit confirmation)

---

# 5. Day View

Displays:

- date
- optional title
- map preview
- timeline of activities and transport (user-defined order)
- accommodation for the night
- notes

Actions:

- add activity
- add place
- add transport
- reorder
- edit

"Add place": select an existing place or create a new one; this creates an activity
linked to that place and this day.

---

# 6. Map

Full-screen or near-full-screen map.

Controls:

- entire trip / selected day
- place category filter
- fit entire trip

Markers:

- selectable
- distinguish place categories
- show relevant details

Major trip stops can display route order numbers.

Selecting a marker opens a place detail panel.

---

# 7. Places

Searchable list.

Filters:

- all
- favorites
- visited
- unvisited
- category
- planned
- unplanned

Each place shows:

- name
- category
- location
- favorite state
- visited state

---

# 8. Place Detail

Displays:

- name
- category
- address
- map location
- website
- notes
- favorite
- visited

Actions:

- edit
- assign to day
- open map
- delete

---

# 9. Budget

Header (in trip base currency):

Budget
Spent (converted)
Planned (converted)
Remaining
Unconverted: per-currency totals (e.g. "KGS 1,200")

If any relevant expense is unconverted, base-currency totals and Remaining are marked
"incomplete" with a short explanation (e.g. "1 expense not converted").
Remaining may show a provisional value, but never as a final number while incomplete.

Example:

Budget: CHF 3,000
Converted spending: CHF 335
Unconverted: KGS 1,200
Remaining CHF budget: incomplete — 1 expense not converted

Expense list items show the original amount and currency, plus the converted
amount when available, or a "not converted" marker.

Category summary and costs per day follow the same rules.

Sections:

- category summary
- expenses
- costs per day

Actions:

- add expense (any currency; optional manual exchange rate; optionally linked to a transport, accommodation, booking or activity)
- edit expense
- delete expense

Prices on transport, accommodation and bookings are not counted here.
A "create expense" shortcut from those entities may prefill an expense.

---

# 10. Accommodation

Displays all accommodation chronologically.

Each entry:

- name
- check-in
- check-out
- address (from linked place if set)
- price (informational)
- booking reference

---

# 11. Bookings

Sections:

- upcoming
- past

Booking card:

- type
- title
- date/time (local time at location)
- booking reference
- price (informational)
- linked transport/accommodation/activity, if any

---

# 12. Settings

Sections:

## Data

- Export JSON (complete data, including images)
- Last export date
- Import JSON (Replace):
  1. choose file
  2. validation result and summary of contents
  3. warning that all current data will be replaced
  4. confirm → automatic safety backup → restore
- Safety backups: list of recent safety backups with export option

## Storage

- persistent storage status (granted / not granted / unsupported)
- explanation that browser/PWA storage can be removed by the OS or browser
- recommendation to export JSON regularly

## Cloud Backup (future, not in V1)

Not shown until a cloud provider is implemented.

When disconnected:

[ Connect Cloud ]

When connected:

Account

Last backup:
03 October 2026 21:00

[ Backup Now ]

[ Restore Backup ]

[ Disconnect ]

## Application

- app version
- database version