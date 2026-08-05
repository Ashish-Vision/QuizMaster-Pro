# QuizMaster Pro — Complete API Review

Date: 2026-08-05  
Scope: every Express API router mounted in `server/app.js:340-390`, its route middleware, controller validation, status codes, response envelopes, query controls, authentication, authorization, and global error handling. No source file was modified.

## Executive summary

The API has a solid security baseline: protected routes consistently use `protect`, all `/api/admin/*` routers use both `protect` and `adminOnly`, resource ownership is enforced for quiz results and user notifications, authentication rate limits cover login/registration/reset operations, and most JSON responses use `{ success, ... }`.

The main weaknesses are contract consistency rather than missing access control:

1. Two leaderboard APIs expose contradictory behavior and data sets.
2. Pagination, sorting, search, validation, identifiers, and response metadata are independently implemented in controllers.
3. Invalid query parameters are sometimes rejected and sometimes silently replaced with defaults.
4. Mongoose/Cast/duplicate-key errors reaching the global handler can become generic 500 responses instead of stable 400/409 API errors.
5. Action-oriented routes and mixed singular/plural resource naming weaken REST consistency.
6. Mutation responses always return JSON 200, including deletes; this is workable, but no project-wide status-code policy exists.
7. The content-negotiating authentication middleware can redirect an `/api/*` request when a client sends or defaults to an HTML-preferred `Accept` header.

## Severity summary

| Severity | Finding |
|---|---|
| High | Duplicate, contradictory leaderboard contracts |
| High | API authentication failures can redirect instead of returning JSON |
| High | No centralized validation/error translation; database validation failures can surface as 500 |
| High | Quiz submission contract remains client-authoritative and is not session-based |
| Medium | Pagination contract and invalid-input behavior vary by endpoint |
| Medium | Sorting/search/filter contracts vary and are incompletely validated |
| Medium | Response envelope and field naming are inconsistent |
| Medium | REST resource/method naming is inconsistent |
| Medium | Email verification mutates state through GET |
| Medium | No API versioning or machine-readable error codes |
| Low | Delete/reset/status responses lack a unified status policy |
| Low | Public authentication endpoint naming is inconsistent |

## Complete route inventory

Legend: **User** means `protect`; **Admin** means `protect` plus `adminOnly`; **Public** means no authentication middleware. Successful JSON responses use `success: true` unless noted as CSV.

### Authentication and account lifecycle

| Endpoint | Access | Success | Review |
|---|---|---|---|
| `POST /api/auth/register` | Public, rate-limited | 201 | Correct creation method/status; manually validates body. |
| `POST /api/auth/login` | Public, rate-limited | 200 | Correct action endpoint; returns 401 for bad credentials and 403 for disabled/unverified accounts. |
| `POST /api/auth/logout` | Public | 200 | Correct non-GET mutation and safe cookie clearing; being public makes logout idempotently usable with an expired token. |
| `GET /api/auth/me` | User | 200 | Correct authenticated singleton read. |
| `GET /api/email-verification/verify/:token` | Public | 200 | **Unsafe GET:** verifies and mutates user state; link scanners/prefetchers can consume the token. |
| `POST /api/email-verification/resend` | Public, reset limiter | 200 | Method is reasonable, but the reused `forgotPasswordLimiter` is misleading and couples unrelated throttling (`server/routes/emailVerificationRoutes.js:10-16`). |
| `POST /api/password-reset/forgot` | Public, rate-limited | 200 | Correct anti-enumeration design: returns a generic response for unknown email (`server/controllers/passwordResetController.js:38-59`). |
| `GET /api/password-reset/validate/:token` | Public | 200 | Safe validation read, though putting a secret in the path increases proxy/log exposure. |
| `PATCH /api/password-reset/reset/:token` | Public, rate-limited | 200 | Mutation method is acceptable; `POST` is more conventional for consuming a one-time reset token. Token in body or fragment-backed exchange reduces URL logging. |

### Quiz, challenge, result, and user data

| Endpoint | Access | Success | Review |
|---|---|---|---|
| `GET /api/quiz/categories` | User | 200 | Safe collection metadata read. Naming would be clearer under `/api/categories` or `/api/quiz-categories`. |
| `GET /api/quiz/start/:category` | User | 200 | Currently performs random selection but does not create a QuizSession (`server/controllers/quizController.js:143-202`). “start” is action-oriented and a random GET is not cache-stable. When session creation is integrated, this **must become POST**. |
| `POST /api/quiz/submit` | User | 201 | Creates Score, so 201 is defensible. URI is action-oriented; recommended `POST /api/quiz-sessions/:id/submissions` or `POST /api/quiz-results`. |
| `GET /api/quiz/result/:resultId` | User/owner | 200 | Ownership correctly included in query (`server/controllers/quizController.js:755-758`). Prefer plural `/results/:id`. |
| `GET /api/daily-challenge` | User | 200; 404/410/503 | Singleton “today” semantics are understandable. Singular resource name differs from plural conventions. |
| `GET /api/daily-challenge/:challengeId` | User | 200 | Validates ObjectId and availability. |
| `POST /api/daily-challenge/:challengeId/start` | User | 200 | Correctly uses POST for session-producing action. Prefer `POST /api/daily-challenges/:id/sessions`, returning 201 when a session is created. |
| `GET /api/history` | User | 200 | Paginated, filtered by category, ownership scoped. |
| `GET /api/profile` | User | 200 | Correct singleton read. |
| `PUT /api/profile` | User | 200 | Handler performs a partial name update (`server/controllers/profileController.js:872-920`), so PATCH is semantically more accurate than PUT. |
| `POST /api/profile/avatar` | User, upload validation | 200 | If this creates/replaces a subresource, `PUT /api/profile/avatar` is more idempotent and descriptive. |
| `DELETE /api/profile/avatar` | User | 200 | Valid; 200 is consistent with a response body. |
| `GET /api/settings` | User | 200 | Correct singleton read. |
| `PATCH /api/settings/profile` | User, rate-limited | 200 | Duplicates `PUT /api/profile`; consolidate ownership of profile mutation. |
| `PATCH /api/settings/password` | User, rate-limited | 200 | Appropriate method; old tokens are invalidated through token version changes. |
| `GET /api/achievements` | User | 200 | Correct collection read. |
| `GET /api/analytics` | User | 200 | Correct read; this is an aggregate/read model rather than a resource mutation. |

### Leaderboards and notifications

| Endpoint | Access | Success | Review |
|---|---|---|---|
| `GET /api/leaderboard` | User | 200 | Canonical implementation filters active regular users but loads all ranked users to find current rank (`server/controllers/leaderboardController.js:11-50`). No pagination/limit. |
| `GET /api/users/leaderboard` | User | 200 | Duplicate implementation accepts `limit`, includes admins and disabled users, and uses contradictory ordering (`server/controllers/userController.js:7-25`). Deprecate it. |
| `GET /api/notifications` | User | 200 | Paginated and owner-scoped. `unreadOnly` accepts any non-`true` value as false rather than rejecting malformed booleans. |
| `GET /api/notifications/unread-count` | User | 200 | Correct derived read. |
| `PATCH /api/notifications/read-all` | User | 200 | Action-oriented collection mutation. A clearer model is `PATCH /api/notifications` with `{ isRead: true, filter: { isRead: false } }`, though current form is practical. |
| `PATCH /api/notifications/:notificationId/read` | User/owner | 200 | Ownership is correctly enforced in the atomic update (`server/controllers/notificationController.js:125-137`). Repeated calls remain successful if the record exists. |
| `DELETE /api/notifications/:notificationId` | User/owner | 200 | Correct ownership enforcement. Could standardize on 204 if deletion bodies are removed globally. |

### Administrator reads and management

All endpoints below are correctly protected by router-level `protect` then `adminOnly` middleware.

| Endpoint | Success | Review |
|---|---|---|
| `GET /api/admin/dashboard` | 200 | Aggregate read; consistent. |
| `GET /api/admin/analytics` | 200 | Accepts `days`; invalid/out-of-range input is silently defaulted rather than rejected. |
| `GET /api/admin/activity-logs` | 200 | Paginated/searchable, but action/entity filter enums are not validated (`server/controllers/adminActivityLogController.js:62-77`). |
| `GET /api/admin/activity-logs/summary` | 200 | Correct derived read. |
| `GET /api/admin/attempts` | 200 | Paginated/search/filter/sort. Invalid `userId` gets 400, but invalid sort silently becomes newest. |
| `GET /api/admin/attempts/:attemptId` | 200 | Correct 400 malformed ID / 404 missing distinction. |
| `DELETE /api/admin/attempts/:attemptId` | 200 | Deletion also recalculates user totals; correct domain behavior, but status/body policy should be documented. |
| `GET /api/admin/users` | 200 | Strong enum validation for role/status/sort; invalid pagination silently defaults. |
| `GET /api/admin/users/:userId` | 200 | Correct ID and not-found handling. |
| `PATCH /api/admin/users/:userId/role` | 200 | Appropriate partial domain update; safeguards last-admin/self changes. |
| `PATCH /api/admin/users/:userId/status` | 200 | Appropriate partial domain update; 200 no-op responses are used when state already matches. |
| `GET /api/admin/categories` | 200 | Category is derived from Question strings rather than a first-class resource, making rename/delete bulk operations. |
| `PATCH /api/admin/categories/:categoryName` | 200 | Semantically acceptable, but names in path require encoding and are mutable identifiers. Prefer Category IDs. |
| `DELETE /api/admin/categories/:categoryName` | 200 | Correctly returns 409 when historical attempts prevent deletion. Prefer stable ID. |
| `GET /api/admin/questions` | 200 | Good allowlist for sort field; invalid sort/order silently defaults while invalid difficulty returns 400. |
| `POST /api/admin/questions` | 201 | Correct method/status and duplicate conflict 409. |
| `GET /api/admin/questions/meta/options` | 200 | Static metadata endpoint is correctly ordered before `/:questionId`; `/meta/options` is awkward—prefer `/metadata`. |
| `GET /api/admin/questions/:questionId` | 200 | Correct 400/404 handling. |
| `PUT /api/admin/questions/:questionId` | 200 | Full payload validation makes PUT reasonable. |
| `DELETE /api/admin/questions/:questionId` | 200 | Correct 409 when referenced by a Score. |
| `GET /api/admin/achievements` | 200 | Search/filter/sort but no page/limit; output is definition-level aggregation, so bounded size currently makes this acceptable. |
| `GET /api/admin/achievements/:code` | 200 | Uses mutable string code; validated and returns 404 when absent. |
| `GET /api/admin/notifications` | 200 | Paginated and validates type/status; also returns an unpaginated active-user recipient list, creating an oversized coupled response. |
| `POST /api/admin/notifications` | 201 | Correct creation status; validates recipients, types, content, and safe internal links. |
| `DELETE /api/admin/notifications/batch/:batchId` | 200 | Correct route ordering before `/:notificationId`; batch deletion is practical but action/collection semantics should be documented. |
| `DELETE /api/admin/notifications/:notificationId` | 200 | Correct malformed/missing handling. |
| `GET /api/admin/settings` | 200 | Correct singleton read. |
| `PATCH /api/admin/settings` | 200 | Correct partial update, but controller validation delegates heavily to the service; expose stable per-field errors. |
| `POST /api/admin/settings/reset` | 200 | Action endpoint is acceptable; could be `DELETE /api/admin/settings/overrides` if defaults/overrides become distinct resources. |

### Administrator reports

| Endpoint | Success | Review |
|---|---|---|
| `GET /api/admin/reports/summary` | 200 JSON | Correct read. |
| `GET /api/admin/reports/users` | 200 CSV | Correct export read; role/status filter validation is weaker than admin user list. |
| `GET /api/admin/reports/attempts` | 200 CSV | `days` silently normalizes/defaults. |
| `GET /api/admin/reports/questions` | 200 CSV | Category/difficulty filters are accepted; align enum validation with question list. |
| `GET /api/admin/reports/categories` | 200 CSV | Correct export read. |
| `GET /api/admin/reports/achievements` | 200 CSV | Correct export read. |

CSV responses intentionally cannot follow the JSON `{ success, data }` envelope. They set `text/csv` and attachment disposition at `server/controllers/adminReportController.js:35-40`; this exception should be explicit in API documentation.

## Detailed findings

### API-001 — Contradictory duplicate leaderboard APIs

- Severity: **High**
- Files: `server/routes/leaderboardRoutes.js:11`, `server/routes/userRoutes.js:11`, `server/controllers/leaderboardController.js:11-50`, `server/controllers/userController.js:7-60`
- Problem: `/api/leaderboard` filters `isActive: true` and `role: "user"`, sorts XP/quizzes/correct answers descending, returns top 10 and the current user's overall entry. `/api/users/leaderboard` queries every user including admins and disabled accounts, accepts limit 1–100, sorts `quizzesCompleted` ascending, and only finds the current user if inside that limited slice. Identical concepts therefore produce different rankings, privacy scope, and payload semantics.
- Recommendation: choose `/api/leaderboard` as canonical, implement one service/query contract, add explicit page/limit or `top`, calculate current rank separately, redirect/deprecate the duplicate with a sunset header, and eventually return 410 after clients migrate.

### API-002 — API authentication may redirect to HTML

- Severity: **High**
- Files: `server/middleware/authMiddleware.js:13-15`, `:41-49`, `:57-64`, `:85-92`, `:130-137`; `server/middleware/adminMiddleware.js:10-31`
- Problem: authentication decides between redirect and JSON from `Accept`, not from route namespace. An API fetch with `Accept: text/html`, `*/*`, or browser navigation can receive a 302/login HTML instead of a stable 401 JSON contract. This complicates clients and can turn authentication errors into HTML parsing failures.
- Recommendation: API middleware mounted under `/api` must always return JSON 401/403. Use separate page-route middleware for redirects, or test `req.originalUrl.startsWith("/api/")` before content negotiation.

### API-003 — Validation and database error translation are fragmented

- Severity: **High**
- Files: `server/middleware/errorHandler.js:10-25`; representative manual validators at `server/controllers/authController.js:20-82`, `adminQuestionController.js:309-404`, `settingsController.js:82-267`
- Problem: controllers manually parse and validate payloads. The global handler understands only `error.statusCode`; Mongoose ValidationError/CastError and duplicate key code 11000 are not normalized. Unexpected database validation can therefore be returned as generic 500, while equivalent controller checks return 400/409. There is no field-error array or machine-readable code.
- Recommendation: validate params/query/body at the route boundary with shared schemas (Zod, Joi, celebrate, or express-validator), reject unknown fields where appropriate, and translate database errors centrally: CastError→400, ValidationError→422 or 400, duplicate key→409. Adopt `{ success: false, error: { code, message, fields?, requestId? } }`.

### API-004 — Quiz submission is client-authoritative

- Severity: **High**
- Files: `server/controllers/quizController.js:225-253`, `:299-359`; `server/routes/quizRoutes.js:18-20`; `server/models/QuizSession.js:1-190`
- Problem: the submission accepts client-provided category, question IDs, timing, and optional daily challenge ID rather than the planned `quizSessionId` plus selected answers. The QuizSession model exists, but standard quiz start does not create or return a session. This keeps the replay/XP-farming contract exposed and makes submission semantics inconsistent with the domain model.
- Recommendation: `POST /api/quiz-sessions` creates a session and returns sanitized questions; `POST /api/quiz-sessions/:sessionId/submissions` accepts only answers. Atomically claim the session, create the Score, update counters/XP/challenge state, and return the created result. Preserve `GET /api/quiz/results/:resultId` for historical viewing.

### API-005 — Pagination is not a single contract

- Severity: **Medium**
- Files: `server/controllers/historyController.js:9-20`, `notificationController.js:11-24`, `adminQuestionController.js:125-137`, `adminUserController.js:68-80`, `adminAttemptController.js:150-161`, `adminActivityLogController.js:62-63`
- Problem:
  - Maximums/fallbacks vary: history max 50/default 10; notifications max 100/default 20; admin lists max 100/default 10.
  - Invalid page/limit silently fall back instead of returning 400.
  - Metadata names vary (`totalAttempts`, `totalNotifications`, `totalUsers`, `totalLogs`, `currentPage`) rather than generic `totalItems`, `page`, `pageSize`.
  - Leaderboards and some admin derived lists are unpaginated.
  - Offset pagination has unstable performance at deep pages.
- Recommendation: centralize `page`, `pageSize` (or cursor), consistent bounds, deterministic `_id` tie-breaks, and a common `meta.pagination` object. Decide globally whether malformed input is 400; recommended behavior is 400 while omitted input receives defaults. Use cursor pagination for histories/logs/notifications.

### API-006 — Sorting, filtering, and search validation differ

- Severity: **Medium**
- Files: `server/controllers/adminQuestionController.js:139-192`, `adminUserController.js:82-109`, `adminAttemptController.js:163-180`, `adminActivityLogController.js:65-77`, `notificationController.js:34`
- Problem: admin users reject invalid enum values; admin questions default unknown sorts but reject difficulty; attempts default unknown sorts; activity logs accept arbitrary action/entity values; notification boolean parsing treats everything except `true` as false. Search field names and result metadata also vary.
- Recommendation: create endpoint query schemas backed by shared pagination/sort/filter primitives. Use the same conventions: `search`, `sort=field`, `order=asc|desc`, exact enum validation, explicit booleans, and return normalized filters only if clients need them.

### API-007 — Response envelopes and identifier names are inconsistent

- Severity: **Medium**
- Files: representative responses at `server/controllers/historyController.js:73-87`, `notificationController.js:66-91`, `leaderboardController.js:47-52`, `quizController.js:624-635`
- Problem: success data is placed directly at the top level (`history`, `notifications`, `leaderboard`, `result`) rather than under one `data` field. IDs appear as raw `_id`, `id`, `userId`, `resultId`, `attemptId`, and `notificationId`. Pagination and filters also occupy different positions. Clients require endpoint-specific parsing.
- Recommendation: define a versioned envelope, for example `{ success: true, data, meta? }`, serialize `_id` consistently as `id`, and reserve domain-prefixed IDs only where disambiguation is necessary. Document CSV as an explicit non-envelope response.

### API-008 — REST naming and HTTP semantics are mixed

- Severity: **Medium**
- Files: route definitions throughout `server/routes/quizRoutes.js`, `dailyChallengeRoutes.js`, `notificationRoutes.js`, `adminSettingsRoutes.js`, `profileRoutes.js`
- Problem: singular/plural resource names (`quiz`, `daily-challenge`, `result`), verbs (`start`, `submit`, `read-all`, `reset`, `verify`), and nested action suffixes coexist. Some are pragmatic RPC-style commands, but there is no consistent convention. `PUT /profile` performs a partial update.
- Recommendation: standardize plural nouns and model commands as subordinate resources when useful: `/quiz-sessions`, `/quiz-results`, `/daily-challenges/:id/sessions`, `/password-reset-requests`. Use PATCH for partial updates. Keep command routes only when resource modeling adds no clarity, and document them as such.

### API-009 — Email verification changes state through GET

- Severity: **Medium**
- Files: `server/routes/emailVerificationRoutes.js:14`; `server/controllers/emailVerificationController.js:99-142`
- Problem: GET should be safe. Email/security scanners, browser prefetch, and link previews may follow the URL and consume the one-time verification without deliberate user action.
- Recommendation: GET should render/return token validity only; require a POST confirmation to consume it. If one-click verification is retained, explicitly accept this tradeoff and ensure repeated use returns a friendly idempotent result rather than an ambiguous invalid-token error.

### API-010 — No API versioning or machine-readable errors

- Severity: **Medium**
- Files: mounts at `server/app.js:340-390`; global errors at `server/middleware/errorHandler.js:17-25`
- Problem: every route is mounted directly under `/api`, while multiple contracts already need breaking cleanup. Errors expose only prose `message`, forcing clients to compare text that may change.
- Recommendation: introduce `/api/v1` for the stabilized contract or use an explicit media-type/version policy. Add stable error codes such as `AUTH_REQUIRED`, `VALIDATION_FAILED`, `RESOURCE_NOT_FOUND`, and `QUIZ_SESSION_ALREADY_COMPLETED`.

### API-011 — Mutation status-code policy is implicit

- Severity: **Low**
- Files: deletion responses at `server/controllers/notificationController.js:206`, `adminQuestionController.js:478`, `adminAttemptController.js:492`; state changes throughout admin controllers
- Problem: deletes return 200 with a message, creates return 201, and updates return 200. This is valid HTTP, but behavior is not standardized/documented; reset/start commands vary between 200 and created-resource semantics.
- Recommendation: use 201 plus `Location` for newly created resources, 200 when returning a representation/result, and 204 for bodyless successful updates/deletes. Pick one deletion convention and apply it consistently.

### API-012 — Some admin responses combine unrelated unbounded data

- Severity: **Medium**
- Files: `server/controllers/adminNotificationController.js:140-192`, `adminAttemptController.js:242-272`
- Problem: paginated admin notification results also return every active user as recipient options; attempts return every user and category for filters. Response size grows with the user base and couples list data with filter metadata.
- Recommendation: create searchable/paginated `/api/admin/users/options` and category metadata endpoints, or include only small stable enumerations. Load recipient suggestions on demand.

## Authentication and authorization assessment

### Verified strengths

- Every user-data route uses `protect` at either route or router level.
- Every admin router applies `protect` before `adminOnly` (`server/routes/admin*Routes.js`).
- JWT verification checks signature policy and token version; disabled users get 403 and invalid/expired sessions get 401 (`server/middleware/authMiddleware.js:52-105`).
- Notification read/delete operations include the authenticated user in the database predicate (`server/controllers/notificationController.js:125-129`, `:194-197`).
- Quiz result reads include the authenticated user in the predicate (`server/controllers/quizController.js:755-758`).
- Admin role/status controllers include safeguards around self-demotion/deactivation and retaining an active admin.
- Registration/login/password-reset/settings mutations are rate-limited.

### Recommended hardening

1. Make all `/api` auth failures JSON-only (API-002).
2. Add CSRF protection or a strict same-origin token/header policy for cookie-authenticated state-changing routes. SameSite cookies help but do not replace an explicit API policy; Bearer clients should not be subject to CSRF semantics.
3. Rate-limit email verification resend with a dedicated key/limiter and consider limits for expensive authenticated analytics/export endpoints.
4. Return the same 404 for non-owned and nonexistent resources, as notification/result endpoints already do, to avoid ownership disclosure.
5. Document cookie authentication versus Bearer authentication and precedence (cookie currently wins at `server/middleware/authMiddleware.js:29-39`).

## Validation and error-message assessment

Error prose is generally clear, specific, and non-sensitive. Good examples distinguish malformed ObjectIds (400), absent resources (404), conflicts (409), expired challenges (410), unavailable dependencies (503), unauthenticated (401), and forbidden (403).

Remaining issues:

- There is no `errors` array mapping fields to reasons, so forms must interpret a single message.
- Error wording varies between “invalid,” “not found,” “required,” and domain sentences without stable codes.
- Several parsers use `Number.parseInt`, which accepts prefixes such as `"10abc"` as 10. Schema validation should require the complete string to match an integer.
- `decodeURIComponent` is manually called on Express params in category controllers; Express already decodes route parameters and malformed encodings can throw. Central parameter schemas should handle this predictably.
- Query strings have no maximum search length, allowing expensive regex expressions even though regex metacharacters are escaped.
- Unknown body keys are generally ignored rather than rejected, hiding client typos.
- The development global handler returns stack traces (`server/middleware/errorHandler.js:23-25`); ensure production environment configuration is reliable and never expose this outside development.

## Recommended canonical contract

### Success

```json
{
  "success": true,
  "data": {},
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalItems": 125,
      "totalPages": 7,
      "hasNextPage": true
    }
  }
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The request contains invalid fields.",
    "fields": {
      "pageSize": "Must be an integer between 1 and 100."
    },
    "requestId": "..."
  }
}
```

### Query conventions

- `page` and `pageSize`, or `cursor` and `pageSize`; never mix endpoint-specific names.
- `search` for free text, bounded by length.
- `sort=<allowlisted-field>&order=asc|desc`.
- Boolean values must be exactly `true` or `false`.
- Invalid supplied values return 400; only omitted values receive defaults.
- Every sorted list includes a deterministic unique tie-breaker.

## Prioritized implementation plan

### Phase 1 — protect and stabilize

1. Force JSON 401/403 for `/api` routes.
2. Finish the QuizSession-based start/submission contract.
3. Consolidate the two leaderboard implementations and deprecate one route.
4. Add centralized request validation and database-error translation.

### Phase 2 — normalize shared contracts

1. Introduce machine-readable error codes and request IDs.
2. Standardize pagination/filter/sort parsing and metadata.
3. Normalize success envelopes and identifier serialization.
4. Publish an OpenAPI specification and contract tests.

### Phase 3 — improve resource design without breaking clients

1. Add versioned `/api/v1` routes for breaking changes.
2. Move quiz operations to quiz-session/result resources.
3. Change partial profile PUT to PATCH and eliminate duplicate profile mutation paths.
4. Separate admin filter-option endpoints from paginated list responses.
5. Convert verification consumption to POST confirmation.

## Required API test matrix

For every endpoint, automated integration tests should cover:

1. Documented successful request, status, content type, and response schema.
2. Missing authentication (401 JSON), inactive account (403), ordinary user on admin endpoint (403), and valid admin access.
3. Missing/invalid/unknown body, query, and path fields.
4. Malformed ObjectId (400), well-formed missing ID (404), non-owned ID (404), and conflict (409).
5. Minimum/maximum pagination, malformed numbers, sort allowlist, filter enums, and deterministic ties.
6. Search escaping, maximum length, empty search, and Unicode.
7. Duplicate and concurrent creates/updates.
8. Correct resource ownership for result, notification, profile, history, and analytics reads.
9. CSV content type/disposition and JSON error response before headers are sent.
10. `Accept: application/json`, `Accept: */*`, and `Accept: text/html` on unauthenticated `/api` requests—each must return the chosen API JSON contract.

## Final assessment

The API is functionally broad and its route-level authorization is consistently applied. The highest-risk gap is the unfinished transition to server-issued quiz sessions; the highest maintainability gap is the lack of a shared request/response contract. Addressing JSON-only API authentication, centralized validation/error translation, leaderboard consolidation, and standardized pagination will give clients a predictable foundation before introducing a versioned REST cleanup.
