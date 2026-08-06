"use strict";

const express = require("express");

const {
  verifyEmail,
  resendVerification,
} = require("../controllers/emailVerificationController");

const {
  emailVerificationLimiter,
  resendVerificationLimiter,
} = require("../middleware/rateLimitMiddleware");

const router = express.Router();

router.get("/verify/:token", emailVerificationLimiter, verifyEmail);

router.post("/resend", resendVerificationLimiter, resendVerification);

module.exports = router;
