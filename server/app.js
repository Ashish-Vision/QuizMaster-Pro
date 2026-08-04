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

/* ============================================================
   Middleware Imports
============================================================ */

const { protect } = require("./middleware/authMiddleware");
const { adminOnly } = require("./middleware/adminMiddleware");

const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

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
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

/* ============================================================
   CORS Configuration
============================================================ */

const allowedOrigins = [
  process.env.CLIENT_ORIGIN,
  "http://localhost:5000",
  "http://127.0.0.1:5000",
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
  }),
);

app.get("/favicon.ico", (req, res) => {
  return res.status(204).end();
});

/* ============================================================
   Public Page Routes
============================================================ */

app.get("/", (req, res) => {
  return res.render("index");
});

app.get("/login", (req, res) => {
  return res.render("login");
});

app.get("/register", (req, res) => {
  return res.render("register");
});

app.get("/forgot-password", (req, res) => {
  return res.render("forgot-password");
});

app.get("/reset-password", (req, res) => {
  return res.render("reset-password", {
    token: typeof req.query.token === "string" ? req.query.token : "",
  });
});

app.get("/verify-email", (req, res) => {
  return res.render("verify-email");
});

app.get("/resend-verification", (req, res) => {
  return res.render("resend-verification");
});

/* ============================================================
   Protected User Page Routes
============================================================ */

app.get("/dashboard", protect, (req, res) => {
  return res.render("dashboard", {
    user: req.user,
  });
});

app.get("/quiz", protect, (req, res) => {
  return res.render("quiz", {
    user: req.user,
  });
});

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

app.get("/leaderboard", protect, (req, res) => {
  return res.render("leaderboard", {
    user: req.user,
  });
});

app.get("/history", protect, (req, res) => {
  return res.render("history", {
    user: req.user,
  });
});

app.get("/profile", protect, (req, res) => {
  return res.render("profile", {
    user: req.user,
  });
});

app.get("/achievements", protect, (req, res) => {
  return res.render("achievements", {
    user: req.user,
  });
});

app.get("/analytics", protect, (req, res) => {
  return res.render("analytics", {
    user: req.user,
  });
});

app.get("/settings", protect, (req, res) => {
  return res.render("settings", {
    user: req.user,
  });
});

app.get("/notifications", protect, (req, res) => {
  return res.render("notifications", {
    user: req.user,
  });
});

/* ============================================================
   Protected Administrator Page Routes
============================================================ */
app.get("/admin", protect, adminOnly, (req, res) => {
  return res.render("admin/dashboard", {
    user: req.user,
  });
});

app.get("/admin/questions", protect, adminOnly, (req, res) => {
  return res.render("admin/questions", {
    user: req.user,
  });
});

app.get("/admin/categories", protect, adminOnly, (req, res) => {
  return res.render("admin/categories", {
    user: req.user,
  });
});

app.get("/admin/users", protect, adminOnly, (req, res) => {
  return res.render("admin/users", {
    user: req.user,
  });
});

app.get("/admin/attempts", protect, adminOnly, (req, res) => {
  return res.render("admin/attempts", {
    user: req.user,
  });
});

app.get("/admin/analytics", protect, adminOnly, (req, res) => {
  return res.render("admin/analytics", {
    user: req.user,
  });
});

app.get("/admin/achievements", protect, adminOnly, (req, res) => {
  return res.render("admin/achievements", {
    user: req.user,
  });
});
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

/* ============================================================
   404 Handler
============================================================ */

app.use(notFoundHandler);

/* ============================================================
   Global Error Handler
============================================================ */

app.use(errorHandler);

module.exports = app;
