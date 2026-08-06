# QuizMaster Pro — Express Backend Refactor Review

Review date: 2026-08-05  
Scope: All JavaScript under `server/`, including application composition, routes, controllers, middleware, services, models, database scripts, and utilities.  
Constraint: Review only; no source files were changed.

## Executive summary

The backend is separated into recognizable Express/MVC folders, but most reuse stops at routing and Mongoose models. List controllers independently implement the same query pipeline—normalize query parameters, validate enum filters, escape a regex, build filters, map a sort name, calculate offset, execute `find` plus `countDocuments`, and construct pagination metadata. Account validation, ObjectId checks, authenticated-user lookup, DTO serialization, Mongoose error mapping, date/trend generation, and dashboard counts are also repeated.

The best refactor is not a generic “base controller.” That would hide feature behavior and make MongoDB queries harder to reason about. The recommended approach is a small set of explicit, composable utilities plus feature services:

- shared request/query parsers;
- safe search and sort builders;
- pagination metadata and a lightweight paged-query executor;
- parameter validation middleware;
- shared DTO serializers and projection constants;
- centralized account validation and persistence-error mapping;
- reusable date-series and aggregate read services;
- feature services for leaderboard, account profile, quiz completion, and admin dashboards.

## Duplication inventory

### BR-001 — Text normalization is independently reimplemented

**Examples**

- `server/controllers/authController.js:14`
- `server/controllers/settingsController.js:9`
- `server/controllers/profileController.js:17`
- `server/controllers/adminQuestionController.js:18`
- `server/controllers/adminUserController.js:14`
- `server/controllers/adminAttemptController.js:40`
- `server/controllers/adminNotificationController.js:24`
- `server/controllers/adminActivityLogController.js:5`
- `server/controllers/adminAchievementController.js:8`
- `server/controllers/adminReportController.js:12`
- `server/services/activityLogService.js:7`
- `server/services/notificationService.js:14`

**Problem**

Most functions are the same `typeof value === "string" ? value.trim() : ""`, but their proliferation encourages subtle future differences in casing, whitespace, and null treatment.

**Suggested utility**

Create `server/utils/normalize.js`:

```js
normalizeText(value, ({ lowercase = false, uppercase = false } = {}));
normalizeEmail(value);
normalizeNumber(value, ({ fallback = 0, min, max } = {}));
normalizeBoolean(value, ({ fallback } = {}));
```

Keep domain-specific normalization such as question options or categories in their feature validator; do not turn this into an untyped catch-all coercion layer.

**Priority:** High  
**Estimated effort:** 4–6 hours

### BR-002 — Pagination parsing is repeated with inconsistent defaults

**Examples**

- `server/controllers/adminQuestionController.js:125` — default 10, maximum 100
- `server/controllers/adminUserController.js:68` — default 10, maximum 100
- `server/controllers/adminAttemptController.js:150` — default 10, maximum 100
- `server/controllers/adminNotificationController.js:28` — local page/limit helpers
- `server/controllers/adminActivityLogController.js:9` — default limit 15
- `server/controllers/notificationController.js:11` — default limit 20
- `server/controllers/historyController.js:9` — maximum 50
- `server/controllers/userController.js:7` — limit-only parsing

**Problem**

The same parsing and clamping logic appears in at least eight controllers. Defaults and inclusive bounds vary, and invalid values silently fall back everywhere even when a strict 400 response might be preferable for administrator APIs.

**Suggested utility**

Create `server/utils/pagination.js`:

```js
parsePagination(query, {
  defaultPage = 1,
  defaultLimit = 20,
  maxLimit = 100,
  strict = false,
} = {})

createPaginationMeta({ page, limit, total, totalField = "totalItems" })
```

Return `{page, limit, skip}` from the parser and a stable metadata object from the formatter. Keep endpoint-specific default/max values as explicit options.

**Priority:** Highest  
**Estimated effort:** 6–10 hours including controller tests

### BR-003 — Pagination response formatting is duplicated and named inconsistently

**Examples**

- `server/controllers/adminQuestionController.js:228`
- `server/controllers/adminUserController.js:214`
- `server/controllers/adminAttemptController.js:315`
- `server/controllers/adminNotificationController.js:194`
- `server/controllers/adminActivityLogController.js:123`
- `server/controllers/notificationController.js:64`
- `server/controllers/historyController.js:71`

**Problem**

Every controller calculates `totalPages`, `hasPreviousPage`, and `hasNextPage`. Total names vary (`totalQuestions`, `totalUsers`, `totalAttempts`, `totalNotifications`, `totalLogs`), preventing generic clients and making off-by-one behavior easy to change inconsistently.

**Suggested utility**

Use `createPaginationMeta()` from BR-002 and standardize on:

```json
{
  "page": 1,
  "limit": 20,
  "totalItems": 100,
  "totalPages": 5,
  "hasPreviousPage": false,
  "hasNextPage": true
}
```

If compatibility requires resource-specific total names, add them outside the shared metadata during a deprecation window.

**Priority:** Highest  
**Estimated effort:** Included in BR-002 plus 4–6 migration hours

### BR-004 — Find/count pagination query execution is repeated

**Examples**

- `server/controllers/adminQuestionController.js:197`
- `server/controllers/adminUserController.js:177`
- `server/controllers/adminAttemptController.js:241`
- `server/controllers/adminNotificationController.js:148`
- `server/controllers/adminActivityLogController.js:106`
- `server/controllers/notificationController.js:46`
- `server/controllers/historyController.js:35`

**Problem**

Each list action independently performs `Promise.all([Model.find(...).sort().skip().limit().lean(), Model.countDocuments(...)])`. Projection, population, lean mode, and stable tie-break sorting are easy to omit. Some actions also mix unrelated dashboard summary queries into the list operation.

**Suggested utility**

Create a deliberately small `server/services/pagedQueryService.js`:

```js
executePagedQuery({
  model,
  filter,
  projection,
  sort,
  page,
  limit,
  populate,
  transform,
});
```

It should enforce a stable `_id` tie-break, use `lean()`, return `{items, totalItems, pagination}`, and not know feature-specific filters. For complex aggregation pages, retain explicit pipelines rather than forcing them through this helper.

**Priority:** High  
**Estimated effort:** 10–16 hours

### BR-005 — Regex escaping and multi-field search construction are repeated

**Examples**

- `server/controllers/adminQuestionController.js:22` and line 155
- `server/controllers/adminUserController.js:18` and line 113
- `server/controllers/adminAttemptController.js:44` and search handling after line 163
- `server/controllers/adminNotificationController.js:44`
- `server/controllers/adminActivityLogController.js:25` and line 79
- `server/controllers/adminCategoryController.js:12`

**Problem**

The regex escape function is duplicated verbatim. `$or` blocks repeat the same case-insensitive substring search shape. Controllers can accidentally forget escaping or allow arbitrarily long expensive regex terms.

**Suggested utility**

Create `server/utils/mongoSearch.js`:

```js
escapeRegex(value);
createContainsSearch(search, fields, ({ maxLength = 100 } = {}));
createExactCaseInsensitiveSearch(value);
```

Return a Mongo filter fragment, not a mutable query. Enforce maximum search length. For growing collections, plan migration from unanchored regex to MongoDB text/Atlas Search rather than pretending a utility solves query performance.

**Priority:** Highest  
**Estimated effort:** 6–8 hours

### BR-006 — Enum filters and named sort maps repeat the same validation pattern

**Examples**

- `server/controllers/adminQuestionController.js:10` and line 145
- `server/controllers/adminUserController.js:8` and line 88
- `server/controllers/adminAttemptController.js:8` and line 166
- `server/controllers/adminNotificationController.js` filter constants and query parsing
- `server/controllers/adminAchievementController.js:50`

**Problem**

Controllers normalize a query value, check a Set/object, return a bespoke 400 message, then select a sort object. Sort defaults and tie-breakers differ, and allowing raw field names in one controller but named sort presets in another creates inconsistent API behavior.

**Suggested utility**

Add to `server/utils/queryParams.js`:

```js
parseEnum(value, { allowed, fallback, field, caseTransform })
parseSort(value, { sorts, fallback, tieBreaker = { _id: -1 } })
```

Prefer named public sorts (`newest`, `oldest`, `name`) mapped to internal fields. Throw a typed `ValidationError` in strict mode.

**Priority:** High  
**Estimated effort:** 6–10 hours

### BR-007 — ObjectId parameter validation is repeated in controllers

**Examples**

- `server/controllers/adminQuestionController.js:279`, 366, and 448
- `server/controllers/adminUserController.js:267`, 381, and 464
- `server/controllers/adminAttemptController.js:369` and 468
- `server/controllers/notificationController.js:118` and 187
- `server/controllers/dailyChallengeController.js:15`
- `server/controllers/quizController.js:748`
- `server/services/dailyChallengeService.js:466`

**Problem**

Every action performs `mongoose.Types.ObjectId.isValid`, constructs a 400 response, then continues. Messages and parameter names vary. Services also repeat validation because controllers do not provide a trusted typed boundary.

**Suggested middleware and utility**

Create `server/middleware/validateParams.js`:

```js
validateObjectIdParam("questionId");
validateObjectIdParams(["challengeId", "resultId"]);
```

The middleware should store the normalized value in `req.validated.params` or simply guarantee validity. Also expose `assertObjectId(value, field)` for service entry points invoked outside HTTP.

**Priority:** Highest  
**Estimated effort:** 8–12 hours

### BR-008 — Authenticated user ID extraction is repeated unnecessarily

**Examples**

- `server/controllers/quizController.js:29`
- `server/controllers/dailyChallengeController.js:11`
- `server/controllers/notificationController.js:7`
- `server/controllers/analyticsController.js:10`
- `server/controllers/profileController.js:31`
- `server/controllers/profileAvatarController.js:13`
- `server/controllers/historyController.js:7`

**Problem**

Protected routes already receive a Mongoose User document from `protect`, yet controllers repeatedly handle both `_id` and `id`, revalidate the ID, and sometimes return another authentication error. This duplicates middleware responsibility and obscures which routes are actually protected.

**Suggested change**

Define the invariant that `protect` sets:

```js
req.auth = {
  userId: req.user._id,
  role: req.user.role,
  user: req.user,
};
```

Controllers should use `req.auth.userId`. Services should receive `userId` explicitly. Keep authentication failures exclusively in middleware.

**Priority:** High  
**Estimated effort:** 6–10 hours

### BR-009 — Account name, email, and password validation is duplicated

**Examples**

- Registration: `server/controllers/authController.js:37`, 45, 53, 61, 69
- Settings profile: `server/controllers/settingsController.js:93`, 100, 107
- Profile update: `server/controllers/profileController.js:883`, 890
- Password change: `server/controllers/settingsController.js:204`, 211
- Password reset: `server/controllers/passwordResetController.js:218`, 225
- Resend verification: `server/controllers/emailVerificationController.js:162`

**Problem**

The same length/email rules are maintained in several controllers and again in the User schema. Profile endpoints already differ in whether email is accepted and what response is returned. Any future password or identity policy change requires coordinated edits.

**Suggested validators**

Create `server/validators/accountValidators.js`:

```js
validatePersonName(value, field);
validateEmail(value);
validatePassword(value, ({ field = "password" } = {}));
validatePasswordConfirmation(password, confirmation);
validateRegistrationPayload(body);
validateProfilePayload(body);
validatePasswordChangePayload(body);
```

Use a structured result or schema-validation library. Keep User schema validation as the persistence backstop, but source constraints such as 2/50 and 8/128 from shared constants.

**Priority:** Highest  
**Estimated effort:** 12–18 hours

### BR-010 — Mongoose validation and duplicate-key error responses are repeated

**Examples**

- `server/controllers/authController.js:144` and 152
- `server/controllers/settingsController.js:152`, 159, and 262
- `server/controllers/passwordResetController.js:281`
- `server/controllers/profileController.js:926`
- `server/controllers/adminQuestionController.js:343` and 421
- `server/controllers/emailVerificationController.js:209`

**Problem**

Controllers repeatedly inspect `error.code`, `error.name`, collect `Object.values(error.errors)`, and construct slightly different 400/409 envelopes. Unexpected Mongo errors can be mapped inconsistently.

**Suggested error layer**

Enhance `server/middleware/errorHandler.js` and add typed errors:

```js
class AppError
class RequestValidationError
class NotFoundError
class ConflictError

mapMongooseError(error)
```

Controllers should throw or pass typed errors; global middleware should safely map Mongoose ValidationError, CastError, and duplicate-key errors. Preserve endpoint-specific duplicate messages by attaching field/message metadata.

**Priority:** Highest  
**Estimated effort:** 12–20 hours

### BR-011 — Safe User DTOs and User projections are duplicated

**Examples**

- `server/controllers/adminUserController.js:26`
- `server/controllers/adminAchievementController.js:22`
- `server/controllers/settingsController.js:13`
- `server/models/User.js:161`
- `server/controllers/leaderboardController.js:15`
- Repeated full projection: `server/controllers/adminUserController.js:187` and 276

**Problem**

User objects are formatted differently by authentication, settings, admin users, achievements, leaderboard, and profile. Defaults, `id` conversion, full-name construction, active status, and exposed fields drift. Long projection strings are repeated.

**Suggested serializers**

Create `server/serializers/userSerializer.js` and `server/constants/projections.js`:

```js
USER_PUBLIC_FIELDS;
USER_ADMIN_FIELDS;
serializePublicUser(user);
serializeAccount(user);
serializeAdminUser(user);
serializeLeaderboardUser(user, context);
```

Serializers should be explicit allowlists; do not create one serializer that conditionally exposes every field based on loosely supplied flags.

**Priority:** High  
**Estimated effort:** 12–18 hours

### BR-012 — Score/attempt DTO formatting is repeated

**Examples**

- `server/controllers/adminAttemptController.js:48`
- `server/controllers/historyController.js:35`
- `server/controllers/quizController.js:631`
- `server/controllers/quizController.js:773`
- `server/controllers/profileController.js:638`
- `server/controllers/adminReportController.js` export-specific Score formatting

**Problem**

The same score, answer counts, accuracy, XP, timing, and completion fields are selected/formatted for submission, result, history, profile, admin attempts, and reports. Defaults and ID names vary, creating client-specific DTO knowledge.

**Suggested serializers/projections**

Create `server/serializers/scoreSerializer.js`:

```js
SCORE_SUMMARY_FIELDS;
serializeScoreSummary(score);
serializeScoreResult(score, { includeReview });
serializeAdminAttempt(score);
```

CSV row construction can consume the serializer but should remain in the reporting feature because spreadsheet formatting is presentation-specific.

**Priority:** High  
**Estimated effort:** 12–20 hours

### BR-013 — Notification DTO formatting is duplicated

**Examples**

- User notifications: `server/controllers/notificationController.js:71`
- Admin notification serializer: `server/controllers/adminNotificationController.js:48`
- Notification creation mapping: `server/services/notificationService.js:134`
- Admin notification creation mapping later in `adminNotificationController.js`

**Problem**

User/admin APIs independently map IDs, metadata, dates, and populated user fields. Notification creation also manually repeats model fields in multiple services/controllers.

**Suggested abstraction**

Create `server/serializers/notificationSerializer.js` with user/admin variants, and extend `notificationService` with:

```js
buildNotificationDocument(input);
createNotifications(inputs, ({ session } = {}));
```

Keep recipient selection in the administrator feature; it is business logic, not serialization.

**Priority:** Medium  
**Estimated effort:** 8–12 hours

### BR-014 — Duplicate leaderboard controllers execute competing User queries

**Examples**

- `server/controllers/leaderboardController.js:7`
- `server/controllers/userController.js:5`
- Routes: `server/routes/leaderboardRoutes.js:11` and `server/routes/userRoutes.js:11`

**Problem**

Two endpoints implement similar ranking with different role/active filters, sort order, limits, fields, response shapes, and total-player semantics. This is both duplicated query logic and conflicting domain logic.

**Suggested service**

Create `server/services/leaderboardService.js`:

```js
getLeaderboard({ currentUserId, limit, cursor });
getUserRank(userId);
```

Use one controller/DTO and deprecate the duplicate route. The service should own eligibility and stable tie-break rules.

**Priority:** Highest  
**Estimated effort:** 8–12 hours plus compatibility window

### BR-015 — Profile mutation logic is duplicated across two controllers

**Examples**

- `server/controllers/settingsController.js:80`
- `server/controllers/profileController.js:861`
- Routes: `server/routes/settingsRoutes.js:21` and `server/routes/profileRoutes.js:27`

**Problem**

Both endpoints validate/update names, but one also changes email. They use different persistence methods and return unrelated DTOs. Rate limiting is applied only to the settings route.

**Suggested service**

Create `server/services/accountService.js`:

```js
getAccount(userId);
updateProfile(userId, input);
changeEmail(userId, email);
changePassword(userId, input);
```

Keep response serialization separate. Make both pages call one canonical API during migration, then remove the duplicate route.

**Priority:** Highest  
**Estimated effort:** 12–18 hours

### BR-016 — Password-reset and email-verification token workflows duplicate cryptographic plumbing

**Examples**

- Reset token hashing/generation/URL: `server/controllers/passwordResetController.js:18`, 22, and 62
- Verification token hashing/generation/URL: `server/controllers/emailVerificationController.js:12`, 16, and 44

**Problem**

Both flows generate 32 random bytes, hash with SHA-256, build an origin URL, store expiry, and validate a digest. Duplicated security-sensitive code increases the chance of inconsistent origin, encoding, expiry, or token policy changes.

**Suggested utility**

Create `server/services/actionTokenService.js`:

```js
createActionToken({ bytes = 32, encoding = "hex" })
hashActionToken(rawToken)
buildApplicationUrl(path, { configuredOrigin, req })
```

Keep model field updates and email content in their feature services. The utility should never log or persist raw tokens.

**Priority:** High  
**Estimated effort:** 6–10 hours

### BR-017 — Category option queries are repeated

**Examples**

- `server/controllers/quizController.js:120`
- `server/controllers/adminController.js:109`
- `server/controllers/adminAnalyticsController.js:139`
- `server/controllers/adminQuestionController.js:210` and 497
- `server/controllers/adminAttemptController.js:262`
- `server/controllers/historyController.js:62`

**Problem**

Several features independently call `Question.distinct("category")` or `Score.distinct("category")`, sort results in JavaScript, and differ on active-question or user filters. This is partly duplication and partly distinct domain definitions of “available category.”

**Suggested read service**

Create `server/services/categoryQueryService.js` with explicit methods:

```js
getPlayableCategories();
getQuestionBankCategories();
getAttemptCategories(({ userId } = {}));
```

Do not replace them with one ambiguous `getCategories(filter)` method. Cache global option lists briefly and invalidate on question/category administration changes.

**Priority:** Medium  
**Estimated effort:** 8–12 hours

### BR-018 — Platform-wide count queries are repeated across dashboards/reports

**Examples**

- `server/controllers/adminController.js:97–109`
- `server/controllers/adminAnalyticsController.js:121–139`
- `server/controllers/adminReportController.js:86–114`
- `server/controllers/adminAchievementController.js:97–99`
- `server/controllers/adminUserController.js:199–209`
- `server/controllers/adminNotificationController.js:164`
- `server/controllers/adminAttemptController.js:260`

**Problem**

User, Score, Question, Achievement, Notification, active-user, and role counts are queried repeatedly with overlapping definitions. A single admin page can issue many scans; different pages can report different numbers if filters drift.

**Suggested read model**

Create `server/services/adminMetricsService.js`:

```js
getPlatformCounts(({ session } = {}));
getUserStatusCounts();
getQuestionCounts();
getAttemptCounts();
```

Return named, documented metrics. Add short-lived caching for expensive global metrics when exact real-time consistency is unnecessary. Keep report-window counts separate because they accept date filters.

**Priority:** High  
**Estimated effort:** 12–20 hours

### BR-019 — Score analytics aggregations are duplicated across user/admin features

**Examples**

- `server/controllers/analyticsController.js` contains multiple Score aggregates beginning at lines 91, 238, 421, and 503
- `server/controllers/profileController.js` contains aggregates beginning at lines 125, 225, 413, and 554
- `server/controllers/adminController.js` aggregates Score at lines 153, 209, 267, and 351
- `server/controllers/adminAnalyticsController.js` aggregates Score at lines 141, 220, 269, and 353
- `server/controllers/adminReportController.js:494`
- `server/services/achievementService.js:111` and 148

**Problem**

Accuracy, answer totals, XP, category performance, activity dates, and recent performance are recalculated in many pipelines with slightly different null/default rules. These are business definitions, so drift is more serious than ordinary code duplication.

**Suggested query modules**

Create composable pipeline builders under `server/queries/scoreQueries.js`:

```js
scoreMatch({ userId, dateRange, category });
answerTotalsGroup();
accuracySummaryGroup();
categoryPerformancePipeline(options);
dailyActivityPipeline(options);
```

Build feature-specific read services on these fragments. Test pipeline output against fixtures. Avoid a single parameter-heavy “analytics service” that returns every dashboard shape.

**Priority:** High  
**Estimated effort:** 24–40 hours incrementally

### BR-020 — UTC date keys, ranges, and normalized trend filling are repeated

**Examples**

- `server/controllers/adminController.js:17`, 33, and 47
- `server/controllers/adminAnalyticsController.js:14`, 32, and 43
- `server/controllers/analyticsController.js:28`, 43, and 49
- `server/controllers/profileController.js:55`, 70, and 76
- `server/models/DailyChallenge.js:236`

**Problem**

Several controllers independently calculate UTC day starts, date keys, day sequences, and fill missing aggregation dates with zero values. Boundary bugs or timezone-policy changes require edits in many locations.

**Suggested utility**

Create `server/utils/dateRange.js`:

```js
startOfUtcDay(date);
addUtcDays(date, count);
toUtcDateKey(date);
createUtcDayRange(date);
createDateSeries({ start, days });
mergeSeries(records, { key, defaults });
```

DailyChallenge statics may delegate to these pure helpers. Keep display formatting out of the backend utility.

**Priority:** High  
**Estimated effort:** 10–16 hours

### BR-021 — Numeric normalization and rounding are repeated

**Examples**

- `server/controllers/analyticsController.js:14` and 20
- `server/controllers/profileController.js:21` and 27
- `server/controllers/adminAchievementController.js:12`
- `server/services/dailyChallengeService.js:11`
- `server/services/rankService.js:5`
- `server/services/levelService.js:56`

**Problem**

`Number(value) || 0`, finite-number checks, clamping, and decimal rounding are repeated. `|| 0` also treats some values differently from explicit finite checks.

**Suggested utility**

Add pure functions to `server/utils/number.js`:

```js
toFiniteNumber(value, (fallback = 0));
toNonNegativeNumber(value, (fallback = 0));
roundNumber(value, (decimalPlaces = 2));
clamp(value, min, max);
```

Domain concepts such as XP normalization should retain domain-named wrappers around these primitives.

**Priority:** Medium  
**Estimated effort:** 4–6 hours

### BR-022 — Success/error response envelopes are manually rebuilt

**Examples**

- Authentication middleware: `server/middleware/authMiddleware.js:46–136`
- Administrator middleware: `server/middleware/adminMiddleware.js:16–31`
- Upload middleware: `server/middleware/uploadMiddleware.js:48–81`
- Nearly every controller returns `{success, message, ...}` manually
- Auth-only response helper exists at `server/utils/helpers.js:32`

**Problem**

The envelope is mostly consistent but not guaranteed. Some validation responses include `errors`, some use codes, pagination fields differ, and middleware duplicates HTML-versus-JSON authorization branching.

**Suggested utilities**

Create `server/http/responses.js` only for formatting:

```js
sendSuccess(res, { status = 200, message, data, meta })
createErrorBody(error)
```

Pair it with typed errors rather than adding helpers like `sendBadRequest()` for every status. Keep redirects in authentication middleware; extract one `respondUnauthorized(req, res, details)` helper for the repeated HTML/JSON branch.

**Priority:** Medium  
**Estimated effort:** 10–16 hours

### BR-023 — Controller actions repeat try/catch solely to call `next`

**Examples**

- `server/controllers/historyController.js:5–91`
- `server/controllers/leaderboardController.js:7–55`
- `server/controllers/notificationController.js` every action
- Most administrator controllers

**Problem**

Almost every async action is wrapped in `try { ... } catch (error) { return next(error); }`. Express 5 automatically forwards rejected async handler promises, so these wrappers add noise unless the catch maps a known feature error.

**Suggested change**

Because the project uses Express 5, remove pass-through catches incrementally. Retain catches only for meaningful compensation or translation, preferably moved into services/global error mapping. If framework compatibility changes, use one tested `asyncHandler` wrapper rather than manual repetition.

**Priority:** Medium  
**Estimated effort:** 6–10 hours after error centralization

### BR-024 — Route protection declarations repeat and vary stylistically

**Examples**

- Administrator routers consistently repeat `router.use(protect); router.use(adminOnly);`
- User routers alternate between `router.use(protect)` and per-route `protect`
- Page routes repeat `protect, adminOnly, render` in `server/app.js`

**Problem**

The repetition is small, but inconsistent placement makes route audits harder. Adding an unprotected route to the wrong position can become a security bug. Page routes add extensive boilerplate to `app.js`.

**Suggested structure**

- Mount authentication once at feature-router scope whenever every route shares it.
- Create public/user/admin page routers.
- Optionally add `createProtectedRouter({ roles })`, but keep middleware visible in each router file; avoid a magical route DSL.

**Priority:** Medium  
**Estimated effort:** 8–12 hours

### BR-025 — Constants are duplicated between schemas, services, and controllers

**Examples**

- Notification types: `server/models/Notification.js:16`, `server/services/notificationService.js:4`, and admin notification controller constants
- Question difficulties: `server/models/Question.js:37`, `server/controllers/adminQuestionController.js:8`, and DailyChallenge logic
- User roles: `server/models/User.js:75` and `server/controllers/adminUserController.js:8`
- Quiz question limits/durations appear in controllers, daily service, model, and client contracts

**Problem**

The database accepts one enum while controllers/services may accept another after future edits. The empty `server/constants` directory indicates the intended boundary was never adopted.

**Suggested constants**

Create explicit modules:

```text
server/constants/account.js
server/constants/question.js
server/constants/notification.js
server/constants/quiz.js
```

Export frozen arrays plus Sets where needed. Mongoose enums should consume the arrays; validation should consume the same values. Do not centralize unrelated strings such as response messages.

**Priority:** High  
**Estimated effort:** 6–10 hours

## Recommended reusable modules

### Core request/query layer

```text
server/utils/normalize.js
server/utils/number.js
server/utils/dateRange.js
server/utils/pagination.js
server/utils/queryParams.js
server/utils/mongoSearch.js
server/middleware/validateParams.js
```

These modules should be pure or narrowly tied to Express. They are suitable for direct unit testing.

### HTTP/error layer

```text
server/errors/AppError.js
server/errors/RequestValidationError.js
server/errors/NotFoundError.js
server/errors/ConflictError.js
server/http/responses.js
server/middleware/errorHandler.js
```

The global handler should be the only place that maps unexpected persistence errors into public envelopes.

### Validation layer

```text
server/validators/accountValidators.js
server/validators/questionValidators.js
server/validators/notificationValidators.js
server/validators/queryValidators.js
```

Request validators should produce normalized typed values, not merely Boolean results.

### Serialization layer

```text
server/serializers/userSerializer.js
server/serializers/scoreSerializer.js
server/serializers/notificationSerializer.js
server/serializers/dailyChallengeSerializer.js
server/constants/projections.js
```

Serializers should be allowlists and remain separate from MongoDB query execution.

### Feature/query services

```text
server/services/pagedQueryService.js
server/services/accountService.js
server/services/leaderboardService.js
server/services/categoryQueryService.js
server/services/adminMetricsService.js
server/services/actionTokenService.js
server/queries/scoreQueries.js
```

Feature services should express business intent. Query builders should compose tested aggregation fragments without depending on Express request/response objects.

## What should not be generalized

- Do not introduce a base CRUD controller. Question, User, Notification, and Score mutations have different authorization and integrity requirements.
- Do not accept arbitrary client-provided Mongo field names, filters, or sort objects through a generic query utility.
- Do not collapse public, account, admin, and leaderboard User DTOs into one flag-heavy serializer.
- Do not force complex analytics aggregations through a generic repository abstraction that hides pipelines and explain plans.
- Do not move all constants or messages into one global file; group only genuine shared domain invariants.
- Do not combine source-data queries and cached dashboard read models without documenting freshness semantics.

## Suggested implementation sequence

### Step 1 — Low-risk primitives

1. Add shared constants.
2. Add normalize, number, date, regex-search, pagination, and query-parameter utilities.
3. Unit-test edge cases before migrating controllers.

### Step 2 — Request and error boundaries

1. Add ObjectId parameter middleware and `req.auth` invariant.
2. Add account/question/notification request validators.
3. Add typed errors and centralized Mongoose error mapping.
4. Remove pass-through try/catch wrappers only after the error tests pass.

### Step 3 — List endpoints

Migrate one controller at a time in this order:

1. activity logs;
2. notifications;
3. history;
4. admin questions;
5. admin users;
6. admin attempts.

For each migration, snapshot the existing API contract, test filtering/sorting/pagination, then adopt shared parsing/search/meta helpers. Introduce `executePagedQuery` only after at least two migrations demonstrate the correct common interface.

### Step 4 — DTOs and duplicate feature APIs

1. Add User, Score, and Notification serializers/projections.
2. Consolidate the leaderboard service/route.
3. Consolidate profile/settings account mutations.
4. Extract action-token cryptographic plumbing.

### Step 5 — Read-model consolidation

1. Extract category option queries.
2. Extract documented platform counts.
3. Build/test reusable Score aggregation fragments.
4. Refactor dashboard, analytics, profile, achievement, and report queries incrementally.

## Testing required for the refactor

- Table-driven tests for page/limit bounds, enum parsing, sort mapping, and regex escaping.
- ObjectId middleware tests for valid, malformed, missing, and castable values.
- Account validation tests proving identical rules across registration, profile, settings, and reset flows.
- Error middleware tests for validation, duplicate key, cast, typed application, and unexpected errors.
- Serializer snapshot/allowlist tests proving sensitive fields are never exposed.
- Contract tests before and after every list-controller migration.
- Search tests containing regex metacharacters and overly long input.
- Aggregation fixture tests ensuring dashboard/profile/report metrics retain identical definitions.
- Leaderboard eligibility, tie-break, total count, current rank, and pagination tests.
- Token utility tests proving raw action tokens are never stored or logged.

## Expected outcome

Implementing the recommended primitives and focused services should remove hundreds of lines of repeated controller plumbing while making behavior more consistent. More importantly, validation, authorization assumptions, error mapping, pagination contracts, and metric definitions become independently testable. The refactor should proceed incrementally: preserve endpoint contracts first, introduce a shared abstraction only after duplicate implementations have proven the common shape, and keep feature-specific business logic explicit.
