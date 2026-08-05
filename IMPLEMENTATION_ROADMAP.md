# QuizMaster Pro — Implementation Roadmap

Source: `ARCHITECTURE_REVIEW.md`  
Prepared: 2026-08-05  
Scope: All 31 architectural findings, ranked from highest to lowest expected return on investment.

## Estimation assumptions

- Estimates are engineering hours, not calendar time.
- They include implementation, focused automated tests, review fixes, and concise documentation.
- They exclude product discovery, infrastructure procurement, long-running production migrations, and external security audits.
- Overlapping work is estimated at its incremental cost. For example, AR-003 is cheaper when implemented inside AR-002 than as a separate redesign.
- A transaction-capable MongoDB environment and normal access to CI/deployment configuration are assumed.
- Recommended planning contingency: **20–30%**, especially for Phases 1 and 2.

## ROI ranking — highest to lowest

ROI considers risk reduction, user/business impact, implementation cost, dependency value, and the amount of future rework avoided.

| Rank | Finding | Improvement | Phase | Hours | ROI rationale |
|---:|---|---|---:|---:|---|
| 1 | AR-001 | Enforce server-issued QuizSessions and one-time submissions | 1 | 32 | Eliminates direct XP farming and establishes the core attempt boundary. |
| 2 | AR-002 | Make quiz completion transactional | 1 | 40 | Prevents the most damaging cross-collection inconsistencies. |
| 3 | AR-029 | Establish automated tests, linting, formatting, and CI checks | 1 | 24 | Reduces risk across every later change and is essential for concurrency work. |
| 4 | AR-003 | Make User counters and streak updates concurrency-safe | 1 | 8 | Prevents silent loss of legitimate rewards at low incremental cost inside the transaction. |
| 5 | AR-005 | Hide daily questions/explanations until session start | 1 | 8 | Closes a practical answer-disclosure path with a small session-related change. |
| 6 | AR-018 | Calculate quiz timing from server timestamps | 1 | 4 | Restores analytics integrity cheaply once sessions exist. |
| 7 | AR-017 | Add idempotent notification keys | 1 | 10 | Prevents duplicate user-visible events during retries and transaction recovery. |
| 8 | AR-031 | Hash public QuizSession identifiers at rest | 1 | 4 | Cheap defense in depth before the session API becomes established. |
| 9 | AR-004 | Normalize daily challenge completions | 2 | 32 | Removes a hard MongoDB document-size ceiling and provides enforceable uniqueness. |
| 10 | AR-008 | Make administrator attempt removal referentially safe | 2 | 24 | Prevents broken counters, dangling references, and invalid achievement history. |
| 11 | AR-007 | Make category rename atomic | 2 | 12 | Protects questions and historical analytics from split category state. |
| 12 | AR-013 | Bound and index leaderboard queries | 3 | 12 | Removes a clear linear memory/latency bottleneck before user growth. |
| 13 | AR-014 | Consolidate duplicate leaderboard APIs | 3 | 5 | Small change that eliminates conflicting security and ranking semantics. |
| 14 | AR-015 | Add a compound question-selection index | 3 | 4 | Low-cost query improvement on a frequent path. |
| 15 | AR-016 | Add measured User/admin query indexes | 3 | 8 | Improves several high-traffic and administrator queries with modest effort. |
| 16 | AR-010 | Move rate limiting to a shared store | 3 | 12 | Preserves brute-force defenses after horizontal scaling or restarts. |
| 17 | AR-021 | Consolidate profile updates and reverify changed email | 3 | 14 | Fixes a security-relevant identity inconsistency and removes duplicate behavior. |
| 18 | AR-012 | Add explicit CSRF/origin protection | 3 | 18 | Strengthens every cookie-authenticated mutation, though SameSite already lowers immediate risk. |
| 19 | AR-011 | Remove unsafe HTML sinks and enable CSP | 3 | 32 | Strong XSS prevention and containment, but broad client/view work raises cost. |
| 20 | AR-009 | Enforce platform settings in runtime behavior | 4 | 28 | Makes an existing administrator feature trustworthy; value depends on operational use. |
| 21 | AR-006 | Move daily challenge generation out of GET | 2 | 10 | Restores HTTP safety and cleaner operations, but has less direct user impact. |
| 22 | AR-027 | Introduce typed application errors | 4 | 16 | Improves reliability and reduces controller boilerplate across future work. |
| 23 | AR-022 | Centralize request validation | 4 | 28 | Prevents rule drift, but migration touches many stable endpoints. |
| 24 | AR-026 | Standardize/version API contracts and HTTP semantics | 4 | 24 | High long-term value with compatibility and client coordination cost. |
| 25 | AR-023 | Consolidate browser API/auth/formatting utilities | 5 | 36 | Meaningful maintenance gain, but limited immediate server-side risk reduction. |
| 26 | AR-020 | Extract business/query services from oversized controllers | 4 | 48 | Large maintainability payoff after contracts are stabilized; expensive if done earlier. |
| 27 | AR-019 | Split page routing and application composition | 4 | 10 | Reduces central-file churn but does not change product behavior. |
| 28 | AR-025 | Introduce shared EJS layouts and page partials | 5 | 24 | Reduces repeated markup and enables CSP/asset consistency after security work. |
| 29 | AR-024 | Consolidate CSS tokens, base rules, and components | 5 | 48 | Improves design consistency but has high regression/testing cost. |
| 30 | AR-030 | Remove unused dependencies and placeholder scaffolding | 5 | 4 | Cheap cleanup with limited operational impact. |
| 31 | AR-028 | Minimize the public health response | 3 | 1 | Very easy, but mitigates only minor information disclosure. |

## Phase 1 — Quiz integrity and delivery safety

**Objective:** Stop replay/XP farming, make completion atomic, and create the test foundation required to deploy the change safely.

**Estimated effort: 130 hours**  
**Suggested duration:** 3–4 weeks for one engineer, or 2–3 weeks for two engineers with careful ownership boundaries.

### 1.1 Quality and transaction test foundation — AR-029 — 24 hours

- Add `test`, `test:unit`, `test:integration`, `lint`, and `format:check` scripts.
- Configure a test runner and a transaction-capable MongoDB replica-set fixture.
- Incorporate existing JWT, CSV, and notification-link checks.
- Add CI gates for syntax, lint, formatting, tests, and `git diff --check`.
- Establish helpers for authenticated route tests and database cleanup.

**Exit criteria:** `npm test` succeeds locally and in CI; transaction and concurrent-request tests can run deterministically.

### 1.2 Hash QuizSession public identifiers — AR-031 — 4 hours

- Store a SHA-256 digest rather than the raw public session token.
- Centralize token generation and lookup hashing.
- Retain MongoDB `_id` for internal references.
- Test uniqueness, format, lookup, and non-disclosure in serialized records.

**Exit criteria:** Raw session tokens are returned only to the initiating client and are not stored in recoverable form.

### 1.3 Integrate server-issued QuizSessions — AR-001 — 32 hours

- Add standard and daily session-creation services/endpoints.
- Store authenticated user, category, ordered question IDs, mode, start/expiry, and challenge reference.
- Return only safe question DTOs.
- Replace submission input with session ID plus ordered selected answers.
- Atomically claim `active` sessions and reject expired, processing, completed, foreign, and malformed submissions.
- Preserve historical Scores without a QuizSession.
- Add replay, ownership, expiration, malformed input, and legacy result tests.

**Exit criteria:** A QuizSession can produce at most one Score, and no client-selected category/question set can earn rewards.

### 1.4 Protect daily challenge content — AR-005 — 8 hours

- Make general daily endpoints metadata-only.
- Remove explanations from playable question DTOs.
- Return daily questions only through a user-bound session creation operation.
- Reveal correct answers/explanations only in the completed historical result.

**Exit criteria:** No pre-completion endpoint discloses explanations, correct answers, or unbound playable question sets.

### 1.5 Use server-authoritative timing — AR-018 — 4 hours

- Calculate elapsed time from QuizSession timestamps.
- Cap expiry according to standard duration or daily challenge expiry.
- Update the browser timer to derive its display from `expiresAt`.
- Remove client timing values from the submission contract.

**Exit criteria:** Manipulating browser timing fields cannot change persisted completion time or bypass expiry.

### 1.6 Implement transactional quiz completion — AR-002 — 40 hours

- Create a focused `quizCompletionService` using `withTransaction()`.
- In one transaction: claim session, grade, create Score, update daily completion, update User, unlock achievements, insert notifications, and finalize session.
- Pass the MongoDB session through achievement and notification services.
- Remove best-effort error suppression and Score compensation deletes.
- Add transient-transaction retry handling and stage-by-stage rollback tests.
- Add a startup/readiness check documenting replica-set requirements.

**Exit criteria:** Injected failure at any completion stage leaves no partial Score, XP, challenge completion, achievement, notification, or completed session.

### 1.7 Make counters and streaks concurrency-safe — AR-003 — 8 hours

- Read/update counters inside the transaction.
- Use transaction write-conflict retries or an atomic update pipeline.
- Test multiple distinct sessions completed concurrently for the same user.

**Exit criteria:** Concurrent legitimate completions preserve the sum of XP, quiz count, correct answers, and correct streak state.

### 1.8 Make completion notifications idempotent — AR-017 — 10 hours

- Add `deduplicationKey` and a partial unique `{user, deduplicationKey}` index.
- Build deterministic keys from QuizSession and notification purpose.
- Insert notifications inside the transaction.
- Test transaction retries and duplicate submission races.

**Exit criteria:** Exactly one notification of each intended purpose exists for a completed session.

### Phase 1 release gate

- A 10–20 request concurrent duplicate-submission test yields exactly one successful result and one reward application.
- Existing historical result pages work when Score has no QuizSession or its questions are inactive.
- Standard and daily session expiry/ownership are enforced server-side.
- Transaction support is verified in development, CI, staging, and production.

## Phase 2 — Data integrity and scalable challenge storage

**Objective:** Remove remaining multi-document integrity hazards and migrate daily completion growth safely.

**Estimated effort: 78 hours**  
**Suggested duration:** 2–3 weeks.

### 2.1 Normalize daily completions — AR-004 — 32 hours

- Add `DailyChallengeCompletion` with unique challenge/user and unique session/result constraints.
- Dual-read legacy embedded and normalized completions.
- Write a repeatable, non-destructive backfill with conflict reporting.
- Switch new completion writes to the normalized collection inside the quiz transaction.
- Verify query performance and document retention policy.

**Exit criteria:** New completions do not grow DailyChallenge documents; historical embedded completions remain visible and prevent duplicates.

### 2.2 Make category rename atomic — AR-007 — 12 hours

- Wrap current Question/Score updates and activity logging in a transaction.
- Add rollback and retry tests.
- Document a future Category-reference migration; do not combine that larger migration with the interim safety fix.

**Exit criteria:** A failed rename cannot leave Question and Score category values split.

### 2.3 Redesign administrator attempt removal — AR-008 — 24 hours

- Decide and document soft-delete versus hard-delete semantics; prefer soft deletion.
- Preserve QuizSession, daily completion, and audit references.
- Recompute counters/streaks correctly from remaining eligible Scores.
- Define achievement/notification behavior and apply dependent changes transactionally.
- Add failure and historical-reference tests.

**Exit criteria:** Removing an attempt cannot create dangling references or stale user/achievement state.

### 2.4 Move daily challenge creation out of GET — AR-006 — 10 hours

- Add a scheduled/startup generation job or explicit administrator operation.
- Make GET endpoints read-only.
- Make generation idempotent through the existing date uniqueness constraint.
- Add missing/not-generated and concurrent-generation tests.

**Exit criteria:** Repeating or caching GET requests never changes database state.

### Phase 2 release gate

- Backfill runs in dry-run and execution modes without deleting embedded data.
- Category/attempt fault-injection tests prove rollback.
- DailyChallenge document size no longer grows with new completions.

## Phase 3 — Security hardening and query performance

**Objective:** Prepare the application for horizontal scaling and larger datasets while reducing browser attack surface.

**Estimated effort: 106 hours**  
**Suggested duration:** 3–4 weeks.

### 3.1 Fix leaderboard query shape — AR-013 — 12 hours

- Limit top-player queries at the database.
- Calculate current-user rank without loading every user.
- Add cursor pagination and stable tie-breaks.
- Test large seeded datasets and query plans.

### 3.2 Consolidate leaderboard APIs — AR-014 — 5 hours

- Create one leaderboard service/DTO.
- Keep one canonical route and deprecate or redirect the duplicate.
- Enforce active regular-user filtering consistently.

### 3.3 Add question-selection index — AR-015 — 4 hours

- Capture `explain("executionStats")` before and after.
- Add `{category:1, isActive:1, difficulty:1}` if validated by plans.
- Record index creation as an additive migration.

### 3.4 Add measured User indexes — AR-016 — 8 hours

- Profile leaderboard and administrator list queries.
- Add only the compound indexes supported by measured query shapes.
- Verify write overhead and index use.

### 3.5 Move rate limits to shared storage — AR-010 — 12 hours

- Add Redis/Mongo-backed storage.
- Define IP and account-based keys for authentication/reset paths.
- Verify trusted proxy behavior and multi-instance enforcement.

### 3.6 Consolidate account-profile mutation — AR-021 — 14 hours

- Create a canonical account service and response DTO.
- Route profile/settings pages through one endpoint.
- On email change, revoke verified status and issue verification.
- Define session behavior and add duplicate-email/security tests.

### 3.7 Add explicit CSRF/origin controls — AR-012 — 18 hours

- Select token-based or strict Origin/Fetch Metadata protection.
- Apply it to cookie-authenticated mutations.
- Reject unnecessary form content types on JSON APIs.
- Update client requests and add cross-origin rejection tests.

### 3.8 Remove unsafe dynamic HTML and enable CSP — AR-011 — 32 hours

- Inventory all `innerHTML` and inline style/script requirements.
- Replace dynamic data interpolation with DOM APIs/`textContent` or reviewed sanitization.
- Deploy CSP report-only, resolve violations, then enforce nonce/hash-based policy.
- Add regression tests for hostile stored/display values.

### 3.9 Minimize health output — AR-028 — 1 hour

- Remove environment disclosure from public liveness.
- Separate internal readiness details if operationally required.

### Phase 3 release gate

- Explain plans show bounded/index-backed leaderboard and question selection.
- Rate limits hold across at least two app instances.
- CSRF tests reject cross-origin mutations.
- Enforced CSP has no unexplained production violations.

## Phase 4 — Backend contracts and maintainability

**Objective:** Make configuration trustworthy and reduce server-side duplication after critical contracts have stabilized.

**Estimated effort: 154 hours**  
**Suggested duration:** 4–6 weeks, executed incrementally by feature.

### 4.1 Enforce platform settings — AR-009 — 28 hours

- Add a cached settings provider with invalidation.
- Enforce registration, maintenance, quiz configuration, XP multiplier, daily challenge, leaderboard, and email switches.
- Define safe defaults during storage failure.
- Remove or label unsupported Google authentication controls.

### 4.2 Introduce typed errors — AR-027 — 16 hours

- Add stable error codes/statuses and safe public messages.
- Centralize Mongoose duplicate, validation, and cast error mapping.
- Replace message-string inspection and repeated controller catches gradually.

### 4.3 Centralize validation — AR-022 — 28 hours

- Select a schema-validation approach.
- Centralize pagination, ObjectId, account, question, and administrator payload schemas.
- Standardize validation response envelopes.
- Migrate endpoint groups with tests rather than one sweeping rewrite.

### 4.4 Standardize API contracts — AR-026 — 24 hours

- Publish identifier, error, pagination, HTTP verb, and DTO conventions.
- Version incompatible session/leaderboard/account changes.
- Provide a compatibility window and update clients before removing legacy routes.

### 4.5 Extract services from oversized controllers — AR-020 — 48 hours

- Prioritize quiz, profile, analytics, and administrator reporting.
- Extract read-model/query services, DTO serializers, and pure calculations.
- Keep controllers focused on transport concerns.
- Add unit tests around extracted pure/domain logic.

### 4.6 Split application/page routing — AR-019 — 10 hours

- Create public, authenticated-user, and administrator page routers.
- Add a small render helper/route registry for repeated protected pages.
- Leave global middleware and error handling in `app.js`.

### Phase 4 release gate

- Every advertised setting has an enforcement test or is removed.
- New APIs follow the documented contract.
- Target controllers have measurable size/complexity reductions and service-level tests.

## Phase 5 — Frontend and repository consolidation

**Objective:** Lower ongoing UI maintenance cost and remove misleading scaffolding after server/API behavior is stable.

**Estimated effort: 112 hours**  
**Suggested duration:** 3–5 weeks, page by page.

### 5.1 Consolidate browser utilities — AR-023 — 36 hours

- Adopt ES modules or a lightweight build step.
- Centralize fetch/JSON/error/401 handling, logout, formatting, storage, and safe DOM helpers.
- Migrate pages incrementally with API contract tests.

### 5.2 Introduce shared EJS layouts — AR-025 — 24 hours

- Extract shared head, authenticated/admin shells, navigation, and script/style partials.
- Pass page metadata and assets explicitly.
- Preserve accessibility and page behavior through rendered-page tests.

### 5.3 Consolidate CSS architecture — AR-024 — 48 hours

- Define shared tokens, reset/base, layout, components, and utilities.
- Migrate duplicated headers, buttons, cards, forms, tables, status states, and responsive rules.
- Use visual regression checks on each page group.
- Remove redundant rules only after usage verification.

### 5.4 Remove unused dependencies and placeholders — AR-030 — 4 hours

- Verify and remove `bcryptjs`, `socket.io`, `uuid`, and other unused packages.
- Remove or document empty modules/directories.
- Correct package metadata and regenerate the lockfile through normal package tooling.

### Phase 5 release gate

- All pages use the shared API/auth layer.
- Common layout/CSS changes require edits in one place.
- Dependency audit reports no knowingly unused direct dependencies.

## Effort summary

| Phase | Focus | Hours |
|---:|---|---:|
| 1 | Quiz integrity and delivery safety | 130 |
| 2 | Data integrity and scalable challenge storage | 78 |
| 3 | Security hardening and query performance | 106 |
| 4 | Backend contracts and maintainability | 154 |
| 5 | Frontend and repository consolidation | 112 |
| **Total** | **All 31 findings** | **580 hours** |

With a 25% planning contingency, the portfolio budget is approximately **725 hours**.

## Suggested stopping points

- **Minimum security release:** Complete Phase 1 (130 hours).
- **Integrity and scale baseline:** Complete Phases 1–2 (208 hours).
- **Production hardening baseline:** Complete Phases 1–3 (314 hours).
- **Full architectural program:** Complete all phases (580 hours before contingency).

Phases should be treated as dependency bands, not rigid waterfall gates. Small independent tasks may move earlier, but no refactor should delay the Phase 1 replay and transaction work.
