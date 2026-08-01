"use strict";

const { rateLimit } = require("express-rate-limit");

function createJsonRateLimiter(options) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,

    standardHeaders: "draft-8",
    legacyHeaders: false,

    skipSuccessfulRequests: options.skipSuccessfulRequests || false,

    handler(req, res) {
      return res.status(429).json({
        success: false,
        message: options.message,
        retryAfterSeconds: Math.ceil(options.windowMs / 1000),
      });
    },
  });
}

/*
 * Login:
 * Maximum 10 failed login requests in 15 minutes.
 * Successful requests are not counted.
 */
const loginLimiter = createJsonRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  message: "Too many login attempts. Please wait 15 minutes and try again.",
});

/*
 * Registration:
 * Maximum 5 account-creation requests per hour.
 */
const registrationLimiter = createJsonRateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: "Too many registration attempts. Please try again later.",
});

/*
 * Forgot password:
 * Maximum 5 reset requests every 15 minutes.
 */
const forgotPasswordLimiter = createJsonRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: "Too many password-reset requests. Please wait before trying again.",
});

/*
 * Password reset submission:
 * Maximum 10 attempts every 15 minutes.
 */
const resetPasswordLimiter = createJsonRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: "Too many password-reset attempts. Please wait before trying again.",
});

/*
 * General authenticated settings updates.
 */
const settingsUpdateLimiter = createJsonRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: "Too many account update requests. Please try again later.",
});

module.exports = {
  loginLimiter,
  registrationLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  settingsUpdateLimiter,
};
