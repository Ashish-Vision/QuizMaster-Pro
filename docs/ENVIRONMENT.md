# Environment configuration

Copy `.env.example` to `.env`. The example contains placeholders only; replace secret values locally and never commit `.env`, `.env.save`, tokens, or connection strings.

## Core variables

| Variable         | Required                    | Local guidance                                                                    |
| ---------------- | --------------------------- | --------------------------------------------------------------------------------- |
| `NODE_ENV`       | Yes                         | Use `development` locally and `test` only in automated tests.                     |
| `PORT`           | No                          | Defaults to `5000`.                                                               |
| `MONGODB_URI`    | Yes                         | Use a local replica-set URI; quiz transactions do not work on standalone MongoDB. |
| `JWT_SECRET`     | Yes                         | Random value of at least 32 characters; never reuse the example.                  |
| `JWT_EXPIRES_IN` | No                          | Defaults to `7d`.                                                                 |
| `JWT_ISSUER`     | No                          | Defaults to `quizmaster-pro`.                                                     |
| `JWT_AUDIENCE`   | No                          | Defaults to `quizmaster-pro-users`.                                               |
| `APP_ORIGIN`     | Required for secure links   | Normally `http://localhost:5000` locally.                                         |
| `CLIENT_ORIGIN`  | Required for browser access | Must match the local browser origin.                                              |

## Email

Verification and recovery delivery uses `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM_NAME`, and `EMAIL_FROM_ADDRESS`. Use an app-specific credential or a disposable local mail account. Automated tests mock delivery and never require SMTP.

`EXPOSE_DEVELOPMENT_RESET_URL` defaults to `false`. Setting it to `true` exposes a reset URL only while `NODE_ENV=development`; use it solely for local recovery-flow testing.

## Avatar storage

Avatar upload requires `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`. Other features work without avatar upload when these optional integration values are absent.

## Test variables

Tests set their own JWT values and create generated database URIs. `MONGOMS_SYSTEM_BINARY` may point to a local `mongod`; otherwise the harness uses `/usr/bin/mongod` when available or lets `mongodb-memory-server` manage MongoDB 8.0.28.

Do not set a developer database URI in test scripts. Transaction suites create an isolated single-node WiredTiger replica set and remove their temporary data during teardown.

## Startup validation

`server/config/env.js` checks the essential JWT/origin configuration and applies stronger invariants when `NODE_ENV=production`. Database connection errors identify the missing configuration without printing its value.

For this portfolio repository, use local development settings and review `.env.example` whenever source usage changes.
