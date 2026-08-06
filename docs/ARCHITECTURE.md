# Architecture

The browser receives EJS pages and page-specific JavaScript/CSS from Express. `server/app.js` owns middleware, page routes, API mounts, and health endpoints. API routes apply authentication/role middleware before controllers. Controllers validate HTTP contracts and coordinate Mongoose models and domain services.

MongoDB stores users, questions, scores, server-issued quiz sessions, daily challenges, achievements, notifications, activity logs, and platform settings. Quiz completion uses a MongoDB transaction covering attempt claim/completion, score creation, XP and counters, daily completion, achievements, and notifications. Unique indexes on quiz-session result references provide a second idempotency boundary.

Email delivery is isolated in `emailService`; Cloudinary stores avatars. Tests must mock those integrations. The service is stateless except for the current in-process rate-limit store; multi-replica deployments should configure a shared rate-limit store in a future release.
