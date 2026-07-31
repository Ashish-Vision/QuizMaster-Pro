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
// View Engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../client/views"));

// Static Files
app.use(
  express.static(path.join(__dirname, "../client"), {
    index: false,
  }),
);

// Home Route
app.get("/", (req, res) => {
  res.render("index");
});

module.exports = app;
