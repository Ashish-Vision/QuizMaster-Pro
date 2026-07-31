"use strict";

const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const authRoutes = require("./routes/authRoutes");

const { protectPage } = require("./middleware/authMiddleware");

const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

const app = express();

// ------------------------------
// Global middleware
// ------------------------------

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

// ------------------------------
// View engine
// ------------------------------

app.set("view engine", "ejs");

app.set("views", path.join(__dirname, "../client/views"));

// ------------------------------
// Static files
// ------------------------------

app.use(
  express.static(path.join(__dirname, "../client"), {
    index: false,
  }),
);

// ------------------------------
// Public page routes
// ------------------------------

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/register", (req, res) => {
  res.render("register");
});

// ------------------------------
// Protected page routes
// ------------------------------

app.get("/dashboard", protectPage, (req, res) => {
  res.render("dashboard", {
    user: req.user,
  });
});

// ------------------------------
// Health route
// ------------------------------

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "QuizMaster Pro API is running.",
  });
});

// ------------------------------
// API routes
// ------------------------------

app.use("/api/auth", authRoutes);

// ------------------------------
// Error handlers
// ------------------------------

app.use(notFoundHandler);

app.use(errorHandler);

module.exports = app;
