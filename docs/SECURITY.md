# Security model

JWTs use HS256 with fixed issuer/audience, expiry, and a per-user token version. Password changes and resets increment that version. Authentication cookies are HttpOnly, SameSite=Lax, path `/`, and Secure in production.

Production startup requires a strong JWT secret and matching HTTPS application/client origins. CORS is allowlisted, and cookie-authenticated mutations require the exact application Origin. Helmet supplies CSP and browser hardening headers. Request bodies reject MongoDB operator and dotted keys. User resources are ownership-scoped and administrator routers apply both authentication and role checks.

Notification navigation is limited to same-origin relative paths. CSV cells with formula prefixes are neutralized. Avatar metadata and magic bytes must agree. Production errors hide stacks and production logs avoid request tokens and error objects.

Rate limits cover login, registration, password recovery/reset, verification resend, and sensitive settings changes. The current memory store is process-local; deploy one process or add a shared Redis-backed store before horizontal scaling.

Report suspected vulnerabilities privately to the project operator. Never place bearer tokens, reset links, database URIs, SMTP credentials, JWT secrets, or Cloudinary secrets in tickets or logs.
