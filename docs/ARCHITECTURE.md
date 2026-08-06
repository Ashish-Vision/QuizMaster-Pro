# Architecture

QuizMaster Pro is a server-rendered full-stack application. Express owns page delivery and JSON APIs, EJS owns document structure, page-specific browser modules own interaction, and MongoDB/Mongoose own persistence.

## Request flow

```text
Browser
  ├─ GET page ───────────────> Express page route ──> EJS view + static assets
  └─ /api request ───────────> security middleware
                                 ├─ authentication / administrator policy
                                 ├─ route
                                 ├─ controller (HTTP contract)
                                 ├─ service (domain workflow)
                                 └─ Mongoose model ──> MongoDB
```

`server/app.js` composes middleware and mounts routes. Repeated page registrations are declared as public, authenticated-user, and administrator page maps so their authorization policy remains visible in one place.

## Backend

- `server/routes/` defines method/path contracts and attaches authentication or administrator middleware.
- `server/controllers/` validates feature-specific input, coordinates queries/services, and returns HTTP responses.
- `server/services/` owns reusable domain workflows: quiz selection, daily challenges, achievements, notifications, email, activity logs, rankings, and platform settings.
- `server/models/` contains Mongoose schemas, validation, indexes, defaults, hidden sensitive fields, and document methods.
- `server/middleware/` contains authentication, authorization, request security, rate limiting, uploads, and error translation.
- `server/utils/` contains small side-effect-free helpers for JWTs, cookies, normalization, pagination, MongoDB search escaping, CSV encoding, notification paths, and environment validation.
- `server/config/` owns database, Cloudinary, and environment configuration.
- `server/database/` contains explicit question seed/reset commands; application startup never deletes data.

Controllers keep complex workflows delegated where a stable service boundary exists. Quiz completion remains deliberately coordinated in `quizController` because its transaction boundary spans QuizSession, Score, User, daily completion, achievements, and notifications; extracting it should be a dedicated future change with transaction tests, not a mechanical file split.

## Data model

- `User`: identity, authorization role/status, token version, progress counters, and hidden credential/recovery fields.
- `Question`: categorized quiz content; missing `isActive` is treated as active for legacy compatibility.
- `QuizSession`: immutable server-issued question set and authoritative standard/daily attempt lifecycle.
- `Score`: user-owned historical result with a unique QuizSession reference.
- `DailyChallenge`: daily question set and completion records.
- `Achievement`, `Notification`, `ActivityLog`, and `PlatformSetting`: supporting application/admin state.

Quiz completion requires replica-set transaction support. The transaction claims the session, creates the score, updates counters/rewards, records daily completion, writes achievements/notifications, and finalizes the session. Unique session/result indexes provide an additional replay boundary.

## Frontend

- `client/views/` contains semantic EJS documents and the existing navbar/footer partials.
- `client/js/` contains page-specific vanilla JavaScript. `shared.js` is the dependency-free browser utility boundary for safe text escaping, dates, numbers, initials, and visibility state; pages migrate to it incrementally.
- `client/css/` contains design tokens, public/auth foundations, feature styles, administrator styles, animations, and responsive rules.

The frontend intentionally has no build step or framework dependency. Every page can be inspected directly through its EJS, JavaScript, and stylesheet. Dynamic data should use DOM creation/`textContent` where practical; HTML templates must escape dynamic values.

## Authentication and authorization

JWT cookies contain `userId` and `tokenVersion`. Tokens pin algorithm, issuer, audience, and expiry. Authentication reloads the current User for every protected request, compares tokenVersion, and rejects disabled accounts. Password changes/resets and administrator role/status changes revoke prior sessions.

Administrator page and API routes always apply authentication before `adminOnly`. User-owned Score and Notification queries include the authenticated user in the database filter to avoid cross-account disclosure.

## Tests

- `tests/`: Jest unit, route-contract, security, and MongoDB integration suites.
- `e2e/`: Playwright desktop/mobile rendered-page and hydration audits.
- Transaction tests use an isolated MongoDB replica set.
- Authentication and ownership tests use an isolated temporary MongoDB database.

Generated coverage, Playwright reports, and test results are ignored and are not repository source.

## Local integrations

Email delivery and Cloudinary avatar storage are isolated behind their service/config boundaries and mocked during automated tests. Rate limits use the process-local in-memory store, which is appropriate for this locally runnable portfolio project.
