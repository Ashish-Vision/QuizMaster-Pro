"use strict";

const path = require("path");

const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const authRoutes = require("./routes/authRoutes");
const quizRoutes = require("./routes/quizRoutes");
const userRoutes = require("./routes/userRoutes");
const leaderboardRoutes = require("./routes/leaderboardRoutes");
const historyRoutes = require("./routes/historyRoutes");
const profileRoutes = require("./routes/profileRoutes");

const { protect } = require("./middleware/authMiddleware");

const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

const app = express();

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
   CORS
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
       * Requests such as direct browser navigation,
       * Postman and server-to-server requests may not
       * include an Origin header.
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

/*
 * Prevents an unnecessary favicon 404 error
 * when no favicon has been added yet.
 */
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

/* ============================================================
   Protected Page Routes
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

/*
 * Supports result IDs in the URL:
 * /result/64f123...
 */
app.get("/result/:resultId", protect, (req, res) => {
  return res.render("result", {
    user: req.user,
    resultId: req.params.resultId,
  });
});

/*
 * Optional fallback route:
 * /result?resultId=64f123...
 */
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

/* ============================================================
   API Routes
============================================================ */

app.use("/api/auth", authRoutes);

app.use("/api/quiz", quizRoutes);

app.use("/api/users", userRoutes);

app.use("/api/leaderboard", leaderboardRoutes);

app.use("/api/history", historyRoutes);

app.use("/api/profile", profileRoutes);

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
