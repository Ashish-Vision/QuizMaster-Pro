# Backend review

Review date: 2026-08-06. Scope: Express composition, routes, controllers, services, middleware, Mongoose schemas/indexes, database utilities, and integration tests.

## Assessment

Authentication reloads the current user for every protected request, validates pinned JWT claims and token version, clears invalid cookies, and rejects disabled accounts. Administrator routers consistently apply authentication before role authorization. User-owned Score and Notification mutations scope database queries to the authenticated user.

Quiz start selects active or legacy-active questions, stores the exact set in an opaque expiring `QuizSession`, and omits correct answers. Submission validates ownership/state/expiry and the exact answer set, derives category/mode/daily identity from the session, and atomically claims the attempt. One MongoDB transaction creates the score, increments counters/XP, records daily completion, writes idempotent achievements/notifications, and finalizes the result reference. Failures abort without partial authoritative state.

## Validation and errors

- Request middleware rejects Mongo operator/dotted/prototype keys and bounds common query values.
- Feature controllers validate scalar types, IDs, enums, lengths, sorting, filters, and ranges.
- Mongoose validation errors return useful `400` responses, duplicates map to controlled conflicts, and unexpected errors expose no stack.
- Passwords, recovery hashes, verification hashes, and token versions are hidden or omitted from responses.
- Notification paths and CSV cells use focused shared validators.
- Uploads enforce one file, byte limits, allowlisted MIME, matching magic bytes, structural completeness, dimensions, and pixel caps.

## Data and query behavior

- Schemas use timestamps, defaults, validation, hidden fields, and targeted indexes.
- Session/result and daily-session uniqueness enforce replay boundaries.
- Leaderboard reads only the top ten and calculates current rank with a count query.
- List endpoints have bounded pagination, deterministic sorting, and projections/`lean()` where appropriate.
- Historical result population intentionally does not filter currently inactive questions.
- Database seed/reset commands are explicit and never run during startup.

## Test evidence

Replica-set tests cover valid completion, duplicate/concurrent requests, ownership, state/expiry, altered answers, daily uniqueness, disabled-after-issuance behavior, and injected rollback failures. Other integration suites cover authentication, recovery, authorization, achievements, leaderboard, analytics, notifications, settings, admin question/category CRUD, and CSV reports.

## Remaining limitations

- Large report exports are memory-buffered.
- Offset pagination is bounded but not cursor-based.
- Daily completions remain embedded for portfolio-scale use.
- Email and Cloudinary integration boundaries are mocked in automated tests.
- Several large administrator/profile controllers have lower direct coverage even though page hydration and route policy are covered.
