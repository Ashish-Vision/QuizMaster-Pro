# Changelog

## 1.0.0-rc.1 - 2026-08-05

- Added server-issued, expiring, single-use quiz sessions and transactional completion.
- Preserved historical result ownership while excluding inactive questions from new attempts.
- Hardened JWT validation/session revocation, notification links, CSV exports, request keys, avatar signatures, CSP, CORS/origin checks, cookies, errors, and production configuration.
- Repaired administrator question routing and the user dashboard API contract.
- Bounded leaderboard reads and added its ranking index.
- Added health/readiness operations, public legal pages, Jest/Playwright tooling, and release documentation.
