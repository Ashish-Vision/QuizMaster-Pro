# QuizMaster Pro 1.0.0-rc.1 release checklist

Evidence date: 2026-08-05. No commit, push, merge, tag, deployment, Git-history change, destructive migration, or production data operation was performed.

## Worktree provenance

- [x] Baseline inspected: tracked tree was clean at start; existing uncommitted `playwright-report/` and `test-results/` were preserved.
- [x] Previous Codex work identified from commits `c1c0913` and `5d61fe2`; it already contained quiz sessions/transactions and several security fixes.
- [x] New changes remain visible in `git diff`; nothing is staged or committed.

## Functional and security evidence

- [x] Server-issued question set and opaque quiz session.
- [x] Attempt ownership, mode/category/question-set matching, expiry, and active-state checks.
- [x] Atomic `active` → `processing` claim and unique score-per-session index.
- [x] MongoDB transaction covers score, XP/counters, daily completion, achievements/notifications, and completed attempt.
- [x] Inactive questions excluded with legacy missing `isActive` treated as active.
- [x] Historical results ownership-scoped and unchanged.
- [x] JWT algorithm/issuer/audience/expiry/tokenVersion; password change/reset revocation.
- [x] HttpOnly, SameSite=Lax, Secure-in-production, path `/` cookie.
- [x] Production exact-origin protection on cookie-authenticated mutations and strict origin configuration.
- [x] CSP enabled; scripts restricted to self.
- [x] Notification links, CSV formula cells, MongoDB keys, avatar signatures, generic errors, and sanitized production logs hardened.
- [x] Administrator API routers apply `protect` and `adminOnly`.
- [x] Sensitive flows have route-level rate limiters.
- [ ] Shared rate-limit store — required before multi-process horizontal scaling.

## API, pages, and performance

- [x] All route modules load during Jest coverage; admin question controller mapping is corrected.
- [x] Public, user, and administrator page shells render in desktop and mobile Chromium.
- [x] Referenced local EJS CSS/JavaScript assets exist; static contract test added.
- [x] Landing-page horizontal overflow fixed on desktop and mobile.
- [x] Missing `/terms`, `/privacy`, and `/daily-challenge` page routes added.
- [x] User dashboard verified not to call administrator APIs.
- [x] Leaderboard top list bounded and supported by a compound ranking index.
- [ ] Every API success/failure/side-effect contract has an isolated integration test — blocker.
- [ ] All page loading/error/empty/content/modal/form states have live-database Playwright coverage — blocker.
- [ ] Unbounded report exports are streamed/bounded — warning for large datasets.
- [ ] Daily completions moved out of one embedded array — blocker for high-scale use; requires migration planning.

## Automated checks

- [x] `npm test`: 4 suites, 84 tests passed.
- [x] `npm run test:e2e`: 6 passed across desktop/mobile Chromium; isolated server logged expected API 500s because database-backed content APIs were not mocked.
- [x] `npm run test:coverage`: 24.86% statements, 5.16% branches, 10.18% functions, 25.08% lines.
- [x] `npm run lint`: passed with no warnings.
- [x] `npm run format:check`: passed.
- [ ] Replica-set tests for normal completion, replay, duplicate/concurrent submit, expiry, inactive questions, and rollback — blocker.
- [ ] Every mounted route has success and failure integration coverage — blocker.

## Production operations

- [x] Startup validates MongoDB URI, 32-byte JWT secret, and matching HTTPS origins.
- [x] MongoDB connection failures fail startup; SIGINT/SIGTERM close the HTTP server.
- [x] `/api/health` liveness and `/api/ready` database readiness endpoints.
- [x] One proxy hop trusted only in production; secure cookies are proxy-compatible.
- [x] Static caching enabled in production; HTML is `no-store`; stacks hidden outside development.
- [x] Railway-compatible `npm start` entry point documented.
- [x] `npm audit --omit=dev`: zero vulnerabilities.
- [ ] Production startup and readiness against a real replica-set URI — requires deployment credentials/environment.
- [ ] SMTP delivery and Cloudinary upload/delete — manual checks with dedicated non-production credentials.

## Documentation

- [x] README, `.env.example`, API, architecture, security, deployment, testing, changelog, and this checklist.
- [x] Installation, first admin, MongoDB, email, Cloudinary, security, routes, deployment, rollback, troubleshooting, and limitations documented.
- [x] No real secret values added.

## Release blockers

1. Transaction behavior has not been integration-tested on an isolated MongoDB replica set under duplicate/concurrent requests and forced rollback.
2. Controller/service coverage is far below the requested security-critical standard; every mounted route does not yet have success and failure tests.
3. Playwright currently proves page shells/assets/overflow, not all database-backed content, error, form, modal, and console-clean states.
4. The embedded daily-challenge completions array is not safe for unbounded high-scale participation; changing it requires a planned data migration.

Release verdict: **NOT READY** until blockers 1–3 are closed. Blocker 4 may be accepted only with an explicit single-instance/small-scale launch constraint and monitored document growth.
