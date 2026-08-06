# Security policy

## Project status

QuizMaster Pro is a locally runnable portfolio project and v1.0.0 release candidate. It is not production-certified, hosted, or covered by a formal security support SLA.

## Reporting a vulnerability

Use GitHub’s private security-advisory feature for this repository when available, or contact the repository owner privately through the profile linked in README. Do not open a public issue containing exploit details or sensitive data.

Include:

- A concise description and affected feature
- Reproduction using synthetic data
- Security impact and required preconditions
- Relevant request/response metadata with secrets removed
- Suggested mitigation, if known

Never include passwords, cookies, JWTs, reset/verification links, MongoDB URIs, SMTP credentials, Cloudinary credentials, private keys, or real user records.

## Secure local configuration

- Copy `.env.example`; replace every secret placeholder.
- Use a disposable local database and keep MongoDB off untrusted networks.
- Keep `EXPOSE_DEVELOPMENT_RESET_URL=false` unless locally testing recovery.
- Use app-specific SMTP credentials and a dedicated Cloudinary account if enabling integrations.
- Run `npm run check`, `npm run test:e2e`, and `npm run audit:prod` after changes.

## Known local-project limitations

Rate limits are process-local, reports are memory-buffered, pagination is offset-based, and daily challenge completions are embedded. SMTP/Cloudinary behavior depends on external providers. These are documented portfolio limitations, not claims of production readiness.

See `docs/FINAL_SECURITY_REVIEW.md` for the current finding-by-finding review.
