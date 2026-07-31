"use strict";

const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const authRoutes = require("./routes/authRoutes");
const quizRoutes = require("./routes/quizRoutes");

const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

const app = express();

// These must come before routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../client/views"));

app.use(
  express.static(path.join(__dirname, "../client"), {
    index: false,
  }),
);

// Page routes
app.get("/", (req, res) => {
  res.render("index");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.get("/dashboard", (req, res) => {
  res.render("dashboard");
});

// API routes must come after cookieParser()
app.use("/api/auth", authRoutes);
app.use("/api/quiz", quizRoutes);

// Error handlers must remain last
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
