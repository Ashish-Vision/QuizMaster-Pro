# QuizMaster Pro v1.0.0 release notes

QuizMaster Pro v1.0.0 is a local portfolio release candidate demonstrating a complete server-rendered quiz application, a security-focused Node/MongoDB backend, responsive vanilla-JavaScript interfaces, and professional automated testing.

## User features

Accounts support verification, recovery, login/logout, session invalidation, profile/avatar management, and settings. Learners can start standard or daily quizzes, earn XP and achievements, maintain streaks, review owned results/history, compare leaderboard rank, inspect analytics, and manage notifications.

## Administrator features

Administrators have protected dashboards for questions, categories, users, attempts, analytics, achievements, notifications, CSV reports, activity logs, and platform settings. Role/status changes invalidate existing sessions, and saved result history protects referenced questions.

## Security and correctness

Quiz sessions are opaque, expiring, owned, and single-use. Completion uses a MongoDB transaction, exact server-selected question validation, atomic state claims, unique indexes, and deterministic replay behavior. Authentication pins JWT claims and token versions. Ownership, CSP, origin checks, uploads, notification links, CSV exports, and recovery tokens are hardened and regression-tested.

## Test summary

- 232 Jest unit, contract, security, database, transaction, and concurrency tests
- 28 Playwright desktop/mobile checks
- MongoDB 8.0.28 isolated test databases and WiredTiger replica-set transaction suites
- Fresh coverage: 59.48% statements, 38.89% branches, 53.77% functions, 59.48% lines
- Production dependency audit: zero known vulnerabilities at validation time

## Local setup

Install with `npm ci`, copy `.env.example`, configure a local MongoDB replica set, optionally seed questions, and run `npm run dev`. Full instructions are in README and `docs/ENVIRONMENT.md`.

## Known limitations

This is not a hosted or production-certified service. Rate limits are process-local, CSV reports are memory-buffered with a maximum of 1,000 export rows, pagination is offset-based with page sizes capped at 100, and daily completions are embedded in one document per 24-hour challenge. Optional integrations require external credentials, and browser automation currently targets Chromium. The repository is `UNLICENSED` and all rights are reserved as described in `LICENSE`.
