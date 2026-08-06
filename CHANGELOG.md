# Changelog

## [1.0.0] - Unreleased

### Added

- Server-issued standard and daily quiz sessions with opaque identifiers and expiry.
- Shared browser design/accessibility foundations and comprehensive local QA documentation.
- Jest unit/contract/integration suites, replica-set transaction tests, and desktop/mobile Playwright audits.
- GitHub repository quality workflow and contribution/issue templates.

### Changed

- Consolidated normalization, pagination, Mongo search, CSV, URL, and browser utilities.
- Bounded leaderboard queries and added deterministic ranking/index behavior.
- Professionalized local setup, API, architecture, environment, security, testing, and portfolio documentation.

### Fixed

- Administrator question routing and ordinary-user dashboard API regression.
- Inactive-question selection while preserving already-issued and historical sessions.
- Responsive overflow, keyboard navigation, dialog focus, and validation focus behavior.

### Security

- Added transactional replay/concurrency protection and atomic XP/counter updates.
- Enforced JWT algorithm, issuer, audience, expiry, token version, and session revocation.
- Hardened ownership, notification links, CSV cells, uploads, request keys, CSP, origins, cookies, rate limits, and error responses.

### Testing

- Validated 230 Jest tests and 26 desktop/mobile Playwright checks.
- Covered quiz rollback, concurrency, authentication invalidation, feature calculations, admin CRUD, safe rendering, and accessibility structure.

### Documentation

- Added final security, frontend, backend, project, release, screenshot, manual-QA, and environment guides.

## 1.0.0-rc.1 - 2026-08-05

- Added server-issued, expiring, single-use quiz sessions and transactional completion.
- Preserved historical result ownership while excluding inactive questions from new attempts.
- Hardened JWT validation/session revocation, notification links, CSV exports, request keys, avatar signatures, CSP, CORS/origin checks, cookies, errors, and production configuration.
- Repaired administrator question routing and the user dashboard API contract.
- Bounded leaderboard reads and added its ranking index.
- Added health/readiness operations, public legal pages, Jest/Playwright tooling, and release documentation.
