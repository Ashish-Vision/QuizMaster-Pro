# Installation and operation

## Prerequisites

| Requirement | Version or condition                            |
| ----------- | ----------------------------------------------- |
| Node.js     | 22 or newer                                     |
| npm         | Compatible with the committed lockfile          |
| MongoDB     | Replica-set deployment with transaction support |
| Chromium    | Required only for Playwright E2E checks         |

Quiz completion performs multi-document transactions. A standalone MongoDB server can render pages but cannot safely complete quizzes.

## Install

```bash
git clone https://github.com/Ashish-Vision/QuizMaster-Pro.git
cd QuizMaster-Pro
npm ci
cp .env.example .env
```

`npm ci` installs exactly the versions represented by `package-lock.json`. Do not commit `.env`.

## Environment variables

### Core configuration

| Variable         | Required   | Default/example         | Description                                                              |
| ---------------- | ---------- | ----------------------- | ------------------------------------------------------------------------ |
| `NODE_ENV`       | Yes        | `development`           | Runtime mode; production enables stricter validation and secure cookies. |
| `PORT`           | No         | `5000`                  | HTTP listening port.                                                     |
| `MONGODB_URI`    | Yes        | Replica-set URI         | MongoDB connection string.                                               |
| `JWT_SECRET`     | Yes        | None                    | Random secret of at least 32 bytes.                                      |
| `JWT_EXPIRES_IN` | No         | `7d`                    | JWT lifetime accepted by `jsonwebtoken`.                                 |
| `JWT_ISSUER`     | No         | `quizmaster-pro`        | Expected token issuer.                                                   |
| `JWT_AUDIENCE`   | No         | `quizmaster-pro-users`  | Expected token audience.                                                 |
| `APP_ORIGIN`     | Production | `http://localhost:5000` | Canonical application origin. HTTPS is required in production.           |
| `CLIENT_ORIGIN`  | Production | `http://localhost:5000` | Allowed browser origin; must equal `APP_ORIGIN` in production.           |

### Email configuration

Email verification and password recovery require the complete SMTP group.

| Variable                       | Purpose                                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------- |
| `SMTP_HOST`                    | SMTP server hostname                                                                         |
| `SMTP_PORT`                    | SMTP port, commonly `587`                                                                    |
| `SMTP_SECURE`                  | Whether to use an immediately secure connection                                              |
| `SMTP_USER`                    | SMTP account username                                                                        |
| `SMTP_PASSWORD`                | SMTP account or app password                                                                 |
| `EMAIL_FROM_NAME`              | Display name for outgoing mail                                                               |
| `EMAIL_FROM_ADDRESS`           | Sender address                                                                               |
| `EXPOSE_DEVELOPMENT_RESET_URL` | Optional local-only recovery URL exposure; keep `false` outside explicit development testing |

### Avatar storage and tests

| Variable                | Purpose                                       |
| ----------------------- | --------------------------------------------- |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account name                       |
| `CLOUDINARY_API_KEY`    | Cloudinary API key                            |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret                         |
| `MONGOMS_SYSTEM_BINARY` | Optional absolute `mongod` path used by tests |

Example local core configuration:

```dotenv
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/quizmaster_pro?replicaSet=rs0
JWT_SECRET=replace-with-at-least-32-random-bytes
JWT_EXPIRES_IN=7d
JWT_ISSUER=quizmaster-pro
JWT_AUDIENCE=quizmaster-pro-users
APP_ORIGIN=http://localhost:5000
CLIENT_ORIGIN=http://localhost:5000
```

## MongoDB replica set

Use an existing replica-set deployment or initialize a local single-node replica set according to your MongoDB installation. Verify that the URI includes its replica-set name, for example `?replicaSet=rs0`.

The project intentionally does not delete or seed application data during normal startup.

## Seed questions

```bash
npm run seed:questions
```

This command inserts the bundled question data only when the question collection is empty. To replace questions in a disposable local database:

```bash
npm run reset:questions
```

`reset:questions` deletes existing question documents before inserting the bundled set. Do not run it against valuable data.

## Start the application

Development:

```bash
npm run dev
```

Normal process:

```bash
npm start
```

Open `http://localhost:5000` or the configured origin.

## Create the first administrator

There is no public administrator-registration endpoint. Register and verify a normal account, update that user's `role` to `admin` directly in the local database, and log in again. A fresh login is necessary because role and token-version checks are evaluated on protected requests.

## Verify the installation

```bash
npm run check
npm run test:e2e
npm run audit:prod
```

Health endpoints:

```bash
curl http://localhost:5000/api/health
curl http://localhost:5000/api/ready
```

`/api/ready` returns `503` until Mongoose is connected.

## Troubleshooting

| Symptom                             | Resolution                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| Transaction error during submission | Connect to a MongoDB replica set, not a standalone server.                      |
| Startup reports missing variables   | Compare `.env` with `.env.example`; ensure the JWT secret is at least 32 bytes. |
| Production origin validation fails  | Use matching HTTPS-only `APP_ORIGIN` and `CLIENT_ORIGIN` values without paths.  |
| Email is not delivered              | Supply every SMTP variable and run `npm run test:email`.                        |
| Avatar upload is unavailable        | Supply all three Cloudinary variables.                                          |
| Chromium is missing                 | Run `npx playwright install chromium`.                                          |
| E2E reports port 5000 in use        | Stop the existing server or ensure it is the expected local fixture server.     |
