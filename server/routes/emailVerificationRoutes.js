"use strict";

const express = require("express");

const {
  verifyEmail,
  resendVerification,
} = require("../controllers/emailVerificationController");

const { forgotPasswordLimiter } = require("../middleware/rateLimitMiddleware");

const router = express.Router();

router.get("/verify/:token", verifyEmail);

router.post("/resend", forgotPasswordLimiter, resendVerification);

module.exports = router;
