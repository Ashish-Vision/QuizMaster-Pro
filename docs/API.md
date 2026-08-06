# API overview

All API responses use JSON and normally include `success`. Cookie authentication uses `quizmaster_token`; bearer tokens are also accepted. User routes require authentication and `/api/admin/*` routes additionally require the `admin` role.

| Area           | Prefix                                                                          | Main operations                                                                                                             |
| -------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Accounts       | `/api/auth`, `/api/email-verification`, `/api/password-reset`                   | register, login, logout, current user, verification, recovery                                                               |
| Quizzes        | `/api/quiz`, `/api/daily-challenge`                                             | categories, server-issued start, submit, result, daily start                                                                |
| User data      | `/api/history`, `/api/profile`, `/api/settings`                                 | history, profile/avatar, account settings                                                                                   |
| Experience     | `/api/leaderboard`, `/api/achievements`, `/api/analytics`, `/api/notifications` | rankings, progress, analytics, notifications                                                                                |
| Administration | `/api/admin/*`                                                                  | dashboard, questions, categories, users, attempts, analytics, achievements, notifications, reports, activity logs, settings |
| Operations     | `/api/health`, `/api/ready`                                                     | liveness and database readiness                                                                                             |

Quiz submission requires the opaque `quizSessionId` returned by the corresponding start endpoint. The server-selected question set must be submitted exactly once. Invalid IDs return 400, missing owned resources 404, authentication failures 401, authorization failures 403, replay/conflicts 409, and expired attempts 410.

List endpoints use bounded `page`/`limit` offset pagination. Deep pagination is a known scalability limitation; a later compatible version should add cursor pagination.
