# Testing

QuizMaster Pro uses Jest and Supertest for unit/API/database tests and Playwright for browser flows. All automated database tests create temporary isolated databases and must never target a developer or production database.

## Prerequisites

- Node.js and npm versions compatible with `package-lock.json`
- MongoDB server binary available at `/usr/bin/mongod` for the current integration harness
- Chromium installed for Playwright

Install dependencies and the browser once on a new workstation:

```bash
npm ci
npx playwright install chromium
```

The integration harness currently pins MongoDB 8.0.28. Quiz completion and inactive-question tests use a single-node `MongoMemoryReplSet` with WiredTiger because MongoDB transactions require a replica set. Other database tests use an isolated `MongoMemoryServer` when transactions are not involved.

## Commands

```bash
npm test                 # complete Jest suite
npm run test:watch       # interactive Jest watch mode
npm run test:integration # database integration suites only
npm run test:coverage    # Jest with text and LCOV coverage
npm run test:e2e         # desktop and mobile Chromium
npm run check            # syntax, lint, formatting, and Jest
npm run audit:prod       # production dependency audit
```

`npm run check` is the standard local quality gate. E2E remains separate because it starts a fixture server and two browser projects and therefore takes longer.

## Test categories

- Utility/security tests cover JWT configuration, input hardening, file signatures, notification links, CSV encoding, normalization, pagination, and browser helpers.
- Route-contract tests verify middleware ordering, user/admin authorization, assets, and API mapping.
- Database integration tests cover authentication revocation, recovery tokens, ownership, platform features, inactive questions, and historical behavior.
- Replica-set integration tests cover server-authoritative quiz completion, replay/concurrency safety, daily challenge consistency, and transaction rollback.
- Playwright audits all rendered pages for hydration failures, console/page errors, overflow, responsive behavior, keyboard dialogs/navigation, and representative accessibility structure.

## Test database safety

- Test files set `NODE_ENV=test` before importing the application.
- Each database suite starts its own temporary MongoDB process and receives a generated connection URI.
- Collections are cleared between cases; no shared developer database URI is used.
- Teardown disconnects Mongoose and stops the temporary MongoDB process.
- Email is mocked where recovery/verification behavior is tested.
- Browser E2E uses deterministic API fixtures and synthetic user IDs, not real accounts.

Never add a normal development or production MongoDB URI to a test command. Never enable real SMTP or Cloudinary credentials in automated tests.

## Coverage

`npm run test:coverage` prints statement, branch, function, and line coverage and writes an HTML report to `coverage/lcov-report/index.html`. Coverage is diagnostic: prioritize security boundaries, ownership, transactions, and domain calculations rather than pursuing artificial 100% coverage.

## Expected duration

On a typical local workstation:

- Jest: approximately 30–60 seconds, including temporary MongoDB startup
- Coverage: approximately 40–90 seconds
- Playwright desktop/mobile: approximately 40–60 seconds

The first run can take longer if `mongodb-memory-server` or Playwright must obtain a binary. This repository prefers the system MongoDB binary to keep later runs deterministic.

## Troubleshooting

### MongoDB binary not found

Install a compatible local MongoDB server or update the test-only `systemBinary` configuration consistently. Confirm with:

```bash
/usr/bin/mongod --version
```

### Transaction tests fail immediately

Confirm the suite uses `MongoMemoryReplSet`, WiredTiger, and a replica-set URI. A standalone MongoDB process cannot execute multi-document transactions.

### Port 5000 is already in use

Stop the local development server before E2E, or allow Playwright to reuse the already-running fixture-compatible test server. The E2E server binds only to `127.0.0.1`.

### Chromium is missing

Run `npx playwright install chromium` and repeat `npm run test:e2e`.

### Tests hang after completion

Run Jest with `--detectOpenHandles`. Check that temporary MongoDB instances, timers, HTTP servers, and Mongoose connections are stopped in teardown.

### Rate-limit tests become inconsistent

Do not share accounts or mutable request counters across cases. Use unique synthetic emails and keep limiter tests serial and deterministic.
