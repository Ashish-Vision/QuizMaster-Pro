"use strict";

const express = require("express");

const {
  requestPasswordReset,
  validateResetToken,
  resetPassword,
} = require("../controllers/passwordResetController");

const {
  forgotPasswordLimiter,
  resetPasswordLimiter,
} = require("../middleware/rateLimitMiddleware");

const router = express.Router();

router.post("/forgot", forgotPasswordLimiter, requestPasswordReset);

router.get("/validate/:token", validateResetToken);

router.patch("/reset/:token", resetPasswordLimiter, resetPassword);

module.exports = router;
