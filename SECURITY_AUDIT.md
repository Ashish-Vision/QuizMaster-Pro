# QuizMaster Pro — Security Audit

Date: 2026-08-05  
Scope: JWT, cookies, Helmet, CORS, MongoDB query construction, XSS, CSRF, rate limiting, validation, password reset/email verification, file uploads, and environment-variable handling in the current repository. No source files were modified.

## Executive summary

QuizMaster Pro has several strong controls already in place:

- JWT signing and verification pin HS256 and consistently enforce issuer, audience, expiration, and per-user token version.
- Authentication cookies are `HttpOnly`, `SameSite=Lax`, path-scoped to `/`, and `Secure` in production.
- Every administrator API router applies authentication and administrator authorization.
- Password-reset and verification tokens use 32 cryptographically random bytes and are stored only as SHA-256 hashes with expirations.
- Password reset and authenticated password change invalidate existing sessions.
- Passwords are bcrypt-hashed with cost 12 and length-limited before hashing.
- CORS uses an exact origin allowlist with credentials rather than wildcard origins.
- JSON and URL-encoded request bodies are limited to 1 MB.
- MongoDB filters are generally built from normalized scalar fields; regex metacharacters are escaped.
- Avatar uploads are authenticated, memory-only, limited to one 5 MB JPEG/PNG/WebP file, transformed by Cloudinary, and stored as Cloudinary HTTPS URLs.
- Administrator-created notification destinations use a focused same-origin-path validator.
- `.env` and `.env.*` are ignored; only the placeholder `.env.example` is tracked.

The most important verified risks are:

1. **Critical:** quiz submission remains client-authoritative and replayable; the existing QuizSession model is not used by the standard quiz flow.
2. **High:** cookie-authenticated mutations have no explicit CSRF token or Origin/Referer enforcement.
3. **High:** reset and verification links fall back to the request Host header when application origins are absent.
4. **High:** Content Security Policy is disabled while client code contains unsafe dynamic `innerHTML` sinks.
5. **Medium:** rate limits use the default process-local store and primarily an IP key, so multi-instance and distributed abuse are weakly controlled.
6. **Medium:** upload filtering trusts the multipart MIME declaration before handing bytes to Cloudinary.
7. **Medium:** JWT/environment configuration is checked for presence, not strength, validity, or production safety.

## Risk rating summary

| ID | Severity | Status | Finding |
|---|---|---|---|
| SA-001 | Critical | Confirmed | Client-authoritative quiz submissions permit replay/XP farming and bypass the unused QuizSession design |
| SA-002 | High | Confirmed | No explicit CSRF defense for cookie-authenticated mutations |
| SA-003 | High | Confirmed, configuration-dependent | Password-reset and verification URL Host-header poisoning fallback |
| SA-004 | High | Confirmed | CSP disabled despite dynamic HTML injection sinks |
| SA-005 | Medium | Confirmed | DOM XSS sinks interpolate error/achievement values into `innerHTML` |
| SA-006 | Medium | Confirmed | Process-local/IP-centric rate limiting is insufficient for scaled or distributed deployments |
| SA-007 | Medium | Confirmed | Request validation is manual, duplicated, and does not consistently reject malformed/unknown inputs |
| SA-008 | Medium | Confirmed | Search inputs have no length bound, enabling expensive regex-driven resource consumption |
| SA-009 | Medium | Confirmed | Upload validation trusts client MIME and buffers the full file in application memory |
| SA-010 | Medium | Confirmed | Production environment and JWT-secret strength are not validated at startup |
| SA-011 | Medium | Confirmed | Email verification mutates state on GET and can be consumed by scanners/prefetchers |
| SA-012 | Low | Confirmed | Cookie lifetime is hard-coded separately from JWT lifetime and cookie name lacks `__Host-` hardening |
| SA-013 | Low | Confirmed | Development origins remain in the production CORS allowlist |
| SA-014 | Low | Confirmed | Health endpoint reveals runtime environment |

No finding was identified for NoSQL operator injection in the reviewed query paths, JWT algorithm confusion, raw reset-token storage, wildcard credentialed CORS, arbitrary notification redirects, or unrestricted upload size/type.

## Detailed findings

### SA-001 — Quiz submission is client-authoritative and replayable

- Severity: **Critical**
- Category: MongoDB/domain integrity, authorization, validation
- Files:
  - `server/routes/quizRoutes.js:18-20`
  - `server/controllers/quizController.js:143-202`
  - `server/controllers/quizController.js:225-253`
  - `server/controllers/quizController.js:299-359`
  - `server/controllers/quizController.js:624-635`
  - `server/models/QuizSession.js:1-190`
- Evidence: standard quiz start returns random questions but does not create a QuizSession. Submission accepts client-supplied `category`, question IDs, timing values, and optional `dailyChallengeId`. It creates a result and awards user progression, but no server-issued single-use session identifier is required. The QuizSession model and uniqueness indexes exist, yet this controller path does not use them.
- Impact: an authenticated user can resubmit the same valid question/answer set to create new Scores and repeatedly earn XP/counters/achievements. Client timing and selection scope are not anchored to a server-issued attempt. Concurrent submissions can amplify the impact and create inconsistent side effects.
- Recommended fix: complete the planned flow. `POST /api/quiz-sessions` must persist user/category/question IDs/mode/start/expiry and return only sanitized questions. Submission must accept only `quizSessionId` and selected answers, atomically claim an active unexpired session, validate exactly its questions, and complete Score, XP/counters, achievements, daily completion, notifications, and session result/status in a MongoDB transaction. Preserve database unique constraints on Score.quizSession and QuizSession.result and add concurrent duplicate-submission tests.

### SA-002 — No explicit CSRF defense for cookie-authenticated mutations

- Severity: **High**
- Category: CSRF, cookies, CORS
- Files:
  - `server/utils/helpers.js:12-21`
  - `server/middleware/authMiddleware.js:27-39`
  - state-changing route definitions throughout `server/routes/authRoutes.js:21-25`, `settingsRoutes.js:21-23`, `profileRoutes.js:27-35`, `notificationRoutes.js:23-27`, and all admin mutation routers
- Evidence: the JWT is accepted from the `quizmaster_token` cookie before the Authorization header. The cookie uses `SameSite: "lax"`, but no synchronizer token, signed double-submit token, custom CSRF header validation, or Origin/Referer check is present. CORS is configured, but CORS controls response reading and does not by itself prevent every cross-site request from reaching the server.
- Impact: SameSite=Lax blocks many cross-site POST/PATCH/DELETE cases, substantially reducing risk, but it is not a complete CSRF policy. Same-site sibling-domain compromise, browser/client edge cases, future GET mutations, or a future cookie change could expose state-changing endpoints. `GET /api/email-verification/verify/:token` already mutates state.
- Recommended fix: for cookie-authenticated unsafe methods, require a CSRF token or a server-validated custom header plus strict Origin/Referer allowlist. Separate Bearer-token API clients from cookie/browser behavior. Keep SameSite and CORS as defense in depth. Add integration tests proving cross-origin unsafe requests fail before controller execution.

### SA-003 — Reset/verification URLs can trust a hostile Host header

- Severity: **High**
- Status qualification: exploitable when neither applicable origin environment variable is set; production configuration should eliminate, not merely document, this state.
- Category: password reset, environment variables
- Files:
  - `server/controllers/passwordResetController.js:22-27`
  - `server/controllers/emailVerificationController.js:16-21`
  - `.env.example:11,20`
- Evidence: password reset uses `CLIENT_ORIGIN || APP_ORIGIN`, and verification uses the reverse order. If both are absent, each constructs the emailed link from `req.protocol` and `req.get("host")`. Host is request-controlled unless strictly normalized by a trusted proxy/deployment layer.
- Impact: an attacker may request a reset or resend for a victim while supplying a hostile Host header. The victim can receive a legitimate email whose token-bearing link points to the attacker-controlled host; visiting it exposes the raw token to that host. The generic response prevents account enumeration but does not prevent link poisoning.
- Recommended fix: require and validate one canonical `APP_ORIGIN` at production startup; build every external URL from it. Require HTTPS in production, reject userinfo/path/query components, normalize trailing slash, and never fall back to request headers for security emails. Optionally validate incoming Host against an allowlist at the reverse proxy and Express layer.

### SA-004 — Helmet CSP is disabled

- Severity: **High**
- Category: Helmet, XSS
- File: `server/app.js:73-78`
- Evidence: Helmet is enabled, but `contentSecurityPolicy: false`; `crossOriginEmbedderPolicy` is also disabled. Other Helmet defaults still apply, but the strongest browser-side mitigation against script injection is absent.
- Impact: any stored/reflected/DOM injection that reaches an executable context has no CSP boundary. This matters because the frontend has numerous `innerHTML` template sites and currently contains unescaped dynamic sinks (SA-005).
- Recommended fix: deploy a nonce- or hash-based CSP. Start in `Content-Security-Policy-Report-Only`, inventory scripts/styles/images/connect/font sources, remove inline event handlers/scripts, then enforce. A target should include `default-src 'self'`, nonce-based `script-src`, restricted `style-src`, `img-src 'self' https://res.cloudinary.com data:` only if needed, `connect-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, and `form-action 'self'`. Keep COEP disabled only if third-party resources genuinely require it and document why.

### SA-005 — Dynamic values reach `innerHTML`

- Severity: **Medium**
- Category: XSS
- Files:
  - `client/js/dashboard.js:477-488`
  - `client/js/dashboard.js:655-664`
  - `client/js/achievements.js:125-180`
- Evidence: dashboard leaderboard and achievement error messages are directly interpolated into `innerHTML`. Achievement icon/category/title/description/requirement fields are also interpolated without HTML escaping. Many other client modules use `textContent` or local `escapeHtml`, demonstrating the safer pattern, but it is not universal.
- Exploitability: dashboard error messages usually originate from server-controlled messages, and achievement definitions are currently code-defined, so direct untrusted exploitation is constrained today. However, data provenance can change, database contents may be administratively influenced in the future, and API/proxy errors can unexpectedly include reflected content. The sink is still unsafe by construction, and CSP is disabled.
- Recommended fix: construct DOM nodes and assign `textContent`; do not rely on ad hoc escaping. If HTML rendering is truly required, use a reviewed sanitizer with an explicit allowlist. Add a lint rule such as `no-unsanitized/property` and tests containing `<img src=x onerror=...>` in every API-rendered string.

### SA-006 — Rate limiting is process-local and primarily IP-based

- Severity: **Medium**
- Category: rate limiting
- Files:
  - `server/middleware/rateLimitMiddleware.js:5-22`
  - `server/middleware/rateLimitMiddleware.js:30-74`
  - `server/app.js:57-59`
  - `server/routes/emailVerificationRoutes.js:10-16`
- Evidence: `express-rate-limit` is used without an external `store` or custom `keyGenerator`, so the default in-memory store and IP key apply. A restart clears counters; multiple application instances maintain independent counters. Verification resend reuses the password-forgot limiter and message.
- Impact: attackers can distribute requests across IPs/instances, abuse large NAT populations, or reset effective limits across deployments. Email endpoints can still be used to generate repeated messages because no per-account/email cooldown is enforced independently of IP. Expensive authenticated analytics/export endpoints have no specific limits.
- Recommended fix: use a shared Redis-compatible store; combine normalized account/email and IP keys for login/reset/resend; enforce per-account cooldowns; create a dedicated verification limiter; add stricter limits/concurrency controls for exports and expensive analytics. Ensure proxy trust is configured to the exact hop count, not a deployment-agnostic assumption.

### SA-007 — Validation is manual and inconsistent

- Severity: **Medium**
- Category: validation, Mongo queries
- Files:
  - representative manual validation: `server/controllers/authController.js:20-75`, `passwordResetController.js:193-237`, `adminQuestionController.js:309-411`, `settingsController.js:183-253`
  - global error handling: `server/middleware/errorHandler.js:10-25`
- Evidence: controllers independently normalize and validate request values. Unknown body keys are usually ignored, `Number.parseInt` accepts partial numeric strings, query values are inconsistently rejected/defaulted, and Mongoose CastError/ValidationError/duplicate-key errors are not centrally mapped by the global handler.
- Impact: validation gaps and inconsistent error handling expand the attack surface, obscure client mistakes, and can turn malformed database inputs into generic 500 responses. Duplicated logic is harder to audit and keep aligned with model constraints.
- Recommended fix: apply schemas for params/query/body at the route boundary, reject unknown keys on security-sensitive operations, use explicit maximum string/array sizes, and centrally translate CastError→400, validation→400/422, and duplicate key→409. Continue selecting individual Mongo filter fields rather than passing request objects.

### SA-008 — Unbounded search strings can cause resource exhaustion

- Severity: **Medium**
- Category: Mongo queries, validation, denial of service
- Files:
  - `server/controllers/adminQuestionController.js:139-177`
  - `server/controllers/adminAttemptController.js:163-218`
  - `server/controllers/adminNotificationController.js:87-135`
  - `server/controllers/adminActivityLogController.js:65-101`
  - `server/controllers/adminUserController.js:82-135`
- Evidence: regex metacharacters are escaped, which prevents attacker-supplied regex operators/catastrophic patterns. However, search terms have no common maximum length and use unanchored case-insensitive regex over multiple fields, forcing expensive scans. Admin protection reduces exposure but compromised/abusive admin sessions and concurrency remain relevant.
- Impact: long or repeated searches can consume MongoDB CPU and I/O, degrading availability. Admin export/analytics endpoints can compound resource pressure.
- Recommended fix: cap normalized search length (for example 100–200 characters), reject controls, apply endpoint rate/concurrency limits, set database operation time budgets where appropriate, and move scalable search to Atlas Search or indexed normalized fields.

### SA-009 — Upload validation trusts declared MIME and buffers in memory

- Severity: **Medium**
- Category: file uploads
- Files:
  - `server/middleware/uploadMiddleware.js:5-38`
  - `server/controllers/profileAvatarController.js:21-60`
  - `server/controllers/profileAvatarController.js:63-109`
- Evidence: Multer permits only declared JPEG/PNG/WebP MIME types and caps one file at 5 MB, but it does not inspect magic bytes or decode the image locally. `memoryStorage` holds the complete upload buffer. Cloudinary is called with `resource_type: "image"` and transformations, which is a valuable downstream validation/re-encoding boundary.
- Impact: a client can lie about multipart MIME, causing malicious or malformed bytes to reach Cloudinary and consume memory/network/work. Concurrent 5 MB uploads can pressure application memory. Cloudinary rejecting non-images limits stored-content risk but does not eliminate resource abuse.
- Recommended fix: verify file signatures and decode/re-encode with a maintained image library before upload, enforce pixel/dimension limits to prevent decompression bombs, stream where practical, strip metadata, and rate-limit avatar changes per user/IP. Keep Cloudinary image-only mode and generated public IDs.

### SA-010 — Environment and JWT secret validation is incomplete

- Severity: **Medium**
- Category: JWT, environment variables
- Files:
  - `server/utils/authToken.js:9-25`
  - `server/utils/authToken.js:50-75`
  - `server/server.js:1-18`
  - `.env.example:1-26`
- Evidence: JWT algorithm/issuer/audience are correctly pinned, but `JWT_SECRET` is checked only for presence. `JWT_EXPIRES_IN` is passed through without startup validation. `NODE_ENV`, origins, MongoDB TLS expectations, SMTP mode, and Cloudinary settings are validated only when individual paths run. The example secret is an obvious placeholder, but startup does not reject it.
- Impact: a short/default/placeholder secret permits offline guessing and token forgery; malformed expiry/origin/proxy configuration can silently weaken controls or fail at runtime. A misspelled production environment disables Secure cookies and changes error/reset behavior.
- Recommended fix: validate the complete environment before importing/starting the app. Require a high-entropy secret (at least 32 random bytes; preferably 256 bits), reject known placeholders, validate duration bounds, require `NODE_ENV=production`, HTTPS canonical origin, production Mongo TLS policy, and required email/storage variables. Prefer a secret manager and rotation plan rather than long-lived `.env` secrets.

### SA-011 — Verification token is consumed by GET

- Severity: **Medium**
- Category: email verification, CSRF/safe-method semantics
- Files: `server/routes/emailVerificationRoutes.js:14`; `server/controllers/emailVerificationController.js:94-146`
- Evidence: GET hashes the token, finds the user, marks the email verified, and clears the token.
- Impact: mail security scanners, link preview tools, browser prefetch, or accidental navigation may consume the token without deliberate confirmation. This does not grant an attacker a logged-in session, but it changes account security state and can confuse the user.
- Recommended fix: GET should validate/render a confirmation page; POST should consume the token. Make repeat confirmation idempotently friendly. Keep tokens hashed, expiring, and single-use.

### SA-012 — Cookie and JWT lifetimes can diverge

- Severity: **Low**
- Category: JWT, cookies
- Files: `server/utils/helpers.js:12-21`; `server/utils/authToken.js:64`
- Evidence: cookie `maxAge` is fixed at seven days, while JWT expiry is configurable. The cookie is named `quizmaster_token`, not with the `__Host-` prefix.
- Impact: mismatched lifetimes create stale cookies or unintentionally longer browser persistence than the configured session policy. Missing `__Host-` forfeits browser enforcement that the cookie is Secure, host-only, and path `/`.
- Recommended fix: derive both lifetimes from one validated configuration. In production use `__Host-quizmaster_token` with `Secure`, no Domain, and Path `/`; plan a backward-compatible migration/clear of the old cookie. Consider shorter access-token lifetime plus controlled renewal for sensitive deployments.

### SA-013 — Development origins are always CORS-allowed

- Severity: **Low**
- Category: CORS
- Files: `server/app.js:84-88`, `server/app.js:90-118`
- Evidence: localhost and 127.0.0.1 origins are included even in production. Exact origin comparison and credential support are otherwise correct; requests with no Origin are allowed for non-browser/server clients.
- Impact: production unnecessarily trusts browser JavaScript served from a local development origin. Browser cookie host rules often limit practical impact, but the allowlist is broader than required and can matter in unusual local-proxy/development-cookie setups.
- Recommended fix: include local origins only outside production; parse and validate `CLIENT_ORIGIN` at startup; support an explicit comma-separated production allowlist if needed. Do not block missing-Origin requests as a CSRF solution—use explicit CSRF controls.

### SA-014 — Health endpoint exposes environment

- Severity: **Low**
- Category: information disclosure
- File: `server/app.js:396-402`
- Evidence: unauthenticated `/api/health` returns the current `NODE_ENV` value.
- Impact: minor deployment detail disclosure useful for fingerprinting/misconfiguration discovery.
- Recommended fix: return only health/status and a timestamp or opaque build ID; expose detailed readiness/dependency information only to an authenticated/internal monitoring route.

## Control-by-control assessment

### JWT

**Pass:** `server/utils/authToken.js:55-75` uses HS256 consistently for sign/verify, an algorithms allowlist, issuer, audience, expiration, and token version. `server/middleware/authMiddleware.js:52-93` rejects missing/invalid/legacy versions. Password reset and password change increment token version at `server/controllers/passwordResetController.js:267-273` and `server/controllers/settingsController.js:250-259`.

**Improve:** validate secret entropy/configuration (SA-010), align lifetime with cookie (SA-012), and consider storing a hash of refresh/session identifiers if adding long-lived refresh tokens. Current stateless JWTs cannot individually revoke one device; token version revokes all devices, which is safe but coarse.

### Cookies

**Pass:** `HttpOnly`, production `Secure`, `SameSite=Lax`, and Path `/` are set centrally; clearing reuses matching options (`server/utils/helpers.js:12-29`). JWT is not returned in JSON.

**Improve:** explicit CSRF defense, `__Host-` prefix, unified expiry, and production startup validation. Ensure HTTPS termination and `trust proxy` settings match the actual proxy topology.

### Helmet

**Pass:** Helmet default headers remain enabled.

**Fail/Improve:** CSP is explicitly disabled (SA-004). COEP is disabled; this is not inherently vulnerable but should be justified by external resource requirements.

### CORS

**Pass:** exact allowlist, credentials enabled, explicit methods/headers, denied origins get 403. There is no wildcard+credentials error.

**Improve:** production-only origins and startup validation (SA-013). CORS must not be treated as CSRF protection.

### MongoDB queries

**Pass:** reviewed controllers build filters from known keys, validate ObjectIds for identifier routes, escape search regexes, and do not pass raw `req.body`/`req.query` as a Mongo selector/update. No `$where`, `$function`, mapReduce, or user-controlled aggregation stage was found. Admin settings restrict keys to database-defined settings before assignment (`server/services/platformSettingsService.js:216-253`).

**Improve:** bound search cost (SA-008), centralize schemas (SA-007), complete QuizSession atomicity (SA-001), and use transactions/unique constraints for cross-document invariants.

### XSS

**Pass:** EJS unescaped tags are used only for static partial includes in the located views. Most user/API values are assigned through `textContent`; admin templates generally use `escapeHtml`. Notification links are server-validated as internal paths (`server/utils/notificationLinkValidator.js:19-74`). Email templates escape interpolated HTML (`server/services/emailService.js:98+`).

**Improve:** eliminate remaining dynamic `innerHTML` sinks and enforce CSP (SA-004/005). Avoid putting URLs inside CSS `style` strings; assign validated `img.src` or CSS properties after strict URL validation.

### CSRF

**Partial:** SameSite=Lax and exact-origin CORS provide meaningful defense in depth.

**Missing:** no explicit token/header/origin validation for unsafe cookie-authenticated requests (SA-002). GET verification mutates state (SA-011).

### Rate limiting

**Pass:** login (10 failed/15 min), registration (5/hour), forgot/resend (5/15 min), reset submission (10/15 min), and settings changes (20/15 min) are covered and return JSON 429 with standard headers.

**Improve:** shared storage, compound keys, endpoint-specific verification limiter, account cooldowns, and expensive endpoint throttles (SA-006).

### Password reset and email verification

**Pass:** strong random tokens, hash-at-rest, expiry checks, active-user check, generic reset/resend responses, token invalidation after use/failure, bcrypt password comparison, password bounds, and session invalidation. Development-only reset URL exposure is explicitly gated by `NODE_ENV !== "production"` (`server/controllers/passwordResetController.js:117-125`).

**Improve:** canonical required origin (SA-003), reliable production environment validation (SA-010), POST verification consumption (SA-011), and token equality indexes for availability/performance. Never run a publicly reachable environment with non-production NODE_ENV, because it returns raw reset links.

### File uploads

**Pass:** auth required, one file, 5 MB limit, allowlisted declared MIME, memory-only storage, Cloudinary `resource_type: image`, fixed user-derived public ID, overwrite behavior, HTTPS URL, and transformation.

**Improve:** magic-byte/decode validation, dimension/decompression limits, streaming/rate limits, and metadata stripping verification (SA-009).

### Environment variables

**Pass:** `.env` and `.env.*` are ignored, `.env.example` contains placeholders, and Git tracks only `.env.example`. Required Mongo/JWT/Cloudinary/SMTP values are not hard-coded into source.

**Improve:** fail-fast typed configuration, production invariants, secret strength/rotation, trusted origin, and secret-manager use (SA-003/010). Local `.env` and `.env.save` files exist but are ignored; their contents were not inspected or included in this audit.

## Prioritized remediation plan

### Immediate

1. Complete QuizSession-backed, transactional, idempotent quiz submission.
2. Require a validated canonical HTTPS application origin; remove Host-header fallback from security links.
3. Add explicit CSRF protection for all cookie-authenticated unsafe methods.
4. Replace confirmed dynamic `innerHTML` sinks and begin CSP Report-Only deployment.

### Near term

1. Add centralized request validation and database error mapping.
2. Move rate limiting to shared storage and add account/email plus IP keys.
3. Validate upload signatures/dimensions and add per-user upload throttling.
4. Validate all environment values at startup and reject placeholder/weak JWT secrets.
5. Change email verification to GET validation plus POST consumption.

### Defense in depth

1. Enforce CSP with nonces/hashes after report cleanup.
2. Migrate to a `__Host-` cookie and unify cookie/JWT lifetime.
3. Remove production localhost CORS origins and environment disclosure.
4. Add security logging/alerts for rate-limit events, repeated invalid tokens, admin exports, role/status changes, and quiz-session replay conflicts.

## Required security tests

1. JWT: wrong algorithm, issuer, audience, signature, expiry, absent token version, mismatched version, disabled/deleted user, and newly issued post-password-change token.
2. Cookies: production Secure/HttpOnly/SameSite/Path, exact clearing attributes, lifetime alignment, and `__Host-` migration.
3. CSRF: cross-origin POST/PATCH/DELETE with valid cookie but missing/invalid CSRF proof must fail; Bearer behavior must remain documented.
4. CORS: allowed origin, denied origin, `null` origin policy, preflight, credentials, and production exclusion of local origins.
5. Mongo: operator-shaped JSON objects, prototype keys, malformed IDs, long searches, regex metacharacters, and query timeout/resource controls.
6. XSS: stored/reflected strings containing tags, event handlers, SVG payloads, quotes, URL schemes, and CSP violation reporting.
7. Password reset: generic enumeration response, Host spoof attempt, token hash at rest, expiration, single use, concurrent use, email failure cleanup, and old-session invalidation.
8. Verification: generic resend, per-account throttling, scanner GET not consuming token, POST single use, and canonical-origin links.
9. Uploads: spoofed MIME, polyglot/non-image bytes, oversized file, excessive pixels/decompression bomb, multiple files, unexpected field, Cloudinary rejection, and concurrent upload pressure.
10. Quiz integrity: replay, altered question IDs/category/timing, expired/wrong-user session, inactive questions, daily duplicate, and simultaneous duplicate submissions.

## Final assessment

The authentication primitives themselves are substantially hardened: token policy, cookie flags, password hashing, reset-token design, session invalidation, authorization, CORS allowlisting, and notification-link validation are all positive. Overall risk remains elevated because quiz rewards are still issued from a client-authoritative submission contract and because cookie authentication lacks an explicit CSRF layer. Fix those two issues first, then close Host-header link poisoning and deploy CSP while removing unsafe DOM sinks.
