# Contributing

QuizMaster Pro welcomes focused improvements that preserve its locally runnable Express/EJS architecture.

## Setup

1. Fork or clone the repository.
2. Run `npm ci`.
3. Copy `.env.example` to `.env` and use local placeholder-derived values.
4. Configure a local MongoDB replica set.
5. Run `npm run check` and `npm run test:e2e` before changing behavior.

## Branches and commits

Use short descriptive branches such as `fix/result-ownership` or `test/admin-reports`. Prefer Conventional Commit prefixes: `feat`, `fix`, `test`, `docs`, `refactor`, `chore`, and `security`.

Keep commits reviewable and avoid combining unrelated formatting, feature, and cleanup work.

## Coding standards

- Preserve CommonJS, EJS, CSS, and vanilla JavaScript unless an architectural change is explicitly agreed.
- Keep controllers focused and reusable domain work in services/utilities.
- Validate scalar types and ownership before database operations.
- Prefer `textContent` and DOM creation for untrusted browser data.
- Preserve keyboard behavior, visible focus, reduced motion, and mobile layouts.
- Run Prettier through `npm run format`; do not hand-edit generated reports.

## Tests

Every bug fix should include a regression test that fails without the correction. Use isolated temporary databases; transaction tests require `MongoMemoryReplSet`. Avoid sleeps, real SMTP/Cloudinary calls, snapshot-only assertions, and shared mutable fixtures.

Minimum pull-request validation:

```bash
npm run check
npm run test:e2e
npm run audit:prod
```

## Pull requests

Explain behavior, security/compatibility effects, tests, and manual QA. Include real desktop/mobile screenshots for visible changes. Do not include `.env`, credentials, real user data, coverage output, Playwright reports, or local database files.

Security vulnerabilities should follow `SECURITY.md`, not a public issue.
