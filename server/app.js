"use strict";

const path = require("path");

const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

/* ============================================================
   Route Imports
============================================================ */

const authRoutes = require("./routes/authRoutes");
const quizRoutes = require("./routes/quizRoutes");
const userRoutes = require("./routes/userRoutes");
const leaderboardRoutes = require("./routes/leaderboardRoutes");
const historyRoutes = require("./routes/historyRoutes");
const profileRoutes = require("./routes/profileRoutes");
const achievementRoutes = require("./routes/achievementRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const passwordResetRoutes = require("./routes/passwordResetRoutes");
const emailVerificationRoutes = require("./routes/emailVerificationRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const dailyChallengeRoutes = require("./routes/dailyChallengeRoutes");

const adminRoutes = require("./routes/adminRoutes");
const adminQuestionRoutes = require("./routes/adminQuestionRoutes");
const adminCategoryRoutes = require("./routes/adminCategoryRoutes");
const adminUserRoutes = require("./routes/adminUserRoutes");
const adminAttemptRoutes = require("./routes/adminAttemptRoutes");
const adminAnalyticsRoutes = require("./routes/adminAnalyticsRoutes");
const adminAchievementRoutes = require("./routes/adminAchievementRoutes");
const adminNotificationRoutes = require("./routes/adminNotificationRoutes");
const adminReportRoutes = require("./routes/adminReportRoutes");
const adminActivityLogRoutes = require("./routes/adminActivityLogRoutes");
const adminSettingsRoutes = require("./routes/adminSettingsRoutes");

/* ============================================================
   Middleware Imports
============================================================ */

const { protect } = require("./middleware/authMiddleware");
const { adminOnly } = require("./middleware/adminMiddleware");

const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");
const {
  enforceSameOriginMutation,
  rejectUnsafeInput,
  validateCommonQueryValues,
} = require("./middleware/requestSecurityMiddleware");

/* ============================================================
   Application
============================================================ */

const app = express();

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

/* ============================================================
   View Engine
============================================================ */

app.set("view engine", "ejs");

app.set("views", path.join(__dirname, "../client/views"));

/* ============================================================
   Security Middleware
============================================================ */

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests:
          process.env.NODE_ENV === "production" ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    strictTransportSecurity:
      process.env.NODE_ENV === "production"
        ? { maxAge: 31_536_000, includeSubDomains: true }
        : false,
  }),
);

/* ============================================================
   CORS Configuration
============================================================ */

const allowedOrigins = [
  process.env.CLIENT_ORIGIN,
  ...(process.env.NODE_ENV === "production"
    ? []
    : ["http://localhost:5000", "http://127.0.0.1:5000"]),
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      /*
       * Browser requests normally include an Origin header.
       * Direct navigation, Postman and server-to-server
       * requests may not include one.
       */
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      const corsError = new Error(`Origin "${origin}" is not allowed by CORS.`);

      corsError.statusCode = 403;

      return callback(corsError);
    },

    credentials: true,

    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  }),
);

/* ============================================================
   Request Parsing Middleware
============================================================ */

app.use(
  express.json({
    limit: "1mb",
  }),
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
  }),
);

app.use(cookieParser());
app.use(rejectUnsafeInput);
app.use(validateCommonQueryValues);
app.use(enforceSameOriginMutation);

/* ============================================================
   Request Logging
============================================================ */

if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

/* ============================================================
   Static Files
============================================================ */

app.use(
  express.static(path.join(__dirname, "../client"), {
    index: false,
    etag: true,
    maxAge: process.env.NODE_ENV === "production" ? "1h" : 0,
  }),
);

app.use((req, res, next) => {
  if (req.accepts("html") && !req.path.startsWith("/api/")) {
    res.set("Cache-Control", "no-store");
  }
  next();
});

app.get("/favicon.ico", (req, res) => {
  return res.status(204).end();
});

/* ============================================================
   Public Page Routes
============================================================ */

function renderPage(view, createLocals = () => ({})) {
  return (req, res) => res.render(view, createLocals(req));
}

const publicPages = [
  ["/", "index"],
  ["/login", "login"],
  ["/register", "register"],
  ["/forgot-password", "forgot-password"],
  ["/verify-email", "verify-email"],
  ["/resend-verification", "resend-verification"],
  ["/terms", "terms"],
  ["/privacy", "privacy"],
];

for (const [routePath, view] of publicPages) {
  app.get(routePath, renderPage(view));
}

app.get("/reset-password", (req, res) => {
  return res.render("reset-password", {
    token: typeof req.query.token === "string" ? req.query.token : "",
  });
});

/* ============================================================
   Protected User Page Routes
============================================================ */

const userPages = [
  ["/dashboard", "dashboard"],
  ["/quiz", "quiz"],
  ["/daily-challenge", "dashboard"],
  ["/leaderboard", "leaderboard"],
  ["/history", "history"],
  ["/profile", "profile"],
  ["/achievements", "achievements"],
  ["/analytics", "analytics"],
  ["/settings", "settings"],
  ["/notifications", "notifications"],
];

for (const [routePath, view] of userPages) {
  app.get(
    routePath,
    protect,
    renderPage(view, (req) => ({ user: req.user })),
  );
}

app.get("/result/:resultId", protect, (req, res) => {
  return res.render("result", {
    user: req.user,
    resultId: req.params.resultId,
  });
});

app.get("/result", protect, (req, res) => {
  return res.render("result", {
    user: req.user,
    resultId: req.query.resultId || null,
  });
});

/* ============================================================
   Protected Administrator Page Routes
============================================================ */
const adminPages = [
  ["/admin", "admin/dashboard"],
  ["/admin/questions", "admin/questions"],
  ["/admin/categories", "admin/categories"],
  ["/admin/users", "admin/users"],
  ["/admin/attempts", "admin/attempts"],
  ["/admin/analytics", "admin/analytics"],
  ["/admin/achievements", "admin/achievements"],
  ["/admin/notifications", "admin/notifications"],
  ["/admin/reports", "admin/reports"],
  ["/admin/activity-logs", "admin/activity-logs"],
  ["/admin/settings", "admin/settings"],
];

for (const [routePath, view] of adminPages) {
  app.get(
    routePath,
    protect,
    adminOnly,
    renderPage(view, (req) => ({ user: req.user })),
  );
}
/* ============================================================
   API Routes
============================================================ */

app.use("/api/auth", authRoutes);

app.use("/api/email-verification", emailVerificationRoutes);

app.use("/api/password-reset", passwordResetRoutes);

app.use("/api/quiz", quizRoutes);

app.use("/api/daily-challenge", dailyChallengeRoutes);

app.use("/api/users", userRoutes);

app.use("/api/leaderboard", leaderboardRoutes);

app.use("/api/history", historyRoutes);

app.use("/api/profile", profileRoutes);

app.use("/api/settings", settingsRoutes);

app.use("/api/achievements", achievementRoutes);

app.use("/api/analytics", analyticsRoutes);

app.use("/api/notifications", notificationRoutes);

/* ============================================================
   Administrator API Routes
============================================================ */

app.use("/api/admin/attempts", adminAttemptRoutes);

app.use("/api/admin/users", adminUserRoutes);

app.use("/api/admin/categories", adminCategoryRoutes);

app.use("/api/admin/questions", adminQuestionRoutes);

app.use("/api/admin/analytics", adminAnalyticsRoutes);

app.use("/api/admin/achievements", adminAchievementRoutes);

app.use("/api/admin/notifications", adminNotificationRoutes);

app.use("/api/admin/reports", adminReportRoutes);

app.use("/api/admin/activity-logs", adminActivityLogRoutes);

app.use("/api/admin/settings", adminSettingsRoutes);

app.use("/api/admin", adminRoutes);

/* ============================================================
   Health Check
============================================================ */

app.get("/api/health", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "QuizMaster Pro server is running.",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/ready", (req, res) => {
  const mongoose = require("mongoose");
  const ready = mongoose.connection.readyState === 1;
  return res.status(ready ? 200 : 503).json({ success: ready, ready });
});

/* ============================================================
   404 Handler
============================================================ */

app.use(notFoundHandler);

/* ============================================================
   Global Error Handler
============================================================ */

app.use(errorHandler);

module.exports = app;
