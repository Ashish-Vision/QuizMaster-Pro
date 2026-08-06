# Testing

Run `npm test` for Jest, `npm run test:coverage` for coverage, and `npm run test:e2e` for desktop/mobile Chromium. Run `npx playwright install chromium` once on a new workstation.

Jest covers security utilities, application headers/public contracts, request hardening, environment validation, avatar signatures, token constraints, and quiz attempt schema invariants. Playwright visits every public, user, and administrator page with isolated synthetic identities; it does not use production credentials or external services.

Before release also run `npm run lint`, `npm run format:check`, `git diff --check`, syntax checks, `npm audit --omit=dev`, a production fail-fast smoke test, and manual SMTP/Cloudinary checks with dedicated non-production accounts.

Tests must never send real email, upload to a real Cloudinary account, or target a production database. Use a disposable MongoDB replica set for transaction integration tests.
