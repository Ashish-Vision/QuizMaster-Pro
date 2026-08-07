# API reference

All paths are relative to the application origin. JSON responses generally contain `success`; failures contain a safe `message` and do not expose production stack traces.

## Authentication

Protected endpoints accept either:

- the HttpOnly `quizmaster_token` cookie set by login; or
- `Authorization: Bearer <token>`.

Administrator endpoints additionally load the current user and require `role: "admin"`.

### Common status codes

| Code  | Meaning                                                                    |
| ----- | -------------------------------------------------------------------------- |
| `200` | Successful read or update                                                  |
| `201` | Resource created                                                           |
| `400` | Invalid input or query value                                               |
| `401` | Missing, invalid, expired, or revoked authentication                       |
| `403` | Disabled account, unverified account, origin failure, or insufficient role |
| `404` | Route or owned resource not found                                          |
| `409` | Duplicate, state conflict, or replay conflict                              |
| `410` | Quiz session expired                                                       |
| `429` | Rate limit exceeded                                                        |
| `500` | Unexpected server error                                                    |

## Authentication and account recovery

| Method  | Path                                    | Access          | Description                                                       |
| ------- | --------------------------------------- | --------------- | ----------------------------------------------------------------- |
| `POST`  | `/api/auth/register`                    | Public, limited | Register with `firstName`, `lastName`, `email`, and `password`.   |
| `POST`  | `/api/auth/login`                       | Public, limited | Authenticate with `email`, `password`, and optional `rememberMe`. |
| `POST`  | `/api/auth/logout`                      | Public          | Clear the authentication cookie.                                  |
| `GET`   | `/api/auth/me`                          | Authenticated   | Return the safe current-user representation.                      |
| `GET`   | `/api/email-verification/verify/:token` | Public, limited | Consume an unexpired verification token.                          |
| `POST`  | `/api/email-verification/resend`        | Public, limited | Request verification using a generic account-safe response.       |
| `POST`  | `/api/password-reset/forgot`            | Public, limited | Request password recovery using a generic response.               |
| `GET`   | `/api/password-reset/validate/:token`   | Public          | Validate a recovery token.                                        |
| `PATCH` | `/api/password-reset/reset/:token`      | Public, limited | Set `password` and `confirmPassword`; revoke old sessions.        |

Login example:

```bash
curl -i -X POST http://localhost:5000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"learner@example.com","password":"example-password","rememberMe":false}'
```

## Quiz and daily challenge

| Method | Path                                      | Description                                                              |
| ------ | ----------------------------------------- | ------------------------------------------------------------------------ |
| `GET`  | `/api/quiz/categories`                    | List categories with eligible questions.                                 |
| `GET`  | `/api/quiz/start/:category`               | Create an expiring session and return questions without correct answers. |
| `POST` | `/api/quiz/submit`                        | Submit exactly the answers for a server-issued session.                  |
| `GET`  | `/api/quiz/result/:resultId`              | Return an owned historical result.                                       |
| `GET`  | `/api/daily-challenge`                    | Return today's challenge and current-user completion state.              |
| `GET`  | `/api/daily-challenge/:challengeId`       | Return one current challenge.                                            |
| `POST` | `/api/daily-challenge/:challengeId/start` | Create the user's authoritative daily session.                           |

Start and submit example:

```bash
curl -b cookies.txt http://localhost:5000/api/quiz/start/JavaScript

curl -b cookies.txt -X POST http://localhost:5000/api/quiz/submit \
  -H 'Content-Type: application/json' \
  -d '{
    "quizSessionId":"opaque-server-issued-id",
    "answers":[
      {"questionId":"64b000000000000000000031","selectedAnswer":2}
    ]
  }'
```

Submission is transactional and replay-safe. The server ignores legacy category/mode values as sources of authority.

## Learner APIs

| Method   | Path                     | Description                                                                 |
| -------- | ------------------------ | --------------------------------------------------------------------------- |
| `GET`    | `/api/history`           | Owned, paginated history; supports bounded `page`, `limit`, and `category`. |
| `GET`    | `/api/leaderboard`       | Top ten eligible learners and current-user rank.                            |
| `GET`    | `/api/users/leaderboard` | Compatibility alias for the leaderboard.                                    |
| `GET`    | `/api/analytics`         | Personal overview, trends, categories, and comparisons.                     |
| `GET`    | `/api/achievements`      | Achievement definitions merged with unlock state.                           |
| `GET`    | `/api/profile`           | Safe profile and progress summary.                                          |
| `PUT`    | `/api/profile`           | Update supported fields for the authenticated user.                         |
| `POST`   | `/api/profile/avatar`    | Upload multipart field `avatar`; JPEG/PNG/WebP, maximum 5 MB.               |
| `DELETE` | `/api/profile/avatar`    | Remove the current user's avatar.                                           |
| `GET`    | `/api/settings`          | Return safe account settings.                                               |
| `PATCH`  | `/api/settings/profile`  | Update `firstName`, `lastName`, and `email`.                                |
| `PATCH`  | `/api/settings/password` | Change password and rotate the session token version.                       |

## Notifications

| Method   | Path                                      | Description                                           |
| -------- | ----------------------------------------- | ----------------------------------------------------- |
| `GET`    | `/api/notifications`                      | Paginated owned notifications; optional `unreadOnly`. |
| `GET`    | `/api/notifications/unread-count`         | Current unread count.                                 |
| `PATCH`  | `/api/notifications/read-all`             | Mark all owned notifications read.                    |
| `PATCH`  | `/api/notifications/:notificationId/read` | Mark one owned notification read.                     |
| `DELETE` | `/api/notifications/:notificationId`      | Delete one owned notification.                        |

## Administrator APIs

All routes in this section require current authentication and administrator authorization.

### Dashboard, analytics, and activity

| Method | Path                               | Description                                                        |
| ------ | ---------------------------------- | ------------------------------------------------------------------ |
| `GET`  | `/api/admin/dashboard`             | Platform overview, trends, categories, users, and recent attempts. |
| `GET`  | `/api/admin/analytics`             | Bounded platform analytics.                                        |
| `GET`  | `/api/admin/activity-logs`         | Searchable, filtered, paginated administrator activity.            |
| `GET`  | `/api/admin/activity-logs/summary` | Activity summary.                                                  |

### Questions and categories

| Method                 | Path                                  | Description                                |
| ---------------------- | ------------------------------------- | ------------------------------------------ |
| `GET`, `POST`          | `/api/admin/questions`                | List or create questions.                  |
| `GET`                  | `/api/admin/questions/meta/options`   | Form categories and difficulty options.    |
| `GET`, `PUT`, `DELETE` | `/api/admin/questions/:questionId`    | Read, update, or safely delete a question. |
| `GET`                  | `/api/admin/categories`               | Category and attempt statistics.           |
| `PATCH`, `DELETE`      | `/api/admin/categories/:categoryName` | Rename a category or delete it when safe.  |

Create-question example:

```json
{
  "question": "Which keyword declares a block-scoped constant?",
  "options": ["var", "let", "const", "static"],
  "correctAnswer": 2,
  "category": "JavaScript",
  "difficulty": "Easy",
  "explanation": "const declares a block-scoped binding.",
  "isActive": true
}
```

### Users, attempts, and administration

| Method          | Path                                       | Description                                        |
| --------------- | ------------------------------------------ | -------------------------------------------------- |
| `GET`           | `/api/admin/users`                         | Search and paginate users.                         |
| `GET`           | `/api/admin/users/:userId`                 | Safe user details and statistics.                  |
| `PATCH`         | `/api/admin/users/:userId/role`            | Change role and revoke prior sessions.             |
| `PATCH`         | `/api/admin/users/:userId/status`          | Enable/disable account and revoke prior sessions.  |
| `GET`           | `/api/admin/attempts`                      | Filtered, paginated attempts.                      |
| `GET`, `DELETE` | `/api/admin/attempts/:attemptId`           | Read or delete an attempt under consistency rules. |
| `GET`           | `/api/admin/achievements`                  | Achievement statistics/listing.                    |
| `GET`           | `/api/admin/achievements/:code`            | Achievement details.                               |
| `GET`, `POST`   | `/api/admin/notifications`                 | List or create administrator notifications.        |
| `DELETE`        | `/api/admin/notifications/batch/:batchId`  | Delete a notification batch.                       |
| `DELETE`        | `/api/admin/notifications/:notificationId` | Delete one notification.                           |
| `GET`, `PATCH`  | `/api/admin/settings`                      | Read/update platform settings.                     |
| `POST`          | `/api/admin/settings/reset`                | Reset platform settings.                           |

### Reports

`GET /api/admin/reports/{summary|users|attempts|questions|categories|achievements}` returns report data or UTF-8 CSV according to the route contract. CSV values are quoted and spreadsheet-formula prefixes are neutralized.

Administrator CSV exports allow a maximum of 1,000 result rows. An export containing exactly 1,000 rows succeeds. If the filtered result would exceed 1,000 rows, the API returns HTTP `413` with a message instructing the administrator to narrow the report filters and retry.

## Operations

| Method | Path          | Description                                          |
| ------ | ------------- | ---------------------------------------------------- |
| `GET`  | `/api/health` | Process liveness.                                    |
| `GET`  | `/api/ready`  | Database readiness; returns `503` when disconnected. |

For exact validation and response fields, treat the route/controller source and automated contract tests as authoritative.
