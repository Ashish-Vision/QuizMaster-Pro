"use strict";

const crypto = require("crypto");
const validator = require("validator");

const User = require("../models/User");

const { sendEmailVerificationEmail } = require("../services/emailService");

const VERIFICATION_EXPIRY_HOURS = 24;

function hashVerificationToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createVerificationUrl(req, rawToken) {
  const configuredOrigin = process.env.APP_ORIGIN || process.env.CLIENT_ORIGIN;

  const origin = configuredOrigin || `${req.protocol}://${req.get("host")}`;

  return `${origin}/verify-email?token=` + encodeURIComponent(rawToken);
}

/**
 * Creates a verification token and sends it
 * to the user's own registered email address.
 */
async function createAndSendVerification(user, req) {
  if (!user) {
    throw new Error("A valid user is required.");
  }

  if (!user.email) {
    throw new Error("The user does not have an email address.");
  }

  if (user.emailVerified) {
    return {
      alreadyVerified: true,
      verificationUrl: null,
    };
  }

  const rawToken = crypto.randomBytes(32).toString("hex");

  user.emailVerificationToken = hashVerificationToken(rawToken);

  user.emailVerificationExpires = new Date(
    Date.now() + VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000,
  );

  await user.save({
    validateBeforeSave: false,
  });

  const verificationUrl = createVerificationUrl(req, rawToken);

  try {
    /*
     * This is the important correction:
     * recipient is always the registered user's email.
     */
    await sendEmailVerificationEmail({
      to: user.email,

      firstName: user.firstName,

      verificationUrl,

      expiresInHours: VERIFICATION_EXPIRY_HOURS,
    });
  } catch (error) {
    /*
     * Remove the unusable token when email
     * delivery fails.
     */
    user.emailVerificationToken = null;

    user.emailVerificationExpires = null;

    await user.save({
      validateBeforeSave: false,
    });

    throw error;
  }

  return {
    alreadyVerified: false,
    verificationUrl,
  };
}

/**
 * GET /api/email-verification/verify/:token
 */
async function verifyEmail(req, res, next) {
  try {
    const rawToken =
      typeof req.params.token === "string" ? req.params.token.trim() : "";

    if (!rawToken) {
      return res.status(400).json({
        success: false,

        message: "An email-verification token is required.",
      });
    }

    const hashedToken = hashVerificationToken(rawToken);

    const user = await User.findOne({
      emailVerificationToken: hashedToken,

      emailVerificationExpires: {
        $gt: new Date(),
      },

      isActive: true,
    }).select("+emailVerificationToken +emailVerificationExpires");

    if (!user) {
      return res.status(400).json({
        success: false,

        message: "This email-verification link is invalid or has expired.",
      });
    }

    user.emailVerified = true;

    user.emailVerifiedAt = new Date();

    user.emailVerificationToken = null;

    user.emailVerificationExpires = null;

    await user.save({
      validateBeforeSave: false,
    });

    return res.status(200).json({
      success: true,

      message: "Email verified successfully. You can now log in.",
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/email-verification/resend
 */
async function resendVerification(req, res, next) {
  try {
    const email =
      typeof req.body.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";

    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({
        success: false,

        message: "Enter a valid email address.",
      });
    }

    /*
     * Generic message prevents exposing whether
     * an account exists.
     */
    const genericMessage =
      "If an unverified account uses that email, a new verification message has been sent.";

    const user = await User.findOne({
      email,
      isActive: true,
    }).select("+emailVerificationToken +emailVerificationExpires");

    if (!user) {
      return res.status(200).json({
        success: true,
        message: genericMessage,
      });
    }

    if (user.emailVerified) {
      return res.status(200).json({
        success: true,
        message: genericMessage,
      });
    }

    await createAndSendVerification(user, req);

    return res.status(200).json({
      success: true,
      message: genericMessage,
    });
  } catch (error) {
    console.error("Verification email resend failed:", error.message);

    /*
     * Pass unexpected database errors to the
     * global error handler.
     */
    if (error.name === "MongoServerError" || error.name === "ValidationError") {
      return next(error);
    }

    return res.status(503).json({
      success: false,

      message: "Verification email could not be sent. Please try again later.",
    });
  }
}

module.exports = {
  createAndSendVerification,
  verifyEmail,
  resendVerification,
};
