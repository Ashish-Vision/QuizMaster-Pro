"use strict";

const path = require("path");

const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const authRoutes = require("./routes/authRoutes");
const quizRoutes = require("./routes/quizRoutes");

const { protect } = require("./middleware/authMiddleware");

const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

const app = express();

/* --------------------------------------------------
   View engine
-------------------------------------------------- */

app.set("view engine", "ejs");

app.set("views", path.join(__dirname, "../client/views"));

/* --------------------------------------------------
   Global middleware
-------------------------------------------------- */

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

/* --------------------------------------------------
   Static files
-------------------------------------------------- */

app.use(
  express.static(path.join(__dirname, "../client"), {
    index: false,
  }),
);

/* --------------------------------------------------
   Page routes
-------------------------------------------------- */

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/register", (req, res) => {
  res.render("register");
});

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

/* --------------------------------------------------
   API routes
-------------------------------------------------- */

app.use("/api/auth", authRoutes);

app.use("/api/quiz", quizRoutes);

/* --------------------------------------------------
   Error handlers
-------------------------------------------------- */

app.use(notFoundHandler);

app.use(errorHandler);

module.exports = app;
