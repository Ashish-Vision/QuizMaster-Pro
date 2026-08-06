# API reference

All endpoints are relative to the local application origin. JSON responses normally contain `success`; errors also contain a safe `message`. Protected routes accept the HttpOnly `quizmaster_token` cookie or a Bearer token. Administrator endpoints require the current user to have role `admin`.

Common status codes: `400` invalid input, `401` unauthenticated/stale session, `403` forbidden/disabled, `404` missing owned resource, `409` conflict/replay, `410` expired quiz session, `429` rate limited, and `500` generic unexpected error.

## Authentication

| Method and path           | Access               | Input / result                                                                                                                    |
| ------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/register` | Public, rate limited | Body: `firstName`, `lastName`, `email`, `password`. Creates an unverified account and returns a generic verification instruction. |
| `POST /api/auth/login`    | Public, rate limited | Body: `email`, `password`, optional `rememberMe`. Sets the authentication cookie.                                                 |
| `POST /api/auth/logout`   | Public               | Clears the authentication cookie.                                                                                                 |
| `GET /api/auth/me`        | Authenticated        | Returns the safe current-user object.                                                                                             |

Registration returns `409` for duplicate email. Login returns a generic credential error and rejects disabled/unverified accounts.

## Email verification and password recovery

| Method and path                             | Access               | Input / result                                                                  |
| ------------------------------------------- | -------------------- | ------------------------------------------------------------------------------- |
| `GET /api/email-verification/verify/:token` | Public, rate limited | Atomically consumes a valid unexpired verification token.                       |
| `POST /api/email-verification/resend`       | Public, rate limited | Body: `email`. Always uses a generic account-discovery-safe response.           |
| `POST /api/password-reset/forgot`           | Public, rate limited | Body: `email`. Generates a hashed, expiring token when eligible.                |
| `GET /api/password-reset/validate/:token`   | Public               | Validates an unexpired token without exposing stored hashes.                    |
| `PATCH /api/password-reset/reset/:token`    | Public, rate limited | Body: `password`, `confirmPassword`. Single use; invalidates existing sessions. |

Raw tokens are delivered through configured email. Development URL exposure requires its explicit local-only flag.

## Quiz

| Method and path                  | Access        | Input / result                                                                                                                |
| -------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/quiz/categories`       | Authenticated | Returns categories containing eligible questions.                                                                             |
| `GET /api/quiz/start/:category`  | Authenticated | Optional bounded `limit`. Creates an expiring `QuizSession`; returns its opaque ID and questions without correct answers.     |
| `POST /api/quiz/submit`          | Authenticated | Body: `quizSessionId`, `answers[]` (`questionId`, `selectedAnswer`). Legacy category/mode fields cannot override the session. |
| `GET /api/quiz/result/:resultId` | Owner         | Returns an owned historical score populated for review.                                                                       |

Submission requires exactly the server-issued question set. Replays and concurrent processing return deterministic conflicts or the existing result without granting additional XP.

Example submission:

```json
{
  "quizSessionId": "opaque-server-issued-id",
  "answers": [{ "questionId": "64b000000000000000000031", "selectedAnswer": 2 }]
}
```

## Daily challenge

| Method and path                                | Access        | Result                                                               |
| ---------------------------------------------- | ------------- | -------------------------------------------------------------------- |
| `GET /api/daily-challenge`                     | Authenticated | Returns today’s challenge and current-user completion state.         |
| `GET /api/daily-challenge/:challengeId`        | Authenticated | Returns one current challenge.                                       |
| `POST /api/daily-challenge/:challengeId/start` | Authenticated | Creates one authoritative daily quiz session for the user/challenge. |

New challenges use only active or legacy-without-flag questions. An already-issued unexpired session may finish after a question is disabled.

## User experience APIs

| Method and path              | Access        | Purpose                                                                    |
| ---------------------------- | ------------- | -------------------------------------------------------------------------- |
| `GET /api/history`           | Authenticated | Bounded `page`, `limit`, optional `category`; returns owned score history. |
| `GET /api/leaderboard`       | Authenticated | Top ten active regular users plus current-user rank.                       |
| `GET /api/users/leaderboard` | Authenticated | Compatibility alias for the leaderboard.                                   |
| `GET /api/analytics`         | Authenticated | User summaries, category/daily/monthly performance and comparisons.        |
| `GET /api/achievements`      | Authenticated | Definitions merged with current-user unlock state/statistics.              |

## Notifications

| Method and path                                 | Access        | Input / result                                                       |
| ----------------------------------------------- | ------------- | -------------------------------------------------------------------- |
| `GET /api/notifications`                        | Authenticated | `page`, `limit`, optional `unreadOnly`; returns owned notifications. |
| `GET /api/notifications/unread-count`           | Authenticated | Returns current unread count.                                        |
| `PATCH /api/notifications/read-all`             | Authenticated | Marks owned unread notifications read.                               |
| `PATCH /api/notifications/:notificationId/read` | Owner         | Marks one owned notification read.                                   |
| `DELETE /api/notifications/:notificationId`     | Owner         | Deletes one owned notification.                                      |

Foreign and missing notification IDs use the same not-found behavior to avoid resource disclosure.

## Profile and settings

| Method and path                | Access                      | Input / result                                                                               |
| ------------------------------ | --------------------------- | -------------------------------------------------------------------------------------------- |
| `GET /api/profile`             | Authenticated               | Safe profile, statistics, recent activity, achievements, rank, and progress.                 |
| `PUT /api/profile`             | Authenticated               | Body: current user’s supported profile fields. Client user IDs are ignored.                  |
| `POST /api/profile/avatar`     | Authenticated               | Multipart field `avatar`; JPEG/PNG/WebP, maximum 5 MB and bounded dimensions.                |
| `DELETE /api/profile/avatar`   | Authenticated               | Removes the current avatar.                                                                  |
| `GET /api/settings`            | Authenticated               | Safe account settings.                                                                       |
| `PATCH /api/settings/profile`  | Authenticated, rate limited | Body: `firstName`, `lastName`, `email`.                                                      |
| `PATCH /api/settings/password` | Authenticated, rate limited | Body: `currentPassword`, `newPassword`, `confirmPassword`; rotates token version and cookie. |

Passwords, token versions, and recovery/verification hashes are never returned.

## Administrator APIs

Every endpoint below applies authentication and administrator authorization.

### Dashboard and analytics

- `GET /api/admin/dashboard` — overview, trends, category statistics, recent users/attempts.
- `GET /api/admin/analytics` — bounded administrator analytics.
- `GET /api/admin/activity-logs` — searchable, filtered, paginated logs.
- `GET /api/admin/activity-logs/summary` — activity summary.

### Questions and categories

- `GET|POST /api/admin/questions` — list/create questions.
- `GET /api/admin/questions/meta/options` — categories/difficulties for forms.
- `GET|PUT|DELETE /api/admin/questions/:questionId` — read/update/delete one question. Questions referenced by saved results cannot be deleted.
- `GET /api/admin/categories` — category and attempt statistics.
- `PATCH|DELETE /api/admin/categories/:categoryName` — rename across questions/history or delete when safe.

Question lists support bounded pagination and validated `search`, `category`, `difficulty`, `sortBy`, and `sortOrder`.

### Users and attempts

- `GET /api/admin/users` — paginated/searchable users.
- `GET /api/admin/users/:userId` — safe details/statistics.
- `PATCH /api/admin/users/:userId/role` — role change with token invalidation and own-admin protection.
- `PATCH /api/admin/users/:userId/status` — activation change with token invalidation.
- `GET /api/admin/attempts` — filtered attempts.
- `GET|DELETE /api/admin/attempts/:attemptId` — details/delete with validated IDs and consistency rules.

### Achievements, notifications, settings

- `GET /api/admin/achievements` and `GET /api/admin/achievements/:code`.
- `GET|POST /api/admin/notifications` — list and create validated broadcasts/single-user notices.
- `DELETE /api/admin/notifications/batch/:batchId` and `DELETE /api/admin/notifications/:notificationId`.
- `GET|PATCH /api/admin/settings`, `POST /api/admin/settings/reset`.

Administrator notification links accept only empty strings or safe same-origin paths beginning with exactly one `/`.

### Reports

- `GET /api/admin/reports/summary`
- `GET /api/admin/reports/users`
- `GET /api/admin/reports/attempts`
- `GET /api/admin/reports/questions`
- `GET /api/admin/reports/categories`
- `GET /api/admin/reports/achievements`

Exports return UTF-8 CSV. Every cell is encoded and spreadsheet-formula prefixes are neutralized.

## Health

- `GET /api/health` — local process liveness.
- `GET /api/ready` — `200` only while Mongoose is connected; otherwise `503`.
