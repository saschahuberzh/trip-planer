# Screens

The UI must be designed mobile-first.

The primary target is an iPhone-sized screen.

Desktop layouts can use additional available space.

Routes are defined in TECH_STACK.md.

---

# 0. Global Navigation

Always reachable (bottom bar with icons on phones, sidebar with icons and labels on large screens):

- Trips (`/`)
- Countries (`/countries`)
- Settings (`/settings`)

Inside a trip, the trip header and section navigation are shown in addition (see Trip Header).

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

- open (tap the card): opens the trip's Plan
- edit, delete (actions menu on the card)

After creating a trip, its Plan opens.

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

# 3. Trip Header

There is no separate trip overview screen: a trip opens with its Plan, and `/trips/<id>`
redirects there (old links keep working, also offline).

Shown on every trip screen:

- trip name, countries, dates
- edit trip button (opens Create / Edit Trip)
- section navigation: Plan, Map, Places, Budget, Bookings (Bookings covers Accommodation
  and Other bookings; all five fit a 390 px phone screen)
  (scrollable tab bar on phones; all sections visible on large screens)

Back to the trips list is in the global navigation. Deleting a trip is in the trips list
(confirmation lists what will be deleted). Trip notes are shown at the top of the Plan.
Trip-only export is not part of V1. Full export is available in Settings.

---

# 4. Plan / Itinerary

Chronological itinerary. A switch at the top shows it as **Calendar** (default) or **Days**
(kept in the URL as `?view=calendar&month=YYYY-MM` or `?view=days`). The Day View's
"All days" link opens Days.

Days view (agenda):

- per day a slim header with a date tile (weekday, day of month), day number, title or
  places, and "+" (Activity / Place / Transport inline); it sticks to the top while
  scrolling through that day; tapping it opens the Day View
- day notes are not shown in the list (they are in the Day View)
- below it, in the order of the day: check-outs (stays ending that day), the entries along
  the timeline, and the night's accommodation (where you sleep: check-in or night x of y)
- the Day View shows the day's accommodation in its own card (see Day View)
- reordering happens in the Day View; Unplanned keeps "+ Add" and "Reorder"

Calendar view:

- one month at a time (Monday–Sunday weeks); previous/next buttons move between the
  months of the trip only; it opens on today's month during the trip, else the first month
- every day has a box of the same size, and every month shows six week rows, so the
  calendar keeps its size when switching months; days outside the trip are greyed out
  (like disabled) and not tappable
- each trip day shows its places of the day (travel days: both); one colour per place,
  so consecutive days at the same place read as a block
- a dot right of the day number shows the night's accommodation: violet if an
  accommodation covers that night (check-in ≤ date < check-out), grey if not (e.g. the
  last day); violet is reserved for accommodation and not used as a place colour
- tapping a day opens the Day View
- "Where you are" list (collapsed by default, header shows the number of places): place, days and nights (the night counts for the day's last place,
  not on the trip's last day)
- empty state: hint to add places of the day
- days outside the trip dates are not in the calendar; a note points to Days

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

Each day shows its places of the day (e.g. "Tashkent → Samarkand"; used as heading when the day
has no title) and one timeline of activities and transport in user-defined order.
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

Timeline entries:

- Activity: time (or "No time"), title, place, notes.
- Transport: type symbol, "Origin → Destination", local departure–arrival times
  (arrival on a later date marked "+1 day"), duration; tapping opens the transport form.

---

# 5. Day View

Displays (in this order on phones):

- page heading (not a card): day number, date; a notes icon to add notes (only while the
  day has none); places of the day as chips (tap opens the place; a dashed "+ Place" chip
  adds one; the pencil switches to editing, where each chip has × and neighbours can be
  swapped with ⇄; "Done" ends it)
- timeline card (no title): activities and transport along a vertical line (filled dot =
  timed), user-defined order; "+ Add" (Activity / Place / Transport inline) and "Reorder"
  at the bottom
- accommodation card ("Accommodation", "+ Add" on the right): in the order of the day,
  check-outs, then the night's stay (check-in or night x of y); "No accommodation for the
  night." when no stay covers the night
- map preview (no title): the whole preview opens the map ("Open map" label)
- notes card ("Notes", "Edit" on the right), only when the day has notes

Card pattern: a title only where the content needs one; actions sit in the title row on the
right (or below the list for the timeline); dividers only between list items.

Day titles are not offered for new days (the places of the day say where you are); an
existing title is still shown and stays editable in the notes editor so it can be cleared.

Large screens: heading and timeline on the left; accommodation, map preview and notes on the right.

Actions:

- add activity
- visit a place
- add transport
- reorder
- edit

"Visit a place": select an existing place or create a new one; this creates an activity
linked to that place and this day. (Distinct from "places of the day", which say where the
traveller is.)

Activity form (create/edit):

- title, start/end time (optional), day or Unplanned, notes
- place (optional): select an existing place of the trip, create a new one (see Create / Edit Place),
  or remove the link; when a place is selected and the title is empty, the title becomes the place name
- activities with a place show the place name/type in the timeline

---

# 5a. Create / Edit Transport

Sheet opened from "Add transport" (Plan, Day View) or by tapping a transport entry.

Fields:

- type (flight, train, bus, car, taxi, ferry, walking, other)
- origin and destination: select/create a Place (as in the activity form) or enter text
- departure and arrival: date, time and time zone each (optional); the time zone defaults to the
  last one used in this trip, else the device's time zone; times are shown exactly as entered
- duration: calculated from departure and arrival (time-zone aware) and shown read-only;
  an explicit duration can be entered when exact times are unknown
- day (defaults to the day of the departure date, else the day it was added from) or Unplanned
- price and currency (informational, not counted in the budget), booking reference, notes

Delete with confirmation (bookings/expenses linking to it are unlinked).

After saving a transport with origin and destination places on a day without places of the day:
"Set places of the day to Tashkent → Samarkand?" (Yes / No).

---

# 6. Map

Full-screen or near-full-screen map.

Views:

- **Route**: the places of the day of all days in chronological order, connected with straight
  lines. Markers and the stop list are labelled with the days spent there (e.g. "1–3, 7"),
  not with stop numbers, for an overview of the days. Consecutive days at the same place are
  merged into one stop (e.g. "Day 1–2 · Tashkent"). Days without places of the day are skipped.
  A segment between two consecutive stops that a transport connects (origin → destination,
  on a day within the segment's days) shows that transport's symbol at its midpoint.
- **Day**: one selected day — its timeline in order (activity places; for transports their origin
  and destination), preceded by the places of the day that come before the first place the
  timeline already contains (e.g. "Samarkand", then the day's sights). Without timeline places,
  the places of the day alone. Numbered, without connecting lines; a transport's symbol is
  shown between its origin and destination. The Day View's map preview looks the same.

Connections (transport):

- Symbol by type: flight ✈, train 🚆, bus 🚌, car/taxi 🚗, ferry ⛴, walking 🚶, other ➜.
- Line style: flights dotted, all other connections solid, segments without a transport dashed.
- Tapping a symbol opens the transport's details (type, origin → destination, local times,
  duration, booking reference) with a link to edit it.
- **All places**: every place with coordinates, coloured by category and showing its category
  symbol (no day labels on the markers; the list below names the days); unplanned places in a
  neutral style. Filter by day and category.

Accommodation on the map:

- Accommodations with a position (their linked place, else their own coordinates) are shown
  as 🛏️ markers, not numbered and not part of the lines.
- Route: none — it shows only the route (stops with their days and the connections).
  Day: those of that date (check-out, night, check-in).
  All places: all, or those of the selected day; the category filter treats them as hotels.
- A place used as an accommodation's location is shown once, as the accommodation
  (in the Day view a stop at that place is shown as the stop).
- Tapping opens the accommodation's details (dates, nights, location) with a link to it.

Controls:

- view switch (Route / Day / All places), day selector
- place category filter
- fit entire trip

Markers:

- selectable
- distinguish place categories
- show relevant details

Major trip stops can display route order numbers.

Selecting a marker opens a place detail panel.

Places without coordinates are listed as "not on map" with an action to set the position
by tapping the map (same map picker as in Create / Edit Place).

Lines are straight (no road/rail routing). Places without coordinates are skipped in
numbering and lines and listed as "not on map".

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

Actions:

- add place (opens Create / Edit Place)

Empty state explains that places are the list of places to visit and can later be added to days.

---

# 7a. Create / Edit Place

Sheet used from Places, Place Detail, the activity form, "Visit a place" and places of the day in the Day View.

Search (online):

- search field with suggestions while typing (name, type, address)
- choosing a result fills name, type, address and coordinates; all fields remain editable
- a result can be used as a starting point: e.g. search the street or a nearby landmark,
  then change the name/type and adjust the position (hint shown when nothing is found)
- provider attribution is shown with the results
- offline or on error: short message ("Search needs an internet connection"), manual entry stays available
- no result: "Add manually" keeps the typed text as the name

Fields:

- name, type, address
- coordinates (optional): set from a search result, a pasted map link, entered manually,
  or "Set on map" (Phase 6); can be removed
- "Set on map" opens a map picker: tap or drag the pin, confirm or cancel; starts at the current
  coordinates, otherwise at the trip's other places; needs map tiles (online) — when the map
  can't load, the picker says so and the other options remain available
- website, notes, favorite, visited

Existing places of the trip with the same name are suggested to avoid duplicates.

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
- assign to day (creates an activity linked to this place on the chosen day)
- shows the days on which it is a place of the day
- open map
- delete

Also shows the activities (days) that use this place.

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

# 10. Bookings tab: Accommodation

Accommodation and other bookings share the **Bookings** tab. A switch at the top shows
**Accommodation** (opened first, `/trips/<id>/accommodation`) or **Other bookings**
(`/trips/<id>/bookings`); both URLs stay valid, and switching does not add history entries.

Displays all accommodation chronologically, with how many nights of the trip have no accommodation.
Accommodation is also shown on the days of the stay (check-in / night x of y / check-out)
and on the map (see "Map").

Each entry:

- name
- check-in
- check-out
- address (from linked place if set)
- price (informational)
- booking reference

---

Accommodation form: when the dates share a night with another stay of the trip, a warning
names it ("Overlaps with … (night of …)"); saving is still allowed (e.g. a second room).
A check-out on another stay's check-in day is no overlap. The Day View header offers
"Add accommodation" only when no stay covers that night.

---

# 11. Bookings tab: Other bookings

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

# 11a. Countries

World overview of visited countries (global, not part of a trip).

- world map with country outlines; visited countries are filled
- the map is bundled with the app (no tiles), so it also works offline
- tap a country on the map → panel with its name and "Mark as visited" / "Remove"
- count of visited countries
- search field and list of all countries with checkboxes (needed for small countries
  and as the accessible alternative to the map); visited countries listed first
- empty state: hint to tap a country or search the list
- large screens: map on the left, list on the right

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