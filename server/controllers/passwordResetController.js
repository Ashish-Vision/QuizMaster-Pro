"use strict";

const crypto = require("crypto");

const validator = require("validator");

const User = require("../models/User");

const { sendPasswordResetEmail } = require("../services/emailService");
const { incrementUserTokenVersion } = require("../utils/authToken");

const RESET_TOKEN_EXPIRY_MINUTES = 15;

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createResetUrl(req, rawToken) {
  const configuredOrigin = process.env.CLIENT_ORIGIN || process.env.APP_ORIGIN;

  const origin = configuredOrigin || `${req.protocol}://${req.get("host")}`;

  return `${origin}/reset-password?token=${encodeURIComponent(rawToken)}`;
}

/**
 * POST /api/password-reset/forgot
 *
 * Generates a password-reset token when the account exists.
 * The response remains generic to avoid exposing registered emails.
 */
async function requestPasswordReset(req, res, next) {
  try {
    const email = normalizeEmail(req.body.email);

    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address.",
      });
    }

    const user = await User.findOne({
      email,
      isActive: true,
    }).select("+passwordResetToken +passwordResetExpires");

    const genericResponse = {
      success: true,
      message:
        "If an active account uses that email, password-reset instructions have been created.",
    };

    if (!user) {
      return res.status(200).json(genericResponse);
    }

    const rawToken = crypto.randomBytes(32).toString("hex");

    user.passwordResetToken = hashResetToken(rawToken);

    user.passwordResetExpires = new Date(
      Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000,
    );

    await user.save({
      validateBeforeSave: false,
    });

    const resetUrl = createResetUrl(req, rawToken);

    try {
      await sendPasswordResetEmail({
        to: user.email,
        firstName: user.firstName,
        resetUrl,
        expiresInMinutes: RESET_TOKEN_EXPIRY_MINUTES,
      });
    } catch (emailError) {
      /*
       * Invalidate the token because the user did not
       * receive the corresponding reset URL.
       */
      user.passwordResetToken = null;
      user.passwordResetExpires = null;

      await user.save({
        validateBeforeSave: false,
      });

      console.error("Password-reset email failed:", emailError.message);

      if (process.env.NODE_ENV === "production") {
        return res.status(503).json({
          success: false,
          message:
            "Password-reset email could not be sent. Please try again later.",
        });
      }

      return res.status(500).json({
        success: false,
        message: `Email delivery failed: ${emailError.message}`,
      });
    }

    /*
     * During local development, return the reset URL so the
     * feature can be tested before an email provider is added.
     *
     * Never return the reset URL in production.
     */
    if (process.env.NODE_ENV !== "production") {
      return res.status(200).json({
        ...genericResponse,

        development: {
          resetUrl,
          expiresInMinutes: RESET_TOKEN_EXPIRY_MINUTES,
        },
      });
    }

    /*
     * Production email delivery will be added later.
     * The raw token must be emailed, never stored in MongoDB.
     */

    return res.status(200).json(genericResponse);
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/password-reset/validate/:token
 *
 * Checks whether the supplied reset token is valid.
 */
async function validateResetToken(req, res, next) {
  try {
    const rawToken =
      typeof req.params.token === "string" ? req.params.token.trim() : "";

    if (!rawToken) {
      return res.status(400).json({
        success: false,
        message: "A password-reset token is required.",
      });
    }

    const hashedToken = hashResetToken(rawToken);

    const user = await User.findOne({
      passwordResetToken: hashedToken,

      passwordResetExpires: {
        $gt: new Date(),
      },

      isActive: true,
    })
      .select("_id")
      .lean();

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "This password-reset link is invalid or has expired.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "The password-reset link is valid.",
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * PATCH /api/password-reset/reset/:token
 *
 * Changes the password and invalidates the reset token.
 */
async function resetPassword(req, res, next) {
  try {
    const rawToken =
      typeof req.params.token === "string" ? req.params.token.trim() : "";

    const newPassword =
      typeof req.body.newPassword === "string" ? req.body.newPassword : "";

    const confirmPassword =
      typeof req.body.confirmPassword === "string"
        ? req.body.confirmPassword
        : "";

    if (!rawToken) {
      return res.status(400).json({
        success: false,
        message: "A password-reset token is required.",
      });
    }

    if (!newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and password confirmation are required.",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must contain at least 8 characters.",
      });
    }

    if (newPassword.length > 128) {
      return res.status(400).json({
        success: false,
        message: "New password cannot exceed 128 characters.",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and confirmation do not match.",
      });
    }

    const hashedToken = hashResetToken(rawToken);

    const user = await User.findOne({
      passwordResetToken: hashedToken,

      passwordResetExpires: {
        $gt: new Date(),
      },

      isActive: true,
    }).select("+password +passwordResetToken +passwordResetExpires");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "This password-reset link is invalid or has expired.",
      });
    }

    const matchesExistingPassword = await user.comparePassword(newPassword);

    if (matchesExistingPassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from the current password.",
      });
    }

    user.password = newPassword;
    incrementUserTokenVersion(user);

    user.passwordResetToken = null;
    user.passwordResetExpires = null;

    await user.save();

    return res.status(200).json({
      success: true,
      message:
        "Password reset successfully. You can now log in using the new password.",
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(
        (validationError) => validationError.message,
      );

      return res.status(400).json({
        success: false,
        message: messages[0] || "The new password is invalid.",
        errors: messages,
      });
    }

    return next(error);
  }
}

module.exports = {
  requestPasswordReset,
  validateResetToken,
  resetPassword,
};
