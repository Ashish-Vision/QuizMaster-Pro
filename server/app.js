const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../client/views"));

// Static files
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

// 404 page
app.use((req, res) => {
  res.status(404).send("Page not found");
});

module.exports = app;
