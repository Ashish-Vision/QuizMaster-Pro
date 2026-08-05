# QuizMaster Pro — Architecture Review

Review date: 2026-08-05  
Scope: Entire current repository, excluding `node_modules` and generated/runtime data.  
Method: Static review of the Express/Mongoose server, EJS views, browser JavaScript, CSS, scripts, configuration, routes, models, indexes, and cross-layer data flows.

## Executive summary

QuizMaster Pro has a recognizable MVC-style structure, route-level authentication and administrator authorization, explicit Mongoose schemas, safe password hashing, pinned JWT verification, pagination on many administrative APIs, and useful service abstractions for achievements, notifications, daily challenges, email, levels, and settings. Recent security utilities also centralize JWT handling, CSV escaping, and notification-link validation.

The most serious architectural problem remains the quiz completion path. A `QuizSession` model and a unique `Score.quizSession` index now exist, but no runtime code creates or consumes sessions. The submission endpoint still accepts client-selected question IDs and can be replayed to generate unlimited Scores and XP. Completion is also a sequence of independent writes rather than a MongoDB transaction, allowing Scores, user counters, daily completions, achievements, and notifications to diverge.

The review identified **2 Critical, 10 High, 15 Medium, and 4 Low** issues. The recommended implementation order is:

1. Complete the QuizSession integration and transactional completion workflow.
2. Make mutation workflows and administrator bulk operations atomic.
3. Enforce platform settings and add scalable rate limiting/indexes.
4. Consolidate duplicated controllers, APIs, browser utilities, CSS tokens, and page routing.
5. Establish an automated test/lint/format pipeline before further feature growth.

## Findings

### AR-001 — Quiz submission replay permits unlimited Score and XP creation

- **Severity:** Critical
- **File:** `server/controllers/quizController.js`
- **Line:** 225
- **Why it is a problem:** `submitQuiz` accepts category, question IDs, answers, timing, and daily-challenge identity from the client. A user can replay a valid standard submission indefinitely. Although `QuizSession` and `Score.quizSession` now exist, repository-wide references show they are not used outside their schemas. Consequently, there is no server-issued attempt, ownership check, expiry check, or one-time state transition protecting rewards.
- **Recommended fix:** Create a QuizSession when a standard or daily quiz starts. Return an opaque session identifier and safe questions. Accept only `quizSessionId` plus an ordered selected-answer array. Atomically claim an active, unexpired, user-owned session and enforce the existing unique Score/session constraint.
- **Estimated implementation difficulty:** High (4–7 days, including migration and concurrency tests)

### AR-002 — Quiz completion is not atomic

- **Severity:** Critical
- **File:** `server/controllers/quizController.js`
- **Line:** 499
- **Why it is a problem:** Score insertion, daily completion, User counter updates, achievements, and notifications occur as independent writes. Manual Score deletion only compensates for a narrow subset of failures and cannot roll back XP, streaks, achievements, or notifications. Achievement and notification errors are explicitly suppressed at lines 590 and 620, making partial completion an accepted outcome.
- **Recommended fix:** Move grading and reward application into a `quizCompletionService` using `mongoose.startSession()` and `withTransaction()`. Within one transaction claim the QuizSession, create Score, complete the challenge, update User counters/streak, unlock achievements, create deduplicated notifications, and finalize the session. Require replica-set transaction support in every environment.
- **Estimated implementation difficulty:** High (5–8 days)

### AR-003 — Concurrent legitimate submissions can lose User counter updates

- **Severity:** High
- **File:** `server/controllers/quizController.js`
- **Line:** 557
- **Why it is a problem:** The controller loads a User document, mutates numeric fields in memory, and saves it later. Two concurrent completions can read the same values and overwrite one another, while both Scores remain. Streak calculation has the same race.
- **Recommended fix:** Update counters inside the completion transaction. Use transaction write-conflict retries or an atomic update pipeline; calculate streak from the transactionally read current record and commit it with the Score.
- **Estimated implementation difficulty:** Medium (2–3 days as part of AR-002)

### AR-004 — Daily challenge completion storage grows without bound

- **Severity:** High
- **File:** `server/models/DailyChallenge.js`
- **Line:** 162
- **Why it is a problem:** Every completion is embedded in one DailyChallenge document. Popular challenges continually grow toward MongoDB's 16 MB document limit; every completion lookup scans the array, and each `$push` rewrites an increasingly large document. The index on `completions.user` does not impose uniqueness within the array.
- **Recommended fix:** Introduce a `DailyChallengeCompletion` collection with a unique `{challenge, user}` index and unique QuizSession/Score references. Dual-read legacy embedded completions during migration, backfill without deleting old data, then stop appending to the array.
- **Estimated implementation difficulty:** High (4–6 days including migration)

### AR-005 — Daily challenge questions and explanations are exposed before an attempt is created

- **Severity:** High
- **File:** `server/services/dailyChallengeService.js`
- **Line:** 71
- **Why it is a problem:** The general challenge serializer includes the complete question list and `explanation`. Both the daily metadata endpoint and by-ID endpoint populate/serialize questions before a one-time attempt exists. Explanations can reveal or strongly hint at answers, and users can repeatedly inspect the challenge without starting it.
- **Recommended fix:** Make general challenge responses metadata-only. Return safe questions without explanations only from a session-creation endpoint, bind them to a user-owned daily QuizSession, and reveal explanations only through the historical result response after completion.
- **Estimated implementation difficulty:** Medium (1–2 days, coordinated with QuizSession rollout)

### AR-006 — Daily challenge creation mutates database state from a GET request

- **Severity:** Medium
- **File:** `server/services/dailyChallengeService.js`
- **Line:** 413
- **Why it is a problem:** `GET /api/daily-challenge` calls `getOrCreateDailyChallenge`, so a nominally safe/read-only request can insert a challenge. This complicates caching, observability, retries, authorization reasoning, and CSRF assumptions around safe methods.
- **Recommended fix:** Generate challenges through a scheduled job, startup task, or explicit protected POST/admin operation. Make GET strictly retrieve existing state and return 404/503 when generation has not occurred.
- **Estimated implementation difficulty:** Medium (1–2 days plus deployment scheduling)

### AR-007 — Administrator category rename is a non-transactional cross-collection update

- **Severity:** High
- **File:** `server/controllers/adminCategoryController.js`
- **Line:** 279
- **Why it is a problem:** Question and Score categories are renamed with parallel independent `updateMany` operations. One can succeed while the other fails, permanently splitting category identity across current questions and historical analytics. Parallel execution is not atomicity.
- **Recommended fix:** Prefer a normalized Category model referenced by ObjectId. As an interim fix, run both updates in a MongoDB transaction, log the operation in that transaction, and add failure/retry tests.
- **Estimated implementation difficulty:** Medium (2–3 days interim; High for normalized migration)

### AR-008 — Administrator attempt deletion leaves derived data semantically inconsistent

- **Severity:** High
- **File:** `server/controllers/adminAttemptController.js`
- **Line:** 486
- **Why it is a problem:** The Score is deleted before User statistics are recalculated. Failure between those writes leaves counters stale. The recalculation sets any remaining streak to `1`, and it does not revoke achievements or related notifications/daily completion records. Deleting a Score referenced by a QuizSession or DailyChallenge can also leave dangling references.
- **Recommended fix:** Define whether attempts are immutable audit records or deletable. Prefer soft deletion/exclusion. If hard deletion is required, transactionally update all dependent records and recompute streak/achievements from source data; preserve referential audit metadata.
- **Estimated implementation difficulty:** High (3–5 days)

### AR-009 — Platform settings are administrative decoration rather than enforced behavior

- **Severity:** High
- **File:** `server/services/platformSettingsService.js`
- **Line:** 25
- **Why it is a problem:** Settings advertise controls for registration, quiz duration/count, XP multiplier, daily challenges, leaderboard, email, and maintenance mode, but only administrator settings controllers consume the service. Registration and feature routes use hard-coded behavior, so administrators can change values that have no effect.
- **Recommended fix:** Add a cached settings provider and enforce settings at the relevant service/middleware boundaries. Define invalidation after updates, safe defaults during database failure, and integration tests for every switch. Remove unsupported settings such as Google authentication until implemented.
- **Estimated implementation difficulty:** High (4–6 days)

### AR-010 — In-memory rate limiting does not scale across application instances

- **Severity:** High
- **File:** `server/middleware/rateLimitMiddleware.js`
- **Line:** 5
- **Why it is a problem:** The default express-rate-limit memory store is per-process and resets on restart. Attackers can multiply allowed login/reset attempts across replicas, and horizontally scaled instances enforce inconsistent limits.
- **Recommended fix:** Use a shared Redis or MongoDB-backed rate-limit store, key sensitive flows by normalized account plus IP where appropriate, and monitor rejected traffic. Keep proxy configuration consistent so client IPs are trustworthy.
- **Estimated implementation difficulty:** Medium (1–2 days plus infrastructure)

### AR-011 — Content Security Policy is disabled while the client uses widespread HTML string injection

- **Severity:** High
- **File:** `server/app.js`
- **Line:** 73
- **Why it is a problem:** Helmet explicitly disables CSP. Numerous client modules construct `innerHTML`; for example `client/js/achievements.js:140` interpolates icon, title, and description without escaping. Current achievement definitions are server-controlled, but this creates a fragile stored-XSS path if definitions become editable or data is corrupted. CSP is an important containment layer for any missed sink.
- **Recommended fix:** Replace dynamic HTML interpolation with DOM creation and `textContent`, or consistently sanitize trusted markup. Enable a nonce/hash-based CSP, remove inline styles/scripts, and roll it out in report-only mode before enforcement.
- **Estimated implementation difficulty:** High (3–6 days across all views/scripts)

### AR-012 — Cookie-authenticated mutation endpoints have no explicit CSRF defense

- **Severity:** Medium
- **File:** `server/app.js`
- **Line:** 125
- **Why it is a problem:** The app accepts both JSON and URL-encoded bodies and authenticates through a cookie, but state-changing routes do not validate a CSRF token or Origin/Referer. `SameSite=Lax` reduces common cross-site POST attacks but is not a complete policy boundary, particularly as browser behavior, same-site subdomains, and future cookie settings evolve.
- **Recommended fix:** Add synchronizer/double-submit CSRF tokens for cookie sessions or strictly require/validate same-origin Fetch Metadata and Origin headers on mutations. Reject form content types on JSON APIs where unnecessary. Keep bearer-token API behavior separate.
- **Estimated implementation difficulty:** Medium (2–3 days including client changes)

### AR-013 — Leaderboard endpoint loads and sorts every active user in application memory

- **Severity:** High
- **File:** `server/controllers/leaderboardController.js`
- **Line:** 11
- **Why it is a problem:** The query has no limit or pagination, materializes every eligible user, maps all of them, then slices ten. `User` also lacks an index matching `isActive`, `role`, and ranking sort fields. Latency and memory grow linearly with the user base.
- **Recommended fix:** Query the top page with `.limit()`, compute the current user's rank using indexed count/aggregation, add a compound leaderboard index such as `{isActive:1, role:1, totalXp:-1, quizzesCompleted:-1, correctAnswers:-1, createdAt:1}`, and use cursor pagination.
- **Estimated implementation difficulty:** Medium (2–3 days)

### AR-014 — Two leaderboard APIs implement conflicting business rules

- **Severity:** Medium
- **File:** `server/controllers/userController.js`
- **Line:** 16
- **Why it is a problem:** `/api/users/leaderboard` includes inactive users and administrators, applies a different tie-break order, and reports only the truncated set as total players. `/api/leaderboard` filters active regular users and returns a different shape. This is duplicate code with divergent authorization/data semantics.
- **Recommended fix:** Retain one canonical leaderboard service and route. Version or redirect the legacy endpoint, document a stable response DTO, and test role/status filtering and tie breaks.
- **Estimated implementation difficulty:** Low (0.5–1 day)

### AR-015 — Question selection lacks an index aligned with its filters

- **Severity:** Medium
- **File:** `server/models/Question.js`
- **Line:** 29
- **Why it is a problem:** `category` and `isActive` have separate indexes, while standard and daily selection repeatedly filter on both and sometimes difficulty. MongoDB may intersect indexes, but a compound index is more predictable. `$sample` remains increasingly expensive as the collection grows.
- **Recommended fix:** Add `{category:1, isActive:1, difficulty:1}` based on explain-plan evidence. For large banks, replace broad `$sample` with precomputed random keys, bounded candidate sampling, or curated question sets.
- **Estimated implementation difficulty:** Low (0.5–1 day, excluding advanced sampling)

### AR-016 — User ranking fields have no supporting indexes

- **Severity:** Medium
- **File:** `server/models/User.js`
- **Line:** 84
- **Why it is a problem:** User defines only the unique email index. Leaderboard and multiple administrator analytics queries sort/filter on role, active status, XP, quizzes, login date, and creation date, causing collection scans and blocking sorts at scale.
- **Recommended fix:** Capture production query shapes with profiler/explain, then add a small set of compound indexes for leaderboard and admin listing. Avoid indexing every field independently; monitor index size and write amplification.
- **Estimated implementation difficulty:** Medium (1–2 days)

### AR-017 — Notification generation is not idempotent

- **Severity:** Medium
- **File:** `server/services/notificationService.js`
- **Line:** 134
- **Why it is a problem:** Notifications have no event/session deduplication key. Retried or replayed completion can insert duplicate quiz, XP, streak, and achievement notifications even when Achievement's unique index suppresses duplicate achievements.
- **Recommended fix:** Add a `deduplicationKey` field with a partial unique `{user, deduplicationKey}` index. Build deterministic keys from QuizSession and notification purpose, and insert them within the completion transaction.
- **Estimated implementation difficulty:** Medium (1–2 days)

### AR-018 — Quiz timing is client-authoritative

- **Severity:** Medium
- **File:** `server/controllers/quizController.js`
- **Line:** 464
- **Why it is a problem:** `quizDurationSeconds` and `remainingSeconds` are supplied by the browser. A client can report arbitrary completion times, corrupting analytics and any future time-based reward logic.
- **Recommended fix:** Store `startedAt` and `expiresAt` in QuizSession and calculate elapsed time on the server. Treat the browser timer as presentation only.
- **Estimated implementation difficulty:** Low once QuizSession is integrated

### AR-019 — Route/application composition is centralized in a growing monolith

- **Severity:** Medium
- **File:** `server/app.js`
- **Line:** 160
- **Why it is a problem:** `app.js` imports every API router and declares every public, user, and administrator page route individually. Adding a page requires edits in a high-conflict central file and repeats identical protect/render boilerplate.
- **Recommended fix:** Split page routes into `publicPageRoutes`, `userPageRoutes`, and `adminPageRoutes`; mount feature routers through a route registry. Keep application creation focused on global middleware and error boundaries.
- **Estimated implementation difficulty:** Medium (1–2 days)

### AR-020 — Several controllers are oversized and mix transport, business, and presentation logic

- **Severity:** Medium
- **File:** `server/controllers/profileController.js`
- **Line:** 1
- **Why it is a problem:** `profileController.js` is 945 lines; analytics and quiz controllers are similarly large. They perform aggregation design, normalization, business rules, DTO construction, and HTTP responses together. This impedes unit testing and encourages duplicated calculations across dashboard/profile/analytics/admin features.
- **Recommended fix:** Introduce focused query/read-model services and completion/domain services. Keep controllers limited to request validation, service invocation, and response mapping. Share DTO serializers and calculation functions.
- **Estimated implementation difficulty:** High (5–10 days incrementally)

### AR-021 — Profile updates are duplicated with different capabilities

- **Severity:** Medium
- **File:** `server/controllers/settingsController.js`
- **Line:** 80
- **Why it is a problem:** `/api/settings/profile` updates name and email, while `/api/profile` implements another `updateProfile` that updates names only (`profileController.js:861`). Validation, response shapes, rate limiting, and email-change behavior differ. Changing an email also leaves `emailVerified` unchanged, so a verified account can switch to an unverified address while retaining verified status.
- **Recommended fix:** Create one account-profile service and one canonical endpoint. When email changes, set `emailVerified=false`, issue verification, and define whether current sessions remain valid. Have both pages consume the same DTO during migration.
- **Estimated implementation difficulty:** Medium (2–3 days)

### AR-022 — Validation is duplicated and inconsistent across controllers

- **Severity:** Medium
- **File:** `server/controllers/authController.js`
- **Line:** 14
- **Why it is a problem:** `normalizeText`, name/email/password rules, ObjectId validation, pagination, and error conversion are repeatedly implemented. The repository already has `server/utils/validator.js`, but controllers largely use local variants. Rules can drift, as demonstrated by the two profile update paths.
- **Recommended fix:** Adopt request schemas through a validation library or centralized validators/middleware. Return one standard validation-error format and keep Mongoose validation as a persistence backstop.
- **Estimated implementation difficulty:** High (3–6 days incrementally)

### AR-023 — Browser API, authentication, formatting, and escaping logic is heavily duplicated

- **Severity:** Medium
- **File:** `client/js/dashboard.js`
- **Line:** 89
- **Why it is a problem:** The client contains many independent implementations of unauthorized handling, logout, JSON parsing, date formatting, number formatting, and HTML escaping. `client/js/api.js`, `auth.js`, and `ui.js` do not serve as a consistently used application layer. Error behavior and storage cleanup therefore vary by page.
- **Recommended fix:** Convert browser code to ES modules or bundle it, centralize an API client with 401/error handling, and share safe DOM/formatting/auth utilities. Migrate one page at a time with contract tests.
- **Estimated implementation difficulty:** High (4–8 days)

### AR-024 — CSS tokens and reset rules are redefined per page

- **Severity:** Medium
- **File:** `client/css/dashboard.css`
- **Line:** 1
- **Why it is a problem:** Large page stylesheets redefine `:root`, resets, typography, buttons, cards, headers, and responsive rules. For example dashboard and analytics each define their own near-identical color systems, while `variables.css` is loaded only by a few public/auth views. This produces visual drift and 1,000–2,000-line stylesheets.
- **Recommended fix:** Establish layered CSS: tokens, reset/base, layout, reusable components, utilities, then page overrides. Load shared layers in a common EJS head partial and remove duplicated definitions incrementally.
- **Estimated implementation difficulty:** High (5–10 days incrementally)

### AR-025 — Views do not use shared layout composition

- **Severity:** Medium
- **File:** `client/views/dashboard.ejs`
- **Line:** 1
- **Why it is a problem:** Most views repeat complete HTML documents, head metadata, navigation/header structures, and script/style loading. Only navbar/footer fragments exist, and they are not consistently used. Changes to CSP, branding, accessibility, or asset versioning require broad manual edits.
- **Recommended fix:** Introduce shared head, shell, navigation, and script partials, or adopt EJS layout middleware. Pass page metadata/assets explicitly and keep page templates focused on content.
- **Estimated implementation difficulty:** Medium (3–5 days)

### AR-026 — API response and HTTP semantics are inconsistent

- **Severity:** Medium
- **File:** `server/routes/quizRoutes.js`
- **Line:** 18
- **Why it is a problem:** Starting a quiz is a GET despite representing attempt creation in the intended architecture; daily start is POST; updates mix PUT and PATCH; duplicate leaderboard endpoints return different shapes; identifiers alternate between `id`, `_id`, `attemptId`, `resultId`, and `challengeId`. Clients need endpoint-specific handling instead of a stable contract.
- **Recommended fix:** Define an API style guide and versioned DTOs. Use POST for session creation, PATCH for partial mutations, consistent pagination metadata/error envelopes, and consistent public identifier names.
- **Estimated implementation difficulty:** High (3–6 days with compatibility period)

### AR-027 — Error handling relies on brittle message matching and unstructured errors

- **Severity:** Low
- **File:** `server/controllers/dailyChallengeController.js`
- **Line:** 59
- **Why it is a problem:** The controller maps a service failure by searching error-message text. Refactoring wording can silently change HTTP behavior. Other controllers manually map Mongoose errors, while the global handler understands only `statusCode`.
- **Recommended fix:** Introduce typed application errors with stable codes, status, safe message, and details. Centralize Mongo duplicate/validation/cast handling in error middleware.
- **Estimated implementation difficulty:** Medium (2–4 days incrementally)

### AR-028 — Health endpoint discloses deployment environment

- **Severity:** Low
- **File:** `server/app.js`
- **Line:** 396
- **Why it is a problem:** The unauthenticated health response exposes `NODE_ENV`. This is minor information disclosure and mixes liveness with application metadata.
- **Recommended fix:** Return only status for public liveness. Put detailed readiness/dependency information behind internal network controls or authentication.
- **Estimated implementation difficulty:** Low (under 1 hour)

### AR-029 — Automated quality and test commands are not configured

- **Severity:** High
- **File:** `package.json`
- **Line:** 10
- **Why it is a problem:** There is no `test`, `lint`, `format:check`, or CI-oriented script. `npm test` fails. The existing security checks are standalone scripts, and there are no route, database transaction, authorization, or browser contract tests. High-risk changes cannot be regression-tested consistently.
- **Recommended fix:** Add a test runner and transaction-capable MongoDB test fixture, wire existing scripts into `npm test`, configure ESLint/Prettier, and run syntax, lint, unit, integration, concurrency, and migration tests in CI.
- **Estimated implementation difficulty:** High (3–6 days initial foundation)

### AR-030 — Dependencies and folders contain unused or misleading scaffolding

- **Severity:** Low
- **File:** `package.json`
- **Line:** 22
- **Why it is a problem:** Both `bcrypt` and `bcryptjs` are installed while only `bcrypt` is imported. `socket.io` and `uuid` have no source imports. `server/config/env.js` and `server/services/quizService.js` are empty, and multiple empty directories (`server/sockets`, `server/validators`, `client/components`, `client/pages`) imply architecture that does not exist.
- **Recommended fix:** Remove unused dependencies after lockfile verification, delete or document placeholders, and add modules only when a concrete boundary exists. Correct `main`, description, repository, and test metadata.
- **Estimated implementation difficulty:** Low (0.5 day)

### AR-031 — Public session identifiers are stored in recoverable form

- **Severity:** Low
- **File:** `server/models/QuizSession.js`
- **Line:** 15
- **Why it is a problem:** The 256-bit identifier is appropriately unpredictable, but it is stored verbatim. A read-only database leak would expose active session bearer identifiers. User ownership checks reduce impact, but hashing provides defense in depth.
- **Recommended fix:** Return the raw identifier once, store a SHA-256 digest in an indexed field, and hash incoming identifiers before lookup. Retain Mongo `_id` for internal references.
- **Estimated implementation difficulty:** Low (0.5–1 day before session integration)

## Cross-cutting architectural recommendations

### Target server structure

Organize by feature rather than only technical layer as the project grows:

```text
server/features/quiz/
  quiz.routes.js
  quiz.controller.js
  quiz-session.model.js
  quiz-completion.service.js
  quiz.validation.js
  quiz.dto.js
server/features/daily-challenge/
server/features/account/
server/features/admin/
server/shared/
  errors/
  middleware/
  database/
  validation/
```

This is an incremental destination, not a requirement for a disruptive rewrite. The immediate priority is extracting cohesive services from oversized controllers.

### Database integrity strategy

- Use transactions for workflows spanning Score, User, QuizSession, DailyChallengeCompletion, Achievement, Notification, and ActivityLog.
- Use unique constraints for business invariants: one Score per QuizSession, one daily completion per user/challenge, one achievement per user/code, and one notification per event/purpose.
- Keep historical Score answer snapshots so results survive later Question edits/deactivation.
- Prefer stable references to mutable category strings.
- Build indexes from measured query shapes and verify with `explain("executionStats")`.
- Use additive migrations and dual reads; do not delete existing data during normalization.

### Client strategy

- Introduce a shared API client and auth/error layer.
- Prefer safe DOM construction over `innerHTML` for dynamic data.
- Make QuizSession the persisted browser attempt identity.
- Derive timer display from server expiry.
- Consolidate CSS tokens/components and EJS layouts.
- Define stable API DTOs before refactoring page scripts.

### Test strategy

Minimum critical suite:

- authentication, token rotation, inactive-user authorization, and admin authorization;
- standard/daily QuizSession creation and safe serialization;
- replay, expiry, ownership, and malformed-answer rejection;
- concurrent duplicate submissions with exactly one Score/reward;
- transaction rollback at every completion stage;
- legacy Score/result rendering after question deactivation;
- daily completion uniqueness and migration compatibility;
- notification/achievement idempotency;
- leaderboard pagination/index-backed behavior;
- platform-setting enforcement;
- output encoding and CSP regression checks.

## Conclusion

The repository is feature-rich and its broad MVC separation is understandable, but business integrity currently depends too heavily on controllers and best-effort sequencing. Completing the already-started QuizSession work and moving quiz completion into a transaction will remove the two most consequential risks. After that, consolidating duplicated APIs/utilities and establishing automated tests will produce the largest maintainability and scalability gains without requiring a full rewrite.
