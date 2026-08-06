# Project roadmap

The roadmap distinguishes verified release work from potential improvements. Items are not commitments until they are designed, approved, and implemented.

## Version 1.0 release readiness

| Area                                       | Status   | Evidence or remaining work                                |
| ------------------------------------------ | -------- | --------------------------------------------------------- |
| Learner and administrator workflows        | Complete | Current routes, views, controllers, and browser audits    |
| Quiz integrity and transaction safety      | Complete | Replica-set rollback, replay, and concurrency tests       |
| Authentication and authorization hardening | Complete | Security and integration suites                           |
| Core technical documentation               | Complete | Root documentation set and detailed `docs/` references    |
| Desktop/mobile Chromium automation         | Complete | Playwright audit                                          |
| Reviewed screenshots                       | Pending  | Capture from synthetic local data                         |
| Demo video                                 | Pending  | Record a two-to-three-minute reviewed walkthrough         |
| Social preview/profile polish              | Pending  | Requires approved visual assets and account-level actions |
| Final release commit/tag                   | Pending  | Owner acceptance after manual release checklist           |

## Near-term quality work

- Add Firefox and WebKit browser projects where the supported CI/runtime environment permits.
- Complete manual screen-reader and assistive-technology review.
- Expand direct tests for the largest administrator and profile controllers.
- Capture reviewed learner and administrator screenshots.
- Add deployment-specific operational guidance only after a deployment target is selected.

## Scale-driven improvements

These changes should follow profiling with representative data:

| Candidate                                  | Trigger                                                       |
| ------------------------------------------ | ------------------------------------------------------------- |
| Shared rate-limit store                    | More than one application process                             |
| Cursor pagination                          | Material deep-page latency or large collections               |
| Streamed/background CSV exports            | Reports become large enough to create memory/latency pressure |
| Materialized analytics rollups             | Repeated global aggregations become a measured bottleneck     |
| Dedicated daily-completion collection      | Embedded completion arrays approach operational limits        |
| Search service or normalized prefix fields | Administrator regex search becomes slow at scale              |

## Security and resilience candidates

- Decode and re-encode uploaded avatars, including metadata stripping.
- Add deployment-specific secret rotation and backup/restore runbooks.
- Introduce a shared rate-limit store for multi-instance environments.
- Review external SMTP and Cloudinary retention, access, and incident procedures before public deployment.

## Architecture principles

Future changes should preserve:

- server-authoritative scoring and immutable issued question sets;
- atomic quiz completion and deterministic replay handling;
- current-user ownership filters and fresh role/status validation;
- explicit route contracts and bounded input/query values;
- accessible, responsive interaction without requiring a frontend framework rewrite.

## Explicitly out of scope for the current release

- A public hosted service or deployment platform
- Native mobile applications
- Real-time multiplayer quizzes
- Public administrator creation
- A frontend framework migration

These exclusions reflect the current source; they are not announced future features.
