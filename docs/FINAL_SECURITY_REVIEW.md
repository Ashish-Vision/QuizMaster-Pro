# Final security review

Review date: 2026-08-06. Scope: current `production-hardening` source and automated tests. `SECURITY_REPORT.md` and `SECURITY_AUDIT.md` are retained as historical baselines; their old line numbers and pre-remediation conclusions are not authoritative.

## Closure summary

| Finding                            | Classification                    | Current evidence                                                                                                              | Test evidence / remaining risk                                              |
| ---------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| QM-001 quiz replay                 | Fixed                             | Owned session lookup and state checks in `quizController.js:307-349`; atomic claim at `621-630`                               | Replica-set replay/concurrency suite; no second XP award                    |
| QM-002 admin question router       | Fixed                             | Question CRUD handlers in `adminQuestionRoutes.js:5-31`                                                                       | Route-contract and database CRUD tests                                      |
| QM-003 user dashboard admin API    | Fixed                             | User dashboard script uses user APIs                                                                                          | Page/API contract and Playwright hydration tests                            |
| QM-004 transactional completion    | Fixed                             | Transaction starts at `quizController.js:618-620`; score/counters/daily/rewards/session share its session; abort at `913-915` | Failure-injection rollback and concurrent-submission tests                  |
| QM-005 password/session revocation | Fixed                             | Token-version comparison in `authMiddleware.js:79-90`                                                                         | Password reset/change and admin role/status revocation integration tests    |
| QM-006 notification links          | Fixed                             | `notificationLinkValidator.js:19-74`                                                                                          | Unsafe schemes, encoded slashes, controls, malformed encoding tests         |
| QM-007 CSV formulas                | Fixed                             | `csv.js:5-46`                                                                                                                 | Utility payload matrix and real administrator report endpoint test          |
| QM-008 inactive questions          | Fixed                             | New selection uses `isActive: { $ne: false }`; session scoring loads exact issued IDs                                         | Active/inactive/legacy/historical/daily integration suite                   |
| QM-009 CSP disabled                | Fixed                             | Helmet CSP in `app.js:55-85`; no `unsafe-eval`                                                                                | Header tests and browser console/page audits                                |
| QM-010 JWT constraints             | Fixed                             | HS256/issuer/audience/expiry in `authToken.js:5-82`                                                                           | Wrong algorithm, issuer, audience, signature and expiry tests               |
| QM-011 Host-derived security URLs  | Mitigated                         | Validated application origins are used when configured; stronger production validation exists                                 | Environment utility tests; local HTTP origins remain intentional            |
| QM-012 process-local rate limits   | Accepted local-project limitation | Sensitive limiters in `rateLimitMiddleware.js:30-88`                                                                          | JSON 429/error coverage; limits reset per process                           |
| QM-013 avatar validation           | Fixed with limitation             | MIME, signature, structure, dimensions, pixels and 5 MB cap in `uploadMiddleware.js:5-167`                                    | Malformed/disguised/oversized-dimension tests; no decode/re-encode pipeline |
| QM-014 development reset URL       | Fixed                             | Explicit flag plus development-mode gate                                                                                      | Recovery integration/security tests                                         |
| QM-015 originless requests         | Mitigated                         | Exact-origin mutation middleware for browser cookie writes; originless tools remain allowed                                   | Same-origin security tests; local API clients remain usable                 |
| QM-016 leaderboard reads           | Fixed                             | Eligibility/top-ten/count/rank queries in `leaderboardController.js`                                                          | Eligibility, tie, cap, rank, empty-list integration tests                   |
| QM-017 embedded daily completions  | Accepted local-project limitation | Unique daily session index plus embedded completion checks                                                                    | Concurrent duplicate/reward-once tests; not designed for very large scale   |
| QM-018 offset pagination           | Accepted local-project limitation | Shared bounded pagination helper                                                                                              | Parser/endpoint pagination tests; deep cursor navigation deferred           |
| QM-019 report buffering            | Accepted local-project limitation | Report controllers build bounded portfolio-scale CSV in memory                                                                | CSV endpoint/security tests; streaming deferred                             |
| QM-020/QM-021 repeated analytics   | Deferred optimization             | Correct aggregations, no proven correctness defect                                                                            | Analytics calculations/empty-state tests; performance redesign deferred     |
| QM-022 leaderboard aliases         | Mitigated compatibility           | `/api/leaderboard` is canonical; `/api/users/leaderboard` retained                                                            | Browser/client contracts use canonical endpoint                             |
| QM-023 browser duplication         | Mitigated                         | Shared utilities and dialogs introduced incrementally                                                                         | Frontend utility and E2E tests; further DOM refactoring remains incremental |
| QM-024 achievement rendering       | Fixed                             | Dynamic values are escaped before legacy templates                                                                            | Script-like/Unicode escaping tests plus CSP                                 |
| QM-025/QM-026 server duplication   | Mitigated                         | Shared normalization, pagination and Mongo search utilities                                                                   | Maintainability utility tests; large controllers remain future refactors    |
| QM-027 placeholders                | Fixed                             | Empty production placeholders were removed; no empty production files remain                                                  | Source audit and syntax loading                                             |
| QM-028 package metadata            | Fixed                             | Current entry, scripts, repository, author, engine and publication guard                                                      | `npm ci`, quality scripts and audit validation                              |
| QM-029 automated tests             | Fixed foundation                  | Jest/Supertest/database/replica-set/Playwright suite                                                                          | 230 Jest and 26 Playwright checks; coverage limitations documented          |
| QM-030 result ownership            | Fixed                             | Score query includes `_id` and authenticated `user` at `quizController.js:970-979`                                            | Foreign-result integration test                                             |
| QM-031 notification ownership      | Fixed                             | Mutation queries include authenticated user                                                                                   | Cross-user read/delete tests                                                |
| QM-032 recovery token hashing      | Fixed                             | SHA-256 hashes queried; token fields use `select: false`                                                                      | Hash-at-rest, expiry, single-use and reuse tests                            |
| QM-033 regex injection             | Fixed                             | Shared escaping in `mongoSearch.js` and controller allowlists                                                                 | Metacharacter utility and endpoint tests                                    |

## Required properties verified

- Quiz XP, counters, scores, achievements, notifications, daily completion, and session finalization commit atomically.
- Correct answers are absent from start responses and loaded authoritatively during submission.
- Completed, foreign, cancelled, processing, altered, expired, and concurrent sessions cannot grant duplicate rewards.
- Historical results remain readable after administrators disable questions.
- Administrator pages and APIs require current authentication and administrator role.
- Password reset, password change, role change, and status change revoke old sessions.
- Reset and verification responses resist account enumeration and tokens are single-use.
- Error responses omit stack traces and sensitive user fields.

## Accepted local limitations

The rate-limit store is process-local; CSV reports are memory-buffered; pagination is offset-based; daily completion storage is embedded; SMTP and Cloudinary depend on optional providers; browser automation targets Chromium. These are appropriate for the stated local portfolio scope but should be reconsidered before any public multi-instance service.

## Secret audit

No tracked real credential was identified. `.env` and `.env.save` exist locally but are ignored; their values were not printed. Tracked matches are placeholders, variable names, or explicit test-only secrets. Historical generated Playwright archives contain no known credential evidence but remain large Git objects; history was not rewritten.
