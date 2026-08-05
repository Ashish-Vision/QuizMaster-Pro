# QuizMaster-Pro Full Project Audit

Audit date: 2026-08-05  
Scope: application source, routes, controllers, models, services, middleware, browser JavaScript, views, configuration, scripts, and package metadata.  
Method: read-only static review of the current working tree, JavaScript syntax checking, and production dependency audit.  

Status vocabulary:

- **Confirmed**: the current source contains the described behavior.
- **Already fixed**: evidence of the previously suspected issue is no longer present.
- **False positive**: the current implementation does not support the suspected issue.

## Executive summary

The application has three critical functional/security defects: standard quiz submissions are replayable for unlimited XP, the administrator question router invokes category handlers, and the ordinary user dashboard calls an administrator-only endpoint. Quiz completion also spans multiple non-transactional writes, which can leave scores, user statistics, daily challenges, achievements, and notifications inconsistent. Other material risks include persistent unsafe notification navigation, spreadsheet formula injection, sessions surviving password changes, unbounded embedded daily-challenge completions, unbounded leaderboard/report queries, and substantial duplication that has already caused copy/paste regressions.

The current production dependency audit (`npm audit --omit=dev`) reported 0 known vulnerabilities across 158 production dependencies. All JavaScript files passed `node --check`. These checks do not mitigate the application-level findings below.

## Critical findings

### QM-001 — Standard quiz submissions can be replayed for unlimited XP

- **Severity:** Critical
- **Status:** Confirmed
- **Exact location:** `server/controllers/quizController.js:139`, `server/controllers/quizController.js:204`, `server/controllers/quizController.js:351`, `server/controllers/quizController.js:487`, `server/controllers/quizController.js:545`
- **Description:** The server does not create or validate a server-issued quiz attempt. A submission consists of a client-provided category and question IDs; every accepted request creates another score and increments XP.
- **Evidence:** `startQuiz` returns questions but no attempt ID at line 189. `submitQuiz` accepts `category` and `answers` directly at lines 217-223. The database query at lines 351-367 checks only that IDs exist in the category. `Score.create` runs at line 487 and `user.totalXp += totalXpEarned` runs at line 545. There is no used/expired attempt state or idempotency key for standard quizzes. A user can replay a known correct payload repeatedly.
- **Recommended fix:** Add a `QuizAttempt` model containing an unpredictable attempt ID, user, server-selected question set, expiry, and status. Submit only against that attempt and atomically transition `started` to `completed` under a unique/idempotent constraint.

### QM-002 — Administrator question API is wired to category handlers

- **Severity:** Critical
- **Status:** Confirmed
- **Exact location:** `server/routes/adminQuestionRoutes.js:5`, `server/routes/adminQuestionRoutes.js:19`, `server/routes/adminQuestionRoutes.js:21`; intended handlers at `server/controllers/adminQuestionController.js:513`
- **Description:** `/api/admin/questions` imports `adminCategoryController`, so the implemented question CRUD controller is unreachable through this router.
- **Evidence:** Lines 5-9 import `getCategories`, `renameCategory`, and `deleteCategory`. GET `/` calls `getCategories`; PATCH/DELETE `/:categoryName` call category mutations. The router defines no POST, question-by-ID GET, or PUT route, even though `adminQuestionController` exports `getQuestions`, `getQuestionById`, `createQuestion`, `updateQuestion`, `deleteQuestion`, and `getQuestionMetadata` at lines 513-520.
- **Recommended fix:** Import `adminQuestionController` and define the intended metadata, list, create, read, update, and delete routes. Add route-contract tests that assert every HTTP method maps to the expected controller.

### QM-003 — Ordinary user dashboard calls an administrator-only API

- **Severity:** Critical
- **Status:** Confirmed
- **Exact location:** `client/views/dashboard.ejs:1017`, `client/js/dashboard.js:592`, `client/js/dashboard.js:610`, `client/js/dashboard.js:625`
- **Description:** The normal dashboard loads a script whose state, messages, and data request are for the administrator dashboard.
- **Evidence:** The user view loads `/js/dashboard.js` at lines 1017-1020. That script defines `loadAdminDashboard` at line 592 and fetches `/api/admin/dashboard` at line 610. A normal user's 403 response redirects back to `/dashboard` at lines 625-627, creating a broken/repeating dashboard flow.
- **Recommended fix:** Restore a user-specific dashboard script and endpoint contract. Keep administrator code only under `client/js/admin/`. Add browser smoke tests for both roles.

## High-severity findings

### QM-004 — Quiz completion is non-transactional and can corrupt state

- **Severity:** High
- **Status:** Confirmed
- **Exact location:** `server/controllers/quizController.js:487`, `server/controllers/quizController.js:505`, `server/controllers/quizController.js:545`, `server/controllers/quizController.js:555`, `server/controllers/quizController.js:563`, `server/controllers/quizController.js:582`, `server/controllers/quizController.js:707`
- **Description:** Score creation, daily completion, user counters, achievements, and notifications are separate operations without a MongoDB session/transaction.
- **Evidence:** The score is created at line 487, daily completion occurs at line 506, user fields are mutated at lines 545-553 and saved at line 555, then achievements and notifications run later. The catch block at lines 707-720 deletes only the score. For example, daily completion can succeed and `user.save()` can fail, leaving a completion that references a deleted score. Concurrent submissions can also lose increments because counters use read-modify-save.
- **Recommended fix:** Use a MongoDB transaction for attempt transition, score, daily completion, and atomic user `$inc` updates. Publish notification/achievement work through a post-commit outbox with idempotent consumers.

### QM-005 — Password changes do not invalidate existing JWT sessions

- **Severity:** High
- **Status:** Confirmed
- **Exact location:** `server/utils/helpers.js:12`, `server/utils/helpers.js:18`, `server/middleware/authMiddleware.js:59`, `server/controllers/passwordResetController.js:266`
- **Description:** JWTs contain only `userId` and can remain valid for seven days after a password reset or password change.
- **Evidence:** Token generation signs only `{ userId }` at lines 12-19. Authentication verifies the signature and loads the user at `authMiddleware.js:59-74`, but checks no password-change timestamp or token version. Password reset changes the password at line 266 without revoking outstanding tokens.
- **Recommended fix:** Add `tokenVersion` or `passwordChangedAt`, include/check it in every JWT, increment/update it for password changes, resets, role changes, and explicit global logout. Prefer shorter access-token lifetimes and rotated refresh tokens for stronger session control.

### QM-006 — Administrator notification links permit unsafe navigation schemes

- **Severity:** High
- **Status:** Confirmed
- **Exact location:** `server/controllers/adminNotificationController.js:250`, `server/controllers/adminNotificationController.js:294`, `server/controllers/adminNotificationController.js:337`, `client/js/notifications.js:203`, `client/js/notifications.js:212`
- **Description:** An administrator-supplied notification link is length-checked but not restricted to safe same-origin paths or HTTPS URLs, then assigned directly to `window.location.href` when a user clicks it.
- **Evidence:** `link` is normalized at line 250 and only checked for a maximum length at lines 294-299. It is stored at line 343. The client treats any truthy value as navigable and assigns it at line 212 (and again at line 226). Values such as `javascript:` or hostile external URLs are not rejected.
- **Recommended fix:** Accept only parsed, same-origin relative paths beginning with a single `/`, or use an explicit HTTPS-origin allowlist. Reject `javascript:`, `data:`, protocol-relative, credential-bearing, and malformed URLs on the server.

### QM-007 — CSV exports permit spreadsheet formula injection

- **Severity:** High
- **Status:** Confirmed
- **Exact location:** `server/controllers/adminReportController.js:34`, `server/controllers/adminReportController.js:47`, `server/controllers/adminReportController.js:275`, `server/controllers/adminReportController.js:362`, `server/controllers/adminReportController.js:454`
- **Description:** CSV encoding quotes delimiters but does not neutralize cells beginning with spreadsheet formula characters.
- **Evidence:** `formatCsvValue` at lines 34-50 only handles comma, quote, LF, and CR. Reports place user-controlled names/emails (line 275 onward), attempt categories (line 362 onward), and question/options/explanations (line 454 onward) directly into rows. Values beginning with `=`, `+`, `-`, `@`, tab, or carriage return may be interpreted as formulas by spreadsheet software.
- **Recommended fix:** Apply a spreadsheet-safe cell encoder that prefixes formula-like values with an apostrophe or another documented neutralizer before normal CSV quoting. Add malicious-cell tests for every export.

### QM-008 — Inactive questions are still selected and accepted

- **Severity:** High
- **Status:** Confirmed
- **Exact location:** `server/controllers/quizController.js:159`, `server/controllers/quizController.js:161`, `server/controllers/quizController.js:351`, `server/services/dailyChallengeService.js:162`, `server/services/dailyChallengeService.js:228`
- **Description:** The `Question.isActive` soft-deletion flag is not applied to standard quiz selection, standard submission validation, daily group eligibility, or daily question selection.
- **Evidence:** Standard `$match` contains only `category` at lines 161-163. Submission lookup contains IDs and category at lines 351-357. Daily challenge grouping matches category/difficulty but not activity at lines 162-173, and `selectChallengeQuestions` matches only category at lines 228-233.
- **Recommended fix:** Add a consistent `isActive: { $ne: false }` predicate to all new quiz/challenge selection and submission paths. Preserve inactive questions only for historical result population.

## Medium-severity security and reliability findings

### QM-009 — Content Security Policy is disabled

- **Severity:** Medium
- **Status:** Confirmed
- **Exact location:** `server/app.js:73`, `server/app.js:75`
- **Description:** Helmet is enabled but its Content Security Policy is explicitly disabled, removing an important defense against script injection.
- **Evidence:** The Helmet configuration sets `contentSecurityPolicy: false` at line 75. The client also uses many `innerHTML` templates, increasing the value of CSP as defense in depth.
- **Recommended fix:** Introduce a restrictive nonce/hash-based CSP, remove inline-script/style dependencies, and allow only required asset origins. Roll it out first in report-only mode if necessary.

### QM-010 — JWT verification omits algorithm, issuer, and audience constraints

- **Severity:** Medium
- **Status:** Confirmed
- **Exact location:** `server/utils/helpers.js:12`, `server/middleware/authMiddleware.js:59`
- **Description:** Signing and verification rely on library defaults and validate no token issuer or audience.
- **Evidence:** `jwt.sign` specifies only expiry, while `jwt.verify` receives only token and secret. No `algorithms`, `issuer`, or `audience` options are configured.
- **Recommended fix:** Pin an algorithm such as HS256 consistently and validate issuer/audience. Validate minimum secret strength and all required auth configuration during startup.

### QM-011 — Security email URLs can trust the request Host header

- **Severity:** Medium
- **Status:** Confirmed
- **Exact location:** `server/controllers/passwordResetController.js:21`, `server/controllers/passwordResetController.js:24`, `server/controllers/emailVerificationController.js:16`, `server/controllers/emailVerificationController.js:19`
- **Description:** If configured origins are missing, password-reset and email-verification links are constructed from request protocol and Host.
- **Evidence:** Both URL builders fall back to ``${req.protocol}://${req.get("host")}``. In a deployment with permissive Host/proxy routing, a crafted request can cause security emails to contain attacker-controlled origins.
- **Recommended fix:** Require and URL-validate one canonical `APP_ORIGIN` in production at startup. Do not generate security links from request headers.

### QM-012 — Rate limiting is local to each Node process

- **Severity:** Medium
- **Status:** Confirmed
- **Exact location:** `server/middleware/rateLimitMiddleware.js:5`, `server/middleware/rateLimitMiddleware.js:6`
- **Description:** Rate limiters do not configure a shared store, so they use the package's in-memory default.
- **Evidence:** `createJsonRateLimiter` calls `rateLimit` with window, limit, headers, skip behavior, and handler, but no `store`. Limits reset on restart and are independent across replicas.
- **Recommended fix:** Use a Redis-backed production store and rate-limit sensitive flows by normalized account/email in addition to IP. Ensure proxy trust is configured to match the actual deployment topology.

### QM-013 — Avatar validation trusts client-provided MIME metadata

- **Severity:** Medium
- **Status:** Confirmed
- **Exact location:** `server/middleware/uploadMiddleware.js:17`, `server/middleware/uploadMiddleware.js:18`, `server/middleware/uploadMiddleware.js:30`
- **Description:** Upload acceptance relies on Multer's `file.mimetype`, which originates from multipart metadata rather than decoded file content.
- **Evidence:** `avatarFileFilter` checks only whether `file.mimetype` appears in `ALLOWED_AVATAR_MIME_TYPES`. There is no magic-byte check, safe image decode/re-encode, dimension cap, or metadata stripping.
- **Recommended fix:** Detect file type from content, decode and re-encode supported images, strip metadata, and enforce dimensions/pixel count as well as byte size.

### QM-014 — Development password-reset responses expose the raw reset URL

- **Severity:** Medium
- **Status:** Confirmed
- **Exact location:** `server/controllers/passwordResetController.js:116`, `server/controllers/passwordResetController.js:120`
- **Description:** Any environment whose `NODE_ENV` is not exactly `production` returns the usable reset URL in the HTTP response.
- **Evidence:** Lines 116-124 add `development.resetUrl` whenever `NODE_ENV !== "production"`. A staging or misconfigured public deployment therefore exposes account-reset bearer tokens to the requester.
- **Recommended fix:** Gate this behavior behind an explicit local-only flag that defaults off and refuse it when bound publicly. Prefer capturing email in a local mail sandbox rather than returning bearer tokens through the API.

### QM-015 — CORS permits requests with no Origin header

- **Severity:** Low
- **Status:** Confirmed
- **Exact location:** `server/app.js:92`, `server/app.js:98`
- **Description:** The CORS callback automatically allows requests lacking `Origin`.
- **Evidence:** Lines 98-100 return `callback(null, true)` for any missing Origin. This is not a browser CORS bypass by itself—non-browser clients are not constrained by CORS—but it weakens any assumption that this middleware is an origin authorization boundary.
- **Recommended fix:** Treat CORS only as a browser control, not authentication. If API policy requires origin enforcement, apply a separate explicit middleware to state-changing browser requests while retaining necessary health/server-to-server exceptions.

## Performance and scalability findings

### QM-016 — Leaderboard loads and maps all eligible users

- **Severity:** High
- **Status:** Confirmed
- **Exact location:** `server/controllers/leaderboardController.js:11`, `server/controllers/leaderboardController.js:24`, `server/controllers/leaderboardController.js:26`, `server/controllers/leaderboardController.js:43`
- **Description:** The leaderboard reads every active non-admin user, maps the complete result, and slices only after loading it all.
- **Evidence:** The query at lines 11-24 has no `.limit()`. `users.map` ranks the entire collection at line 26; only line 43 selects the top ten, and line 45 scans the complete array for the current user.
- **Recommended fix:** Query only the displayed top entries using a compound ranking index. Determine current-user rank with an indexed count/rank query or maintain a materialized leaderboard.

### QM-017 — Daily challenge completions form an unbounded embedded array

- **Severity:** High
- **Status:** Confirmed
- **Exact location:** `server/models/DailyChallenge.js:162`, `server/services/dailyChallengeService.js:522`, `server/services/dailyChallengeService.js:537`
- **Description:** Every participant's completion is pushed into one daily challenge document.
- **Evidence:** `completions` is an embedded array at model lines 162-165. Completion uses `$push` at service lines 522-540. Document size, write amplification, array scanning, and index cost grow with participation and ultimately encounter MongoDB's document-size limit.
- **Recommended fix:** Move completions to a `DailyChallengeCompletion` collection with a unique compound index on `{ challenge: 1, user: 1 }` and appropriate challenge/date indexes.

### QM-018 — Offset pagination degrades on deep pages

- **Severity:** Medium
- **Status:** Confirmed
- **Exact location:** `server/controllers/historyController.js:33`, `server/controllers/historyController.js:56`, `server/controllers/notificationController.js:44`, `server/controllers/notificationController.js:52`, `server/controllers/adminQuestionController.js:195`, `server/controllers/adminQuestionController.js:204`
- **Description:** Multiple potentially large collections use `.skip(offset)` pagination, whose work grows with the requested page.
- **Evidence:** History, notifications, and admin question queries calculate `(page - 1) * limit` and pass it to `.skip()`. Similar patterns exist for users, attempts, activity logs, and admin notifications.
- **Recommended fix:** Use cursor/keyset pagination based on each deterministic sort pair, such as `(createdAt, _id)` or `(completedAt, _id)`.

### QM-019 — Report exports load entire result sets and CSVs into memory

- **Severity:** Medium
- **Status:** Confirmed
- **Exact location:** `server/controllers/adminReportController.js:53`, `server/controllers/adminReportController.js:56`, `server/controllers/adminReportController.js:266`, `server/controllers/adminReportController.js:345`, `server/controllers/adminReportController.js:446`, `server/controllers/adminReportController.js:680`
- **Description:** Exports use unbounded queries, build complete row arrays, then build another complete CSV string before sending it.
- **Evidence:** `createCsv` maps all rows and joins them at lines 53-58. Users, questions, and achievements have no limit; attempts can include up to a year of data. Large exports can cause high memory use and long event-loop pauses.
- **Recommended fix:** Stream MongoDB cursors through a CSV encoder to the response, enforce sensible date/row limits, and use asynchronous export jobs for large reports.

### QM-020 — Administrator question search uses collection-scan-prone regexes

- **Severity:** Medium
- **Status:** Confirmed
- **Exact location:** `server/controllers/adminQuestionController.js:155`, `server/controllers/adminQuestionController.js:158`, `server/controllers/adminQuestionController.js:161`
- **Description:** Search applies unanchored case-insensitive regular expressions across question, category, and explanation fields.
- **Evidence:** Although metacharacters are correctly escaped, `$regex: safeSearch, $options: "i"` is applied without an anchored prefix and generally cannot use ordinary indexes efficiently.
- **Recommended fix:** Use a text/search index or a normalized searchable field. Cap search length and retain client debounce for request volume control.

### QM-021 — User analytics repeatedly aggregate the same score collection

- **Severity:** Medium
- **Status:** Confirmed
- **Exact location:** `server/controllers/profileController.js:117`, `server/controllers/profileController.js:225`, `server/controllers/profileController.js:413`, `server/controllers/profileController.js:554`, `server/controllers/analyticsController.js:91`, `server/controllers/analyticsController.js:238`
- **Description:** Profile and analytics responses perform multiple separate aggregations over the same user's scores for related metrics.
- **Evidence:** The cited functions independently calculate totals, category metrics, activity series, and streak/date information, producing repeated scans and very large controllers (`profileController.js` is 945 lines; `analyticsController.js` is 935 lines).
- **Recommended fix:** Combine compatible summaries using `$facet`, ensure compound user/date/category indexes support the pipelines, cache stable summaries, or update materialized per-user/per-day statistics on completion.

## Duplication, naming, and architectural findings

### QM-022 — Two leaderboard endpoints implement conflicting rules

- **Severity:** Medium
- **Status:** Confirmed
- **Exact location:** `server/controllers/leaderboardController.js:7`, `server/controllers/leaderboardController.js:11`, `server/controllers/userController.js:5`, `server/controllers/userController.js:16`, `server/app.js:350`, `server/app.js:352`
- **Description:** `/api/leaderboard` and `/api/users/leaderboard` provide two incompatible leaderboard implementations.
- **Evidence:** The main controller filters `isActive: true` and `role: "user"`, includes avatars, loads all users, and returns top ten plus current user. `userController` uses `User.find({})`, applies a limit, excludes avatars, includes admins/disabled users, and has different tie ordering. `totalPlayers` consequently has different semantics.
- **Recommended fix:** Retain one canonical endpoint backed by one leaderboard service and one documented ranking/tie policy. Rename or remove `userController.js` if it has no user-resource responsibility.

### QM-023 — Browser utility and rendering code is widely duplicated

- **Severity:** Medium
- **Status:** Confirmed
- **Exact location:** `client/js/dashboard.js:112`, `client/js/admin/dashboard.js:125`, `client/js/admin/questions.js:108`, `client/js/admin/users.js:83`, `client/js/admin/activity-logs.js:77`, `client/js/admin/notifications.js:85`
- **Description:** Escaping, date formatting, initials, visibility toggles, API parsing, pagination, avatars, and modal behavior are independently copied across page scripts.
- **Evidence:** The cited files each reimplement `escapeHtml`; repository-wide, `showElement`/`toggleElement`, `formatDate`, and `getInitials` also appear repeatedly. The dashboard and question-route defects demonstrate the maintenance risk of page-level copying.
- **Recommended fix:** Introduce shared browser modules for safe DOM rendering, API requests, dates, avatars, pagination, and modal primitives. Prefer DOM construction with `textContent` over interpolated `innerHTML`.

### QM-024 — Achievement rendering interpolates database fields into innerHTML

- **Severity:** Medium
- **Status:** Confirmed
- **Exact location:** `client/js/achievements.js:140`, `client/js/achievements.js:144`, `client/js/achievements.js:159`, `client/js/achievements.js:162`, `client/js/achievements.js:164`
- **Description:** Achievement icon, category label, title, and description are interpolated without HTML escaping.
- **Evidence:** `createAchievementCard` assigns a template to `article.innerHTML`; the cited dynamic fields are inserted directly. Current definitions may be application-controlled, but a compromised/imported database record or future admin editing path would become stored DOM injection. Other admin scripts explicitly escape equivalent fields, showing inconsistent handling.
- **Recommended fix:** Create elements and set `textContent`, or use one reviewed escaping/rendering helper. Reinstate CSP as defense in depth.

### QM-025 — Server-side normalization and identity helpers are duplicated

- **Severity:** Low
- **Status:** Confirmed
- **Exact location:** `server/controllers/authController.js:11`, `server/controllers/profileController.js:17`, `server/controllers/settingsController.js:7`, `server/controllers/adminUserController.js:14`, `server/controllers/quizController.js:29`, `server/controllers/analyticsController.js:10`
- **Description:** `normalizeText`, `normalizeNumber`, `roundNumber`, `getUserId`, ObjectId normalization, and pagination parsing are repeatedly reimplemented with subtly different behavior.
- **Evidence:** The cited controllers define local variants instead of importing a common, tested contract. Repeated pagination code also uses different limits and fallback behavior.
- **Recommended fix:** Extract focused modules for request normalization, ID validation, and pagination. Keep domain validation close to its domain rather than creating one unstructured utility file.

### QM-026 — Profile updates are duplicated across two controllers

- **Severity:** Low
- **Status:** Confirmed
- **Exact location:** `server/controllers/profileController.js:861`, `server/controllers/profileController.js:872`, `server/controllers/settingsController.js:72`, `server/controllers/settingsController.js:80`
- **Description:** Profile and settings APIs both update first/last names and independently enforce overlapping validation.
- **Evidence:** Both controllers normalize and validate the same fields, then update `User`. This gives one domain operation two API contracts and creates validation drift risk.
- **Recommended fix:** Move account-profile mutation and validation into one service and expose one canonical endpoint, or make both thin endpoints call that same service.

### QM-027 — Empty tracked placeholders misrepresent the architecture

- **Severity:** Low
- **Status:** Confirmed
- **Exact location:** `README.md:1`, `docker-compose.yml:1`, `client/index.html:1`, `client/js/api.js:1`, `server/config/env.js:1`, `server/services/avatarService.js:1`, `server/services/quizService.js:1`, `server/utils/validator.js:1`
- **Description:** These files are zero bytes. Names such as `quizService`, `avatarService`, `env`, and `validator` imply boundaries that do not exist while their logic remains in large controllers.
- **Evidence:** Filesystem inspection reports all cited files with size 0. The README and Docker Compose file therefore provide no setup or deployment contract.
- **Recommended fix:** Implement and use the intended boundaries or remove the placeholders. Document setup, environment variables, architecture, scripts, database requirements, and operational procedures in the README.

### QM-028 — Package metadata contains unused dependencies and stale paths

- **Severity:** Low
- **Status:** Confirmed
- **Exact location:** `package.json:5`, `package.json:7`, `package.json:8`, `package.json:23`, `package.json:37`, `package.json:38`
- **Description:** Metadata points to nonexistent project paths, and declared dependencies include packages not imported by application source.
- **Evidence:** `main` is `index.js`, but no root `index.js` exists. `directories.doc` and `directories.test` point to nonexistent `docs` and `tests`. Source search found no imports of `bcryptjs`, `socket.io`, or `uuid`; the application uses `bcrypt` instead.
- **Recommended fix:** Remove unused dependencies after confirming no deployment-time consumer relies on them. Correct `main` to `server/server.js` or omit it, remove stale directory declarations, and document actual entry points.

### QM-029 — No automated test suite, lint script, or CI safety net

- **Severity:** High
- **Status:** Confirmed
- **Exact location:** `package.json:10`, `package.json:15`, `package.json:42`
- **Description:** The project declares ESLint and formatting tooling but exposes no test, lint, format-check, or CI scripts, and no test files are present.
- **Evidence:** `scripts` contains start, dev, seed/reset, and email connection commands only. The declared `tests` directory does not exist. The critical route and dashboard copy/paste regressions are directly testable failures that currently have no automated guard.
- **Recommended fix:** Add unit, integration, route-contract, and browser smoke tests. Add scripts for `test`, `lint`, `format:check`, and dependency auditing, then run them in CI. Prioritize replay/idempotency, concurrent completion, route mappings, role/page contracts, session revocation, unsafe links, CSV injection, and inactive-question exclusion.

## Findings assessed as already fixed or false positives

### QM-030 — Cross-user result access

- **Severity:** High if present
- **Status:** Already fixed
- **Exact location:** `server/controllers/quizController.js:743`, `server/controllers/quizController.js:745`
- **Description:** A suspected insecure direct-object reference in result retrieval is not present in the current implementation.
- **Evidence:** `Score.findOne` filters by both `_id: resultId` and `user: userId`, so an authenticated user cannot retrieve another user's result merely by knowing its ID.
- **Recommended fix:** Preserve this ownership predicate and add an integration test proving a foreign result ID returns 404.

### QM-031 — Cross-user notification mutation

- **Severity:** High if present
- **Status:** Already fixed
- **Exact location:** `server/controllers/notificationController.js:125`, `server/controllers/notificationController.js:128`, `server/controllers/notificationController.js:194`, `server/controllers/notificationController.js:196`
- **Description:** Notification read/delete operations correctly scope records to the authenticated user.
- **Evidence:** Both `findOneAndUpdate` and `findOneAndDelete` filter by notification ID and `user: getUserId(req)`.
- **Recommended fix:** Preserve the ownership filters and cover them with authorization tests.

### QM-032 — Plaintext password-reset or verification tokens in MongoDB

- **Severity:** High if present
- **Status:** False positive
- **Exact location:** `server/controllers/passwordResetController.js:17`, `server/controllers/passwordResetController.js:63`, `server/controllers/emailVerificationController.js:10`, `server/controllers/emailVerificationController.js:46`
- **Description:** Reset and verification bearer tokens are not stored in plaintext.
- **Evidence:** Both flows hash raw random tokens with SHA-256 before assigning them to user fields. The raw token is used only in the delivered URL.
- **Recommended fix:** Retain hashed storage, short expirations, single use, and constant/generic public responses.

### QM-033 — NoSQL injection through administrator question regex search

- **Severity:** High if present
- **Status:** False positive
- **Exact location:** `server/controllers/adminQuestionController.js:22`, `server/controllers/adminQuestionController.js:155`, `server/controllers/adminQuestionController.js:156`
- **Description:** The current text search does not interpolate unescaped regex metacharacters and does not accept a client-provided MongoDB operator object for the search value.
- **Evidence:** `normalizeText` requires strings and `escapeRegex` escapes regex metacharacters before constructing `$regex`. The remaining issue is query performance, tracked separately as QM-020.
- **Recommended fix:** Preserve strict scalar normalization and escaping while migrating to indexed search.

## Recommended remediation order

1. Fix QM-001, QM-002, and QM-003 immediately.
2. Make quiz completion transactional and idempotent (QM-004).
3. Revoke sessions on security changes (QM-005).
4. Validate notification destinations and harden CSV output (QM-006 and QM-007).
5. Exclude inactive questions everywhere (QM-008).
6. Separate daily completions and repair leaderboard/report scalability (QM-016 through QM-019).
7. Add automated tests/CI before further feature work (QM-029).
8. Consolidate duplicate frontend/server logic and clarify architecture (QM-022 through QM-028).

## Positive controls observed

- Passwords use bcrypt with 12 rounds (`server/models/User.js:139-147`).
- Passwords and security-token fields are excluded from queries by default (`server/models/User.js:48-64`, `server/models/User.js:116-126`).
- Authentication cookies are HTTP-only, SameSite=Lax, and secure in production (`server/utils/helpers.js:23-32`).
- Reset and verification tokens are generated with cryptographic randomness and stored as hashes.
- Administrator routers generally apply authentication and administrator authorization centrally.
- JSON/urlencoded request bodies and avatar byte size are capped.
- Current production dependency audit reports no known advisories.

