# Claude Development Instructions

Read this file before making changes.

Also read:

- PROJECT.md
- TECH_STACK.md
- DATA_MODEL.md
- SCREENS.md
- IMPLEMENTATION_PLAN.md

These documents define the project requirements.

---

# 1. Development Approach

Work incrementally.

Do NOT attempt to implement the entire application in one change.

When asked to implement a ticket or phase:

1. inspect the existing implementation
2. understand relevant architecture
3. identify affected files
4. implement only the requested scope
5. add/update tests
6. run validation
7. report what changed

Do not implement unrelated future features.

---

# 2. Architecture

Respect the existing architecture.

Preferred flow:

UI
↓
Application/Services
↓
Repositories
↓
IndexedDB

React components must not contain direct IndexedDB queries.

Business logic should not be unnecessarily embedded inside UI components.

Next.js rules:

- App Router, client-first. Do not use `output: "export"`.
- No custom backend in V1: no API routes, Server Actions or server-side storage for user data.
- Server-rendered output must not depend on user data or route parameter values.
- Read route IDs through the shared URL-based hook, not from server-side params.

Domain rules (details in DATA_MODEL.md):

- Activities and Transports share one ordering model; use the itinerary service for ordering.
- Expenses are the only source of truth for budget totals.
- Never reinterpret travel dates/times in the device timezone; use the shared date/time utilities.
- Deletes follow the delete behavior table; unlink rather than cascade-delete important data.
- Images are stored as Blobs in their own table, never as base64 in entity records.

---

# 3. Local-First Requirement

This is a LOCAL-FIRST application.

IndexedDB is the primary source of truth.

Core features must work without:

- internet
- authentication
- cloud services

Never change the architecture so that cloud availability becomes necessary for normal application use.

---

# 4. Offline Requirement

Offline functionality is a core product requirement, not an optional enhancement.

When implementing features, consider whether they continue working offline.

Network failures must not make locally stored travel data inaccessible.

Maps are an exception:

map tiles may require internet access.

Map failure must never break the rest of the application.

Service worker rules:

- The service worker never stores or caches user data.
- Service worker updates must never clear or modify IndexedDB.
- No automatic `skipWaiting`; updates activate after user confirmation.
- Verify PWA/offline behavior with a production build, not `next dev`.

---

# 5. Cloud

Cloud functionality exists primarily for backup/restore.

No cloud provider is chosen. Do not implement or choose one unless explicitly requested.

Do not introduce real-time synchronization unless explicitly requested.

Cloud implementations must use the CloudBackupProvider abstraction.

Do not couple UI components directly to provider-specific APIs.

---

# 6. Data Safety

User travel data is important.

Never:

- silently delete data
- reset IndexedDB to fix migrations
- overwrite data because parsing failed
- import unvalidated backups
- destroy existing data during schema changes

Database migrations must preserve existing data.

Before destructive restore operations, create a safety backup.

Restore is Replace (no merge): validate completely, confirm, create safety backup,
then replace in a single transaction.

---

# 7. TypeScript

Use strict TypeScript.

Avoid:

- any
- unsafe type assertions
- duplicated interfaces
- unnecessary optional values

Prefer shared domain types.

---

# 8. Dependencies

Do not install dependencies without a clear reason.

Before adding a dependency:

1. check whether the project already provides the functionality
2. prefer small/well-maintained dependencies
3. avoid dependencies for trivial functionality

Mention newly added dependencies in the implementation summary.

---

# 9. UI

Design mobile-first.

Primary target:

iPhone-sized PWA.

Requirements:

- touch-friendly controls
- readable typography
- sensible spacing
- clear navigation
- useful empty states
- useful error messages

Do not create desktop-only interactions.

---

# 10. Components

Prefer reusable components where meaningful.

Do not over-engineer abstractions for components used only once.

Keep components reasonably small.

Separate complicated business logic from rendering.

---

# 11. Testing

Important business logic should have automated tests.

Prioritize tests for:

- repositories
- database migrations
- budget calculations
- backup serialization
- backup validation
- restore behavior
- data transformations

Do not write tests that merely duplicate implementation details.

---

# 12. Validation

After implementation, run the project's available validation commands.

At minimum:

- `npm run typecheck`
- `npm run lint`
- `npm test`

For significant changes also run:

- `npm run build`

Use npm only (no yarn/pnpm). Target Node.js 22 LTS.

Fix errors caused by your changes before considering the task complete.

---

# 13. Existing Code

Do not rewrite working code merely because you prefer another implementation.

Avoid large refactors unless:

- required by the ticket
- fixing an architectural problem
- explicitly requested

If a large architectural change appears necessary, explain why before implementing it.

---

# 14. Scope Control

Follow IMPLEMENTATION_PLAN.md.

If asked to implement:

TRIP-001

do not also implement:

TRIP-002
MAP-001
CLOUD-001

unless required technically.

Keep changes reviewable.

---

# 15. Security

Never commit:

- passwords
- API keys
- access tokens
- private credentials

Use environment variables for secrets.

Never expose server secrets to client-side code.

---

# 16. Backup Compatibility

Backup JSON must contain a schema version.

Never change the existing backup format without considering backward compatibility.

When the format changes:

- increment version where necessary
- provide migration logic where practical
- maintain tests for older supported versions

---

# 17. Completion Report

After completing a ticket provide:

## Implemented

Short summary.

## Files Changed

Important files and why they changed.

## Tests

Tests added/changed.

## Validation

Commands executed and results.

## Notes

Known limitations or follow-up work.

Do not claim something was tested if it was not actually tested.

# Context Efficiency

Minimize unnecessary context usage.

When implementing a ticket:

- read CLAUDE.md
- read the relevant section of IMPLEMENTATION_PLAN.md
- inspect only files relevant to the task
- do not repeatedly read the entire repository
- do not read unrelated documentation unless required
- do not explore node_modules, build output or generated files
- keep explanations concise
- do not implement future tickets
- prefer targeted searches over reading large files completely

If enough information is already available in the current context,
do not reread the same files.