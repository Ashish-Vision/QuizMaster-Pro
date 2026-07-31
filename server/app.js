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

const { protect } = require("./middleware/authMiddleware");

const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

const app = express();

/* ============================================================
   View Engine
============================================================ */

app.set("view engine", "ejs");

app.set("views", path.join(__dirname, "../client/views"));

/* ============================================================
   Global Middleware
============================================================ */

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  }),
);

app.use(cookieParser());

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5000",

    credentials: true,
  }),
);

app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);

app.use(morgan("dev"));

/* ============================================================
   Static Files
============================================================ */

app.use(
  express.static(path.join(__dirname, "../client"), {
    index: false,
  }),
);

/* ============================================================
   Public Page Routes
============================================================ */

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/register", (req, res) => {
  res.render("register");
});

/* ============================================================
   Protected Page Routes
============================================================ */

app.get("/dashboard", protect, (req, res) => {
  res.render("dashboard", {
    user: req.user,
  });
});

app.get("/quiz", protect, (req, res) => {
  res.render("quiz", {
    user: req.user,
  });
});

app.get("/result", protect, (req, res) => {
  res.render("result", {
    user: req.user,
  });
});

app.get("/leaderboard", protect, (req, res) => {
  res.render("leaderboard", {
    user: req.user,
  });
});

/* ============================================================
   API Routes
============================================================ */

app.use("/api/auth", authRoutes);

app.use("/api/quiz", quizRoutes);

app.use("/api/users", userRoutes);

/* ============================================================
   404 Handler
============================================================ */

app.use(notFoundHandler);

/* ============================================================
   Global Error Handler
============================================================ */

app.use(errorHandler);

module.exports = app;
