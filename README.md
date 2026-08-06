# QuizMaster Pro

QuizMaster Pro 1.0.0 is an Express, EJS, and MongoDB quiz platform with account verification, password recovery, replay-safe quiz attempts, daily challenges, achievements, notifications, analytics, and administrator tools.

## Quick start

Requirements: Node.js 22 or newer and MongoDB 7+ configured as a replica set (transactions are required for atomic quiz completion).

1. Run `npm ci`.
2. Copy `.env.example` to `.env` and replace every placeholder.
3. Start MongoDB, then run `npm run seed:questions` if the database is empty.
4. Run `npm run dev`; open `http://localhost:5000`.

Never commit `.env`. Production requires `MONGODB_URI`, a random `JWT_SECRET` of at least 32 bytes, and matching HTTPS `APP_ORIGIN` and `CLIENT_ORIGIN` values. Email and Cloudinary variables are required when those flows are used.

## Commands

- `npm start` / `npm run dev`: production-style/development server
- `npm test`, `npm run test:watch`, `npm run test:coverage`: Jest suites
- `npm run test:e2e`: desktop and mobile Chromium smoke audit
- `npm run lint`, `npm run format:check`: static checks

## First administrator

Register and verify a normal account, then update that account's `role` to `admin` directly in MongoDB using an authenticated administrative database session. Do not expose a public “create admin” endpoint. Restart the session after changing the role so authorization is re-evaluated.

See [API](docs/API.md), [architecture](docs/ARCHITECTURE.md), [security](docs/SECURITY.md), [deployment](docs/DEPLOYMENT.md), and [testing](docs/TESTING.md).
