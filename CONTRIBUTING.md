# Contributing to QuizMaster Pro

Contributions should preserve the project's Express/EJS/vanilla-JavaScript architecture, security boundaries, and local reproducibility.

## Before starting

1. Search existing issues and pull requests.
2. Discuss large behavioral, schema, API, or architectural changes before implementation.
3. Report vulnerabilities privately according to [SECURITY.md](SECURITY.md).

## Development setup

```bash
git clone https://github.com/Ashish-Vision/QuizMaster-Pro.git
cd QuizMaster-Pro
npm ci
cp .env.example .env
npm run check
npm run test:e2e
```

Configure a local MongoDB replica set as described in [INSTALLATION.md](INSTALLATION.md). Tests use isolated temporary databases; never point them at developer or production data.

## Branches and commits

Use a short, scoped branch name:

```text
fix/result-ownership
docs/api-examples
test/admin-reports
refactor/notification-validation
```

Prefer Conventional Commit prefixes:

| Prefix     | Use                               |
| ---------- | --------------------------------- |
| `fix`      | Correct a confirmed defect        |
| `feat`     | Add approved behavior             |
| `docs`     | Documentation only                |
| `test`     | Test-only changes                 |
| `refactor` | Behavior-preserving restructuring |
| `security` | Security hardening or remediation |
| `chore`    | Tooling or maintenance            |

Keep commits focused. Do not mix unrelated formatting, behavior, and cleanup work.

## Coding standards

- Use CommonJS on the server and dependency-free browser JavaScript.
- Keep method/path/auth policy visible in route modules.
- Keep HTTP coordination in controllers and reusable domain logic in services/utilities.
- Validate input types, ranges, identifiers, ownership, and state before writes.
- Never trust client-provided identity, role, category, scoring, or correct-answer data.
- Prefer DOM creation and `textContent` for dynamic browser content.
- Preserve keyboard operation, visible focus, reduced-motion support, and mobile layouts.
- Use Prettier and ESLint rather than introducing unrelated manual formatting.

## Database changes

Schema or index changes must document:

- compatibility with existing documents;
- migration or backfill requirements;
- transaction and uniqueness effects;
- expected query shape and representative performance evidence;
- rollback considerations.

Do not add indexes speculatively. New quiz-completion writes must remain inside the existing transaction boundary and include replay/concurrency tests.

## Tests

Every confirmed bug fix should include a regression test that fails before the fix. Choose the narrowest appropriate level:

| Change                     | Expected verification                 |
| -------------------------- | ------------------------------------- |
| Utility/validation         | Jest unit test                        |
| Route/auth contract        | Supertest or route-contract test      |
| Persistence/ownership      | Isolated MongoDB integration test     |
| Quiz transaction           | `MongoMemoryReplSet` integration test |
| Browser interaction/layout | Playwright desktop/mobile test        |

Avoid arbitrary sleeps, real SMTP/Cloudinary calls, shared mutable fixtures, and snapshot-only behavioral assertions.

Minimum pull-request gate:

```bash
npm run check
npm run test:e2e
npm run audit:prod
```

## Documentation

Update affected API, environment, database, architecture, security, roadmap, or changelog documentation in the same pull request. Do not document unimplemented behavior.

## Pull-request checklist

- [ ] The change is scoped and explained.
- [ ] Security, compatibility, and migration effects are documented.
- [ ] Regression or behavior tests are included where appropriate.
- [ ] `npm run check` passes.
- [ ] `npm run test:e2e` passes for browser-visible changes.
- [ ] Real desktop/mobile screenshots are included for visual changes.
- [ ] No secrets, real user data, coverage output, Playwright reports, or local database files are committed.

## Review expectations

A pull request should describe what changed, why it changed, how it was tested, and any known limits. Reviewers may request smaller commits, additional ownership/security tests, migration evidence, or manual accessibility verification.
