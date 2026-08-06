# Security policy and design

## Supported version

Security maintenance currently targets the unreleased `1.0.0` line on the active development branch. This repository is a local portfolio release candidate, not a public hosted service.

## Reporting a vulnerability

Do not publish secrets, tokens, reset links, private user data, or exploit details in a public issue. Contact the repository owner privately through the GitHub account associated with the repository and include:

- affected endpoint or component;
- prerequisites and minimal reproduction steps;
- observed and expected behavior;
- likely impact;
- a sanitized proof of concept, if needed.

Do not test against systems or accounts you do not own.

## Authentication

- Passwords are hashed with bcrypt using 12 salt rounds.
- JWTs require HS256, the configured issuer and audience, and a valid expiry.
- Protected requests load the current user instead of trusting role/status claims alone.
- JWTs include `tokenVersion`; password changes/resets and administrator role/status changes invalidate prior sessions.
- Authentication cookies are HttpOnly, SameSite=Lax, scoped to `/`, and Secure in production.
- Verification and recovery tokens are stored as SHA-256 hashes, expire, and are single-use.
- Account-discovery-sensitive recovery and resend endpoints return generic responses.

## Authorization and ownership

- Administrator pages and APIs apply authentication before role validation.
- User-owned results and notifications include the authenticated user in database filters.
- Profile and settings mutations derive identity from authentication, not client-provided user IDs.
- Disabled users and stale tokens are rejected on protected requests.
- Administrator self-protection rules prevent unsafe role/status mutations.

## Request and browser protections

| Control          | Implementation                                                                          |
| ---------------- | --------------------------------------------------------------------------------------- |
| Security headers | Helmet with CSP, frame denial, restricted base/form/object sources, and production HSTS |
| CORS             | Explicit origin allowlist with credentials support                                      |
| CSRF boundary    | Exact-origin checks for cookie-authenticated mutation requests                          |
| Input hardening  | JSON/form size limits and rejection of MongoDB operator/dotted keys                     |
| Query validation | Common scalar and pagination validation                                                 |
| Rate limiting    | Login, registration, verification, recovery/reset, and sensitive settings routes        |
| Error handling   | Safe JSON/HTML errors; production stacks are not returned                               |
| Static content   | ETags, bounded production cache, and no-store rendered pages                            |

Originless requests remain available for direct API clients; Bearer-token clients must protect their own credentials.

## Quiz integrity

Correct answers are never returned by quiz-start endpoints. Each attempt uses an opaque, expiring, server-issued session containing the immutable question set. Submission validates the exact set and atomically claims the session before applying score, XP, counters, daily completion, achievements, notifications, and final status.

Unique indexes and transaction tests cover replay and concurrent submission. Results are readable only by their owner.

## Content, files, and exports

- Notification links accept only safe same-origin relative paths.
- Dynamic browser values are escaped or assigned as text under a restrictive CSP.
- Avatar uploads are limited to JPEG, PNG, and WebP, maximum 5 MB, with MIME/signature/structure/dimension validation.
- CSV output quotes fields and neutralizes spreadsheet formula prefixes.
- Passwords, token hashes, token versions, and sensitive internal fields are not returned in safe user objects.

## Secret management

Never commit `.env`, database URIs, JWT secrets, SMTP credentials, Cloudinary secrets, bearer tokens, or captured cookies. Production requires a JWT secret of at least 32 bytes and matching HTTPS application/client origins.

Rotate a secret immediately if exposure is suspected. Changing `JWT_SECRET` invalidates all JWTs; incrementing a user's `tokenVersion` invalidates that user's existing sessions.

## Known deployment limitations

| Limitation                     | Required action before relevant scale                            |
| ------------------------------ | ---------------------------------------------------------------- |
| Process-local rate-limit store | Use a shared store before multi-instance deployment.             |
| Buffered CSV reports           | Stream or queue large exports.                                   |
| Offset pagination              | Consider cursor pagination for large collections.                |
| Embedded daily completions     | Move to a dedicated collection at high volume.                   |
| Optional provider trust        | Review SMTP and Cloudinary configuration and retention policies. |

## Security verification

```bash
npm run check
npm run test:integration
npm run test:e2e
npm run audit:prod
```

The current suite covers JWT constraints, session revocation, role checks, ownership, recovery tokens, quiz transactions/replay, CSP/origin behavior, upload validation, safe links, CSV encoding, and input hardening.
