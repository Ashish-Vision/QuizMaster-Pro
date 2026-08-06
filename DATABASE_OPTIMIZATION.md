# QuizMaster Pro — MongoDB Optimization Review

Date: 2026-08-05  
Scope: all nine Mongoose models, all 40 aggregation pipelines, and the repository's MongoDB query shapes. No source files were changed.

## Executive summary

The database design has sound baseline integrity indexes: unique user email, unique achievement per user/code, unique daily date, unique quiz-session identifier, one result per quiz session, and one daily session per user/challenge. The largest performance risk is not `$lookup`—the code contains no `$lookup` stage—but repeated full scans of `scores`, `users`, `questions`, `achievements`, and `activitylogs` on admin and analytics requests.

Highest-value changes:

1. Make score date filtering indexable and add global/category date indexes. Expected endpoint latency improvement: **60–95%** for date-window analytics on large collections.
2. Replace repeated dashboard-wide scans with one cached/materialized metrics read model. Expected improvement: **70–98%** in database work and **40–90%** in dashboard latency.
3. Add question-selection compounds and a multikey score-answer index. Expected improvement: **50–95%** for quiz selection and **80–99%** for question-deletion checks.
4. Add leaderboard/admin-user indexes and stop unanchored regex scans. Expected improvement: **50–95%** for sorted lists; search gains can approach **90–99%** at scale with Atlas Search or normalized search fields.
5. Normalize daily-challenge completions before the embedded array becomes large. This prevents the 16 MB document limit and removes growing document rewrite/transaction cost.

Percentages below are estimates of latency or documents examined for the named operation, not guarantees and not additive. Actual gains depend on cardinality, cache warmth, selectivity, hardware, and write volume. Validate each change with production-like data using `explain("executionStats")`, comparing `executionTimeMillis`, `totalDocsExamined`, `totalKeysExamined`, returned rows, sort spills, and index size.

## Index inventory and recommendations by model

### User

Current index: unique `email` at `server/models/User.js:25`.

| Priority | Recommendation                                                                                                                                                                                               | Evidence and rationale                                                                                                                                                                                                                                                        | Expected improvement                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| High     | Add `{ role: 1, isActive: 1, totalXp: -1, quizzesCompleted: -1, correctAnswers: -1, createdAt: 1 }` for the canonical leaderboard; make every leaderboard use the same tie-break ordering.                   | `server/controllers/leaderboardController.js:11` filters active users and sorts at line 19; `server/controllers/userController.js:16` and `server/controllers/profileController.js:293` use related rankings. The email index cannot supply these sorts.                      | **70–98% fewer documents examined**, **50–90% lower latency** for top-N leaderboards. |
| High     | Add `{ createdAt: -1, _id: -1 }` for recent/admin lists and `{ lastLoginAt: 1 }` for active-today counts.                                                                                                    | Recent-user sorts occur at `server/controllers/adminController.js:240` and admin filtering/sorting at `server/controllers/adminUserController.js:185`; the last-login range is at `server/controllers/adminController.js:115`.                                                | **50–95%** for recent-user reads; **40–90%** for selective login windows.             |
| Medium   | Add a compound matching the dominant admin filter, initially `{ role: 1, isActive: 1, createdAt: -1, _id: -1 }`; retain it only if profiler evidence shows both filters commonly supplied.                   | Admin user filters are built before `server/controllers/adminUserController.js:185` and sorted at lines 152–162. Separate indexes are absent. A single compound cannot efficiently serve every optional-filter permutation.                                                   | **40–90%** on matching filtered lists.                                                |
| High     | Replace unanchored case-insensitive regex on first name, last name, and email with Atlas Search, or maintain normalized search fields with appropriate indexes.                                              | `server/controllers/adminAttemptController.js:188` first scans matching users; admin user/report searches follow the same regex pattern. Ordinary B-tree indexes do not support leading-anywhere `/term/i`.                                                                   | **70–99% fewer documents examined** on large user sets.                               |
| Medium   | Add unique partial indexes for reset/verification token hashes: `{ passwordResetToken: 1 }` and `{ emailVerificationToken: 1 }`, each with `unique: true` and a partial filter requiring a string.           | Equality lookups are at `server/controllers/passwordResetController.js:47`, `:158`, `:241` and `server/controllers/emailVerificationController.js:112`, `:177`; fields are declared at `server/models/User.js:43` and `:111`. This also prevents accidental token collisions. | **80–99%** for token lookup as users grow.                                            |
| Low      | Do not put TTL indexes directly on `passwordResetExpires` or `emailVerificationExpires`: that would delete the entire user document when a token expires. Clear expired token fields asynchronously instead. | Expiry fields are properties of persistent users, not disposable documents (`server/models/User.js:49`, `:117`).                                                                                                                                                              | Correctness safeguard; no direct speed claim.                                         |

Sparse-index note: a sparse unique token index would work for missing fields but still indexes explicit `null` values and can create uniqueness surprises. Because these fields default to `null`, a **partial unique index with `$type: "string"` is safer than `sparse: true`**.

### Score

Current indexes: standalone `user` and `category` (`server/models/Score.js:38`, `:51`), `{ user: 1, completedAt: -1 }` (`:130`), `{ category: 1, score: -1 }` (`:135`), and partial unique `quizSession` (`:140`).

| Priority | Recommendation                                                                                                                                                                          | Evidence and rationale                                                                                                                                                                                                            | Expected improvement                                                   |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Critical | Add `{ completedAt: -1, _id: -1 }`; migrate legacy rows missing `completedAt`, then filter directly on `completedAt` rather than an `$addFields` fallback.                              | Global recent attempts sort at `server/controllers/adminController.js:251`; date pipelines compute `chartDate` before matching at `adminController.js:267` and `adminAnalyticsController.js:269`, preventing an index range scan. | **60–95%** for bounded date analytics/recent attempts.                 |
| High     | Add `{ category: 1, completedAt: -1, _id: -1 }`; retire `{ category: 1, score: -1 }` if profiler/index-usage data shows no score-ranked category query.                                 | Admin attempts and reports filter category then sort newest (`server/controllers/adminAttemptController.js:242`, `server/controllers/adminReportController.js:319`). Existing category/score order cannot satisfy this.           | **50–95%** for category histories and date-bounded category analytics. |
| Medium   | Consider `{ user: 1, category: 1, completedAt: -1, _id: -1 }` only if user+category history is frequent; otherwise existing `{ user, completedAt }` is preferable to avoid index bloat. | History builds user/category filters at `server/controllers/historyController.js:36`; profile history uses user at `server/controllers/profileController.js:638`.                                                                 | **30–85%** on the combined-filter case.                                |
| High     | Add multikey `{ "answers.question": 1 }`.                                                                                                                                               | Question deletion checks whether a score references it at `server/controllers/adminQuestionController.js:464`. Without this index MongoDB scans every historical score and answer array.                                          | **80–99% fewer documents examined** for deletion checks.               |
| Medium   | Preserve the partial unique `quizSession` index. It is the database-level idempotency backstop.                                                                                         | `server/models/Score.js:140`; complements QuizSession result uniqueness.                                                                                                                                                          | Prevents duplicate results; performance secondary.                     |
| High     | Materialize daily/category/platform rollups rather than repeatedly grouping the entire immutable score history.                                                                         | Full score groups appear throughout admin dashboards/reports and are enumerated below. Indexes cannot avoid reading all qualifying documents for all-time sums.                                                                   | **70–98% less DB work**, **40–90% lower dashboard latency**.           |

The standalone `user` index is redundant with `{ user, completedAt }` for most equality queries; the standalone `category` index may become redundant after `{ category, completedAt }`. Confirm via `$indexStats` before removal.

### Question

Current indexes: standalone `category` and `isActive` (`server/models/Question.js:28`, `:45`).

| Priority | Recommendation                                                                                                                                                                                                                           | Evidence and rationale                                                                                                                                                                           | Expected improvement                                       |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| High     | Add `{ category: 1, isActive: 1, difficulty: 1 }`. If legacy “missing is active means active” must remain, first backfill `isActive: true`; `$ne: false` is less selective/index-friendly than equality.                                 | Standard selection matches category/difficulty/active at `server/controllers/quizController.js:163`; daily grouping/selection at `server/services/dailyChallengeService.js:162`, `:232`.         | **50–95% fewer candidates read** before sampling/grouping. |
| Medium   | Add `{ createdAt: -1, _id: -1 }`, or a carefully selected `{ category: 1, difficulty: 1, isActive: 1, createdAt: -1, _id: -1 }` if admin filtered lists dominate.                                                                        | Admin list is queried at `server/controllers/adminQuestionController.js:199`; sort/filter combinations are assembled in that controller.                                                         | **40–90%** for matching admin list shapes.                 |
| High     | Enforce duplicate-question identity in the database using a normalized `questionKey` plus `{ category: 1, questionKey: 1 }` unique, or a collation-aware unique `{ category, question }` with equality queries using the same collation. | Duplicate checks at `server/controllers/adminQuestionController.js:319`, `:392` and category controller `:245` use application queries; regex/case handling cannot guarantee concurrency safety. | **70–99%** lookup improvement plus race-free uniqueness.   |
| High     | Replace unanchored admin question regex search with Atlas Search/text-search design; a normal index on `question` will not solve `/term/i`.                                                                                              | Filtered query at `server/controllers/adminQuestionController.js:199`; report query at `server/controllers/adminReportController.js:420`.                                                        | **70–99%** fewer examined documents for search.            |

`$sample` at `server/controllers/quizController.js:175` and `server/services/dailyChallengeService.js:244` is semantically necessary, not an unnecessary sort. It can still be costly after a selective `$match`; cache eligible IDs per category/difficulty or precompute random buckets if candidate pools become very large.

### QuizSession

Current indexes: unique `sessionId` (`server/models/QuizSession.js:15`), standalone `mode` (`:79`), `{ user, status, expiresAt }` (`:146`), `{ user, startedAt }` (`:152`), partial unique `result` (`:157`), partial unique `{ user, dailyChallenge }` for daily mode (`:171`), and `expiresAt` (`:184`).

The uniqueness design is strong. Keep `sessionId`, `result`, and daily-session unique constraints. The `sessionId` index alone is sufficient for submission lookup because it resolves at most one row; a larger compound containing user/status would not improve that lookup.

- Keep `{ user, status, expiresAt }` only if active-session listing/cleanup exists or is planned. Otherwise it and standalone `mode` are candidates for removal after `$indexStats` review.
- Do **not** TTL-delete at `expiresAt`: replay rejection and audit/history references require expired sessions to remain. If retention policy permits eventual removal, add a separate nullable `purgeAt` and a TTL `{ purgeAt: 1 }` with `expireAfterSeconds: 0`, populated only after the audit retention period. Expected storage reduction depends entirely on retention volume; lookup latency may improve **5–30%** after substantial archival.

### DailyChallenge

Current indexes: unique `dateKey`, standalone category/difficulty/expiresAt/isActive, `{ dateKey, isActive }`, and multikey `{ "completions.user", dateKey }` (`server/models/DailyChallenge.js:55–65`, `:89`, `:97`, `:153`, `:159`, `:179`, `:184`).

| Priority               | Recommendation                                                                                                                                                                                                                                                              | Evidence and rationale                                                                                                                                                                                                                                                            | Expected improvement                                                                              |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| High                   | Add `{ isActive: 1, expiresAt: 1 }` for expiry sweeps.                                                                                                                                                                                                                      | `server/services/dailyChallengeService.js:593` updates expired active challenges; separate indexes generally cannot both filter and range-scan as effectively.                                                                                                                    | **50–95% fewer examined documents** when historical challenges accumulate.                        |
| Critical architectural | Move `completions` to a `DailyChallengeCompletion` collection with unique `{ challenge: 1, user: 1 }`, plus `{ user: 1, completedAt: -1 }` and `{ challenge: 1, completedAt: -1 }`.                                                                                         | Embedded completions begin at `server/models/DailyChallenge.js:162`; completion update is at `server/services/dailyChallengeService.js:530`. The array grows without bound, rewrites a hot document, increases transaction conflicts, and can hit MongoDB's 16 MB document limit. | **50–95% lower write amplification/contention** at high participation; removes hard size ceiling. |
| Low                    | Remove `{ dateKey, isActive }` if explain confirms the unique `dateKey` index is chosen: dateKey already resolves one document. Review standalone category/difficulty indexes because repository queries primarily choose those values from Questions, not DailyChallenges. | Index definitions at `server/models/DailyChallenge.js:179`; lookups at `server/services/dailyChallengeService.js:287`, `:434`, `:478`.                                                                                                                                            | **5–20% lower index write/storage overhead**, workload-dependent.                                 |

Do not TTL-delete challenges at `expiresAt`; historical results and session audit references must survive. A separate retention-controlled `purgeAt` is appropriate only after completions are normalized and retention requirements are explicit.

### Notification

Current indexes: standalone user/type/isRead and `{ user, createdAt }`, `{ user, isRead, createdAt }` (`server/models/Notification.js:7`, `:15`, `:53`, `:71`, `:76`).

- Add `{ createdAt: -1, _id: -1 }` for the global admin list (`server/controllers/adminNotificationController.js:149`). Expected **50–95%** improvement for recent pages.
- Add partial `{ "metadata.batchId": 1 }` for batch deletion (`server/controllers/adminNotificationController.js:468`). Expected **80–99%** improvement as notification volume grows.
- If type/status admin filters are common, add `{ type: 1, isRead: 1, createdAt: -1, _id: -1 }`; measure optional-filter frequency first. Expected **40–90%** for matching filters.
- The standalone `user` index is redundant with both compounds; standalone `isRead` is useful only for global unread counts, while user unread reads are already covered. Remove only after `$indexStats` verification.
- Replace title/message regex admin search with Atlas Search if it must scale.
- A TTL index on `createdAt` is applicable only under an explicit notification-retention policy (for example 180 days). TTL is approximate and deletes documents; exclude legally/audit-required system notifications or move retention eligibility to a separate `purgeAt` field.

### Achievement

Current indexes: standalone `user` and unique `{ user, code }` (`server/models/Achievement.js:7`, `:63`). The standalone index is redundant because the compound has the same prefix.

- Add `{ unlockedAt: -1, _id: -1 }` only if recent unlock feeds/admin exports are frequent; otherwise this collection is likely modest and no new index is justified. Expected **30–85%** for top-N recent reads.
- The unique `{ user, code }` correctly protects concurrent unlocks and should remain.
- Do not use TTL: achievements are persistent user history.

### ActivityLog

Current indexes include standalone admin/action/entityType/entityId plus `{ admin, createdAt }`, `{ action, createdAt }`, `{ entityType, createdAt }`, and `{ createdAt }` (`server/models/ActivityLog.js:37–65`, `:100–117`). Filtered chronological access is well covered.

- Remove redundant standalone admin/action/entityType indexes after checking `$indexStats`; each is a prefix of an existing compound. Keep entityId if direct entity audit lookups are used.
- Combined optional filters may still sort in memory. Add a wider compound only from profiler evidence; building every permutation would hurt write throughput.
- Description/entity text search is an unindexed regex scan in the admin log list; use Atlas Search or an explicit text index if language/token semantics are acceptable.
- A TTL `{ createdAt: 1 }` is appropriate **only** if the audit retention policy permits deletion (for example 365 days). Otherwise archive to cold storage/materialized summaries. Removing old logs can improve active working-set latency **10–60%**, but compliance governs this decision.

### PlatformSetting

Current indexes: unique `key`, standalone `category`, and `{ category, key }` (`server/models/PlatformSetting.js:7`, `:21`, `:72`). This is a small bounded configuration collection.

- Unique `key` is correct for lookup/upsert integrity.
- Standalone category is redundant with `{ category, key }`. In practice, either the compound or standalone category is also likely unnecessary because settings cardinality is tiny. Remove only after `$indexStats`; expected benefit is write/storage simplification, not meaningful read latency.
- No sparse or TTL index is applicable.

## Aggregation pipeline review

### Cross-cutting findings

#### A1 — Non-sargable fallback date filters (High)

`server/controllers/adminController.js:267` and `server/controllers/adminAnalyticsController.js:269` use `$addFields` to derive `chartDate = ifNull(completedAt, createdAt)`, then `$match` on that computed value. MongoDB cannot use a normal `completedAt` or `createdAt` index for the computed range, so both pipelines scan all scores.

Recommended fix: backfill `completedAt` on legacy scores, require it going forward, and start the pipeline with `{ $match: { completedAt: { $gte: periodStart } } }`. During migration, use two indexable branches (`completedAt` range plus legacy missing-completedAt/createdAt range), not a computed field across the whole collection.

Estimated improvement: **60–95% latency** and **70–99% documents examined** for short windows on long-lived score history.

#### A2 — Repeated full scans per request (High)

Admin dashboard, analytics, reports, activity summaries, and achievement summaries launch many independent `countDocuments` and aggregation scans in `Promise.all`. Parallel execution reduces wall time only when spare capacity exists; it multiplies database CPU/I/O and tail-latency under concurrent admins.

Recommended fix: maintain daily rollup collections (for example `DailyPlatformMetric` and `DailyCategoryMetric`) updated transactionally or asynchronously from immutable score events. Cache global totals briefly. `$facet` can consolidate scans for a near-term improvement, but a `$facet` fed by the whole collection still scans all history and may increase memory use.

Estimated improvement: **70–98% database work**, **40–90% endpoint latency**, and materially better concurrency.

#### A3 — Missing early projections (Medium)

Most pipelines group only a handful of fields but do not explicitly project them after `$match`. MongoDB's dependency optimizer can often avoid fetching unused fields internally, so adding `$project` alone is not guaranteed to help. It matters most before array expansion, materialization, or any future `$lookup`; no current pipeline uses `$lookup` or `$unwind`.

Recommended fix: prioritize index-covered matches and rollups. Add explicit projections for clarity and covered plans where explain proves benefit. Expected gain: **0–20%** in current simple groups, potentially higher if large embedded answer arrays are fetched.

#### A4 — Group-result sorts are necessary, not collection sort defects (Low)

Most `$sort` stages follow `$group` and sort a small number of days/categories/actions. An index cannot satisfy a sort on computed `attempts` or grouped `_id`. These sorts are appropriate and should not be removed. Monitor `usedDisk`/spills, but group cardinality is currently low.

### Complete pipeline inventory

Every `.aggregate([` call found in `server/controllers` and `server/services` is listed here.

| File and line                                          | Collection / purpose                         | Assessment and recommendation                                                                                                                          |
| ------------------------------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `server/services/achievementService.js:111`            | Score, per-user perfect/high-accuracy counts | Early user match uses `{ user, completedAt }` prefix. Good; combine with the next pipeline in one `$facet` or one group to halve per-completion scans. |
| `server/services/achievementService.js:148`            | Score, per-user best category                | Same user scan repeated; group-result sort is necessary. Fold into one per-user summary/read model.                                                    |
| `server/controllers/adminQuestionController.js:212`    | Question, difficulty counts                  | Full collection scan on every admin question list request. Cache counts or maintain question metrics; an index cannot avoid all-time grouping.         |
| `server/controllers/adminController.js:121`            | User, global stored totals                   | Full user scan. Read-model/cache candidate.                                                                                                            |
| `server/controllers/adminController.js:153`            | Score, global totals                         | Full score scan. Materialize totals.                                                                                                                   |
| `server/controllers/adminController.js:209`            | Score, category totals                       | Full scan; group sort is valid. Materialize category rollups.                                                                                          |
| `server/controllers/adminController.js:267`            | Score, seven-day trend                       | Non-sargable computed date (A1). Backfill and match `completedAt` first.                                                                               |
| `server/controllers/adminController.js:319`            | User, seven-day registrations                | Correct early `createdAt` match; add `{ createdAt: -1 }`. Post-group sort is valid.                                                                    |
| `server/controllers/adminController.js:351`            | Score, accuracy buckets                      | Full score scan. Materialize bucket counters or accept only for infrequent admin use.                                                                  |
| `server/services/dailyChallengeService.js:162`         | Question, eligible categories                | Match is correctly first and projection exists. Add category/active/difficulty compound; category group must inspect eligible rows. Cache once daily.  |
| `server/services/dailyChallengeService.js:232`         | Question, random daily IDs                   | Match/sample/project order is correct. `$sample` is required; compound match index and eligible-ID cache can reduce candidate work.                    |
| `server/controllers/adminCategoryController.js:28`     | Question, category statistics                | Full question scan; materialize/cache category metadata.                                                                                               |
| `server/controllers/adminCategoryController.js:97`     | Score, category statistics                   | Full score scan; combine with daily category rollup.                                                                                                   |
| `server/controllers/profileController.js:125`          | Score, user summary                          | User match can use existing index. Combine multiple profile aggregates into one faceted per-user query/read model.                                     |
| `server/controllers/profileController.js:225`          | Score, user category performance             | Existing user prefix helps; grouping/sort valid.                                                                                                       |
| `server/controllers/profileController.js:413`          | Score, user activity trend                   | Ensure direct user + completedAt range match; existing compound should cover it. Project only metric fields after match.                               |
| `server/controllers/profileController.js:554`          | Score, recent active dates/streak            | Existing `{ user, completedAt }` should support the range. Group-result sorting is necessary.                                                          |
| `server/controllers/adminAchievementController.js:101` | Achievement, counts by code                  | Full achievement scan; collection may be moderate. Cache definitions/statistics if admin endpoint is frequent.                                         |
| `server/controllers/adminAchievementController.js:121` | Achievement, counts by category              | Full scan; same recommendation.                                                                                                                        |
| `server/controllers/adminAchievementController.js:149` | Achievement, recent unlock trend             | Add direct date match if not already present in the full stage and optional `{ unlockedAt }`; cache daily rollup.                                      |
| `server/controllers/adminUserController.js:287`        | Score, one user's totals                     | Early user match uses existing prefix. Good for detail requests; projection/read model optional.                                                       |
| `server/controllers/analyticsController.js:91`         | Score, user overview                         | Indexable user match; repeated user-history scan. Consolidate analytics pipelines/read model.                                                          |
| `server/controllers/analyticsController.js:238`        | Score, user category analytics               | Existing user index prefix helps. Group-result sorts valid.                                                                                            |
| `server/controllers/analyticsController.js:421`        | Score, user time trend                       | Use direct `{ user, completedAt: range }` match to exploit compound; keep post-group chronological sort.                                               |
| `server/controllers/analyticsController.js:503`        | Score, user distribution/breakdown           | User match is indexable; merge with overview/category pass where feasible.                                                                             |
| `server/controllers/analyticsController.js:715`        | Score, user active dates                     | Existing user/date compound should support this; project date only after match.                                                                        |
| `server/controllers/adminAttemptController.js:86`      | Score, recalculate one user                  | Early user match uses existing compound prefix. Appropriate for rare administrative deletion.                                                          |
| `server/controllers/adminAttemptController.js:272`     | Score, global attempt summary                | Full score scan on every attempts-list request, even when list is paginated. Cache/materialize totals.                                                 |
| `server/controllers/adminAnalyticsController.js:141`   | Score, global summary                        | Full scan; materialize.                                                                                                                                |
| `server/controllers/adminAnalyticsController.js:208`   | Question, difficulty counts                  | Full question scan; cache/materialize.                                                                                                                 |
| `server/controllers/adminAnalyticsController.js:220`   | Score, category summary                      | Full scan; materialize category metrics.                                                                                                               |
| `server/controllers/adminAnalyticsController.js:269`   | Score, period trend                          | Non-sargable computed date (A1); direct completedAt match.                                                                                             |
| `server/controllers/adminAnalyticsController.js:321`   | User, registration trend                     | Correct early createdAt range; add createdAt index.                                                                                                    |
| `server/controllers/adminAnalyticsController.js:353`   | Score, accuracy buckets                      | Full scan; materialize buckets.                                                                                                                        |
| `server/controllers/quizController.js:163`             | Question, random standard quiz               | Correct match/sample/project shape; add compound question index. Sampling remains proportional to candidate handling.                                  |
| `server/controllers/adminActivityLogController.js:183` | ActivityLog, action counts                   | Full scan. Cache summary or daily action rollup; sort after group is necessary.                                                                        |
| `server/controllers/adminActivityLogController.js:200` | ActivityLog, entity counts                   | Second full scan of same data; merge both via a facet for near-term relief or daily rollup for scale.                                                  |
| `server/controllers/adminReportController.js:116`      | Score, global report totals                  | Full scan; reuse materialized platform totals.                                                                                                         |
| `server/controllers/adminReportController.js:495`      | Question, category export totals             | Full scan is expected for complete export; run as background/streamed job or read rollups.                                                             |
| `server/controllers/adminReportController.js:555`      | Score, category export totals                | Full scan is expected for complete export; use rollups or background job.                                                                              |

No `$lookup`, `$unwind`, or `$facet` stages exist in the current repository. Therefore there are no current expensive aggregation joins or unwind explosions. Mongoose `.populate()` calls on paginated result lists do issue related queries, but selected fields and limits generally bound them; preserve narrow `select` clauses and avoid populating unbounded export sets.

## Query-level collection scan and sort risks outside aggregation

1. **Regex search across users/questions/notifications/activity logs** — unanchored, case-insensitive regex predicates cannot use ordinary B-tree indexes efficiently. Use Atlas Search, a purpose-built search service, or normalized prefix fields where prefix-only search is acceptable. Estimated **70–99%** reduction in examined documents.
2. **Admin attempts search fan-out** — `server/controllers/adminAttemptController.js:188` first scans users with regex, constructs a potentially large `$in`, then queries scores at `:242`. Use a search index to resolve a bounded ID set, or denormalize immutable user search labels into an attempt read model. Estimated **40–95%**, depending on match breadth.
3. **Deep skip pagination** — admin/history list code uses `.skip()` (`adminAttemptController.js:242`, `historyController.js:36`, and analogous admin lists). Cost grows linearly with page depth even with an index. Adopt cursor/keyset pagination using the sort fields plus `_id`. Estimated **50–99%** at deep pages; little difference on page one.
4. **Global recent sorts** — Score, User, Question, Notification currently lack several matching global date indexes, causing blocking sorts or extra scans. The model recommendations above address these.
5. **Distinct plus list plus count** — list endpoints often run query, count, and `distinct` concurrently. Cache stable filter metadata (categories/difficulties), and consider estimated counts only where exactness is unnecessary. Estimated **20–70%** lower database work per list request.

## Proposed index set, ordered for rollout

Do not add every candidate blindly. Each index increases RAM/storage and write/transaction cost.

### Phase 1 — correctness and hot paths

1. `scores: { completedAt: -1, _id: -1 }`
2. `scores: { category: 1, completedAt: -1, _id: -1 }`
3. `scores: { "answers.question": 1 }`
4. `questions: { category: 1, isActive: 1, difficulty: 1 }`
5. `users: { role: 1, isActive: 1, totalXp: -1, quizzesCompleted: -1, correctAnswers: -1, createdAt: 1 }`
6. `users: { createdAt: -1, _id: -1 }` and `{ lastLoginAt: 1 }`
7. Partial unique token-hash indexes on both User token fields.
8. `dailychallenges: { isActive: 1, expiresAt: 1 }`

### Phase 2 — admin list/search paths

1. `notifications: { createdAt: -1, _id: -1 }`
2. Partial `notifications: { "metadata.batchId": 1 }`
3. `questions: { createdAt: -1, _id: -1 }`
4. Search indexes/normalized search keys.
5. Cursor pagination and matching tie-break indexes.

### Phase 3 — structural optimizations

1. Backfill and require Score `completedAt`; rewrite computed-date pipelines.
2. Daily/category/platform metric rollup collections.
3. Normalize DailyChallenge completions with unique challenge/user identity.
4. Add retention-specific `purgeAt` TTL indexes only after explicit product/compliance approval.

## Validation and safe rollout

1. Capture profiler/query-analyzer samples and current `$indexStats` for at least a representative peak period.
2. Generate production-like cardinalities in staging; tiny development datasets hide collection scans.
3. Run `explain("executionStats")` before and after each index/query change. Require a meaningful drop in docs examined and no unexpected in-memory sort/spill.
4. Build indexes using the deployment's supported low-impact process; watch replication lag, disk, and cache eviction.
5. Backfill nullable/default fields in batches before changing `$ne: false` to equality or removing legacy date fallbacks.
6. Keep each new index through a representative observation window, then review `$indexStats` and profiler data.
7. Remove redundant indexes one at a time: likely candidates include Achievement `user`; ActivityLog standalone admin/action/entityType; Notification standalone user; Score standalone user/category after replacements; DailyChallenge `{ dateKey, isActive }`; PlatformSetting standalone category.
8. Benchmark write throughput as well as reads. Quiz completion is transactional, so unnecessary indexes directly increase transaction duration and contention.

## Final assessment

The current indexes protect the most important uniqueness invariants but are not aligned with analytics, newest-first administration, full-text-like search, or growing daily-challenge participation. The safest high-ROI sequence is: make date predicates sargable, add a small set of query-shaped indexes, prove them with explain/profiler data, then move all-time analytics and challenge completions to scalable read/write models. TTL should be introduced only through explicit retention fields—not on persistent users, scores, challenges, achievements, or audit data without policy approval.
