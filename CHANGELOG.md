# Changelog

All notable project changes are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses semantic version identifiers.

## [Unreleased]

### Documentation

- Consolidated production-quality root documentation for installation, API contracts, database design, architecture, security, contribution workflow, and roadmap.
- Added explicit environment tables, API examples, Mermaid diagrams, schema relationships, and screenshot placeholders.

## [1.0.0] - Unreleased

### Added

- Registration, verification, authentication, recovery, profile, and account-settings workflows.
- Server-issued standard and daily quiz sessions with opaque identifiers and expiry.
- Results, history, leaderboard, analytics, XP, levels, streaks, achievements, and notifications.
- Administrator dashboards and interfaces for analytics, users, questions, categories, attempts, achievements, notifications, reports, settings, and activity logs.
- Jest unit/contract/integration suites, replica-set transaction tests, and desktop/mobile Playwright audits.
- Health/readiness endpoints and optional SMTP/Cloudinary integrations.

### Changed

- Consolidated normalization, pagination, MongoDB search, CSV, notification-link, JWT, and browser utilities.
- Bounded leaderboard reads and added deterministic ranking/index behavior.
- Established shared responsive, accessibility, form, table, modal, loading, empty, and error-state foundations.

### Fixed

- Administrator question routing and the ordinary-user dashboard API contract.
- Inactive-question selection while preserving issued and historical sessions.
- Responsive overflow, keyboard navigation, dialog focus, and validation focus behavior.
- Showcase formatting that prevented the repository quality gate from completing.

### Security

- Added transactional replay/concurrency protection and atomic score/reward updates.
- Enforced JWT algorithm, issuer, audience, expiry, token version, and session revocation.
- Hardened resource ownership, notification links, CSV cells, uploads, request keys, CSP, origins, cookies, limits, and errors.
- Stored recovery and verification tokens as expiring single-use hashes.

### Testing

- Validated 232 Jest tests and 28 Chromium desktop/mobile Playwright checks.
- Covered quiz rollback/concurrency, authentication invalidation, ownership, feature calculations, administrator CRUD, safe rendering, and representative accessibility structure.

## [1.0.0-rc.1] - 2026-08-05

### Added

- Initial release-candidate documentation and automated quality workflow.

### Fixed

- Quiz replay/integrity issues, administrator question routing, user dashboard API access, and inactive-question behavior.

### Security

- Introduced constrained JWT validation, session revocation, origin checks, upload validation, and safe export/navigation utilities.

[Unreleased]: https://github.com/Ashish-Vision/QuizMaster-Pro/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Ashish-Vision/QuizMaster-Pro/releases/tag/v1.0.0
[1.0.0-rc.1]: https://github.com/Ashish-Vision/QuizMaster-Pro/releases/tag/v1.0.0-rc.1
