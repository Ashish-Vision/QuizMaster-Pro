"use strict";

const express = require("express");

const {
  register,
  login,
  logout,
  getCurrentUser,
} = require("../controllers/authController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

const {
  loginLimiter,
  registrationLimiter,
} = require("../middleware/rateLimitMiddleware");

router.post("/register", registrationLimiter, register);

router.post("/login", loginLimiter, login);

router.post("/logout", logout);

router.get("/me", protect, getCurrentUser);

module.exports = router;
