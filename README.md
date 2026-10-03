Travel Planner PWA

A personal, offline-first travel planner built as a Progressive Web App.

The goal is to provide the core functionality needed to plan and manage trips without requiring an account or permanent internet connection.

The application is designed primarily for personal use on iPhone, but should also work well in modern desktop browsers.

Core Features

The application will support:

* Trip management
* Day-by-day itineraries
* Places and attractions
* Interactive trip maps
* Transport connections
* Accommodation
* Bookings
* Multi-currency budget and expense tracking
* Search and organization
* Offline usage
* JSON import/export (primary, user-controlled backup)
* Installation as an iPhone PWA

Planned for a later release (not part of V1):

* Optional cloud backup

Core Principles

The project follows these principles:

* Local-first: IndexedDB is the primary source of truth.
* Offline-first: Core functionality must work without internet.
* No account required: The application can be fully used locally.
* Optional cloud (future): Cloud backup is a deferred feature; V1 relies on JSON export/import.
* Mobile-first: The primary target is an installed iPhone PWA.
* Data ownership: All user data can be exported as JSON.
* Simple architecture: Avoid unnecessary backend infrastructure and abstractions.

Technology

The planned stack is:

* Next.js (App Router, client-first, no custom backend)
* React
* TypeScript
* Tailwind CSS
* IndexedDB / Dexie
* MapLibre
* Progressive Web App / Service Worker (Serwist)
* Vercel
* npm, Node.js 22 LTS, Vitest

The exact technical decisions are documented in TECH_STACK.md.

Project Documentation

Before implementing features, read the project documentation:

* PROJECT.md — product requirements and features
* TECH_STACK.md — technical architecture and technology decisions
* DATA_MODEL.md — domain entities and relationships
* SCREENS.md — screens and UX structure
* IMPLEMENTATION_PLAN.md — implementation phases and tickets
* CLAUDE.md — development instructions for AI coding agents

These documents are part of the project specification.

If implementation and documentation disagree, do not silently choose one. Identify the conflict and resolve it before making a significant architectural change.

Development Workflow

Development should happen incrementally according to IMPLEMENTATION_PLAN.md.

Do not attempt to build the complete application in a single change.

A typical workflow is:

1. Select one phase or ticket.
2. Review the relevant specification.
3. Inspect the existing implementation.
4. Implement only the requested scope.
5. Add or update tests.
6. Run type checking.
7. Run linting.
8. Run tests.
9. Run a production build when appropriate.
10. Review the result.
11. Commit the working state.

Each phase should leave the application in a usable state.

Initial Architecture Review

Before implementing Phase 1, perform an architecture review.

Use the following instruction:

Read CLAUDE.md, PROJECT.md, TECH_STACK.md, DATA_MODEL.md, SCREENS.md and IMPLEMENTATION_PLAN.md.

Do not implement anything yet.

Review the specification for contradictions, missing architectural decisions and potential problems.

Pay particular attention to:

* offline-first behavior
* IndexedDB and database migrations
* PWA behavior on iOS/iPhone
* service worker strategy
* map provider and offline map behavior
* backup schema and migrations
* JSON import/export
* cloud authentication
* cloud backup and restore
* data conflict handling
* Vercel deployment
* client/server boundaries in Next.js
* handling of secrets and environment variables

For every issue found, explain:

1. the problem
2. why it matters
3. the recommended solution
4. which specification file should change

Do not modify files yet.

Finish by proposing a concrete list of specification changes.

Review the proposed changes before allowing implementation to begin.

Starting Implementation

Once the architecture review is complete and the specification has been updated, start with Phase 1:

Implement Phase 1 from IMPLEMENTATION_PLAN.md.

Read and follow CLAUDE.md before making changes.

Use the other specification documents as the source of product and architecture requirements.

Implement only Phase 1. Do not implement functionality from later phases unless it is technically necessary for Phase 1.

After implementation:

* run TypeScript type checking
* run linting
* run tests
* run the production build

Fix problems caused by your changes.

Then report:

* what was implemented
* files changed
* dependencies added
* tests added or changed
* validation commands executed
* known limitations
* recommended next ticket

Do not claim a validation step succeeded unless it was actually executed.

Continuing Development

After a phase has been reviewed and committed, continue with the next phase.

Example:

Implement Phase 2 from IMPLEMENTATION_PLAN.md.

Follow CLAUDE.md.

First inspect the current implementation and relevant specification files.

Do not unnecessarily rewrite working Phase 1 code.

Implement only the requested phase.

Run all relevant validation commands when finished and report the results.

For individual tickets:

Implement TRIP-001 from IMPLEMENTATION_PLAN.md.

Follow CLAUDE.md and all relevant specification documents.

Implement only this ticket and functionality technically required by it.

Add appropriate tests and run the relevant validation commands.

Important Offline Requirement

The application must remain usable without an internet connection after it has been loaded and installed.

The following functionality should eventually work offline:

* viewing trips
* creating and editing trips
* itinerary management
* places
* transport
* accommodation
* bookings
* budget
* search
* JSON export

Map tiles may require an internet connection.

Failure to load a map must never prevent access to locally stored travel data.

Data Storage

IndexedDB is the primary source of truth.

Cloud storage must never replace the local-first architecture.

The expected model is:

                  ┌── IndexedDB
                  │   Primary data
User → PWA ───────┤
                  ├── JSON export/import (V1)
                  │   Durable, user-controlled backup
                  │
                  └── Cloud Backup (future, deferred)
                      Optional JSON backup

Browser/PWA storage can be removed by the operating system or browser, especially on iOS.
Regular JSON export is the durable backup.

Backup Philosophy

Users must always retain control of their data.

The application should provide:

* JSON export of the complete data (V1)
* JSON import with full validation and Replace restore (V1)
* versioned backup format
* automatic safety backup before restore
* optional cloud backup (future, deferred; no provider chosen yet)

A cloud account must never be required to access locally stored trips.

Deployment

Production hosting will use Vercel.

The production version must be tested for:

* HTTPS
* successful production build
* manifest availability
* service worker registration
* PWA installation
* iPhone standalone mode
* offline startup
* IndexedDB persistence
* application updates without destroying local data

Scope

The first goal is not to reproduce every Wanderlog feature.

The goal is to build a reliable personal travel planner with excellent offline functionality.

Advanced functionality such as AI planning, automatic booking imports, collaboration, automatic route optimization, real-time synchronization and offline map downloads should only be considered after the core application is stable.
Development

Requires Node.js 22 LTS (`.nvmrc`) and npm.

* `npm install`
* `npm run dev` – development server (service worker disabled)
* `npm run build && npm run start` – production build (webpack, required by Serwist) with service worker
* `npm run typecheck`, `npm run lint`, `npm test`

Offline/PWA verification steps: see `docs/OFFLINE_VERIFICATION.md`.
