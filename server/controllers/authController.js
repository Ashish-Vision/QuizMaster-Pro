"use strict";

const validator = require("validator");

const User = require("../models/User");

const {
  getAuthCookieClearOptions,
  sendAuthResponse,
} = require("../utils/helpers");

const { createAndSendVerification } = require("./emailVerificationController");

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function register(req, res, next) {
  try {
    const firstName = normalizeText(req.body.firstName);

    const lastName = normalizeText(req.body.lastName);

    const normalizedEmail = normalizeText(req.body.email).toLowerCase();

    const password =
      typeof req.body.password === "string" ? req.body.password : "";

    if (!firstName || !lastName || !normalizedEmail || !password) {
      return res.status(400).json({
        success: false,

        message: "First name, last name, email and password are required.",
      });
    }

    if (firstName.length < 2 || firstName.length > 50) {
      return res.status(400).json({
        success: false,

        message: "First name must contain between 2 and 50 characters.",
      });
    }

    if (lastName.length < 2 || lastName.length > 50) {
      return res.status(400).json({
        success: false,

        message: "Last name must contain between 2 and 50 characters.",
      });
    }

    if (!validator.isEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,

        message: "Enter a valid email address.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,

        message: "Password must contain at least 8 characters.",
      });
    }

    if (password.length > 128) {
      return res.status(400).json({
        success: false,

        message: "Password cannot exceed 128 characters.",
      });
    }

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,

        message: "An account with this email already exists.",
      });
    }

    /*
     * The submitted email is stored on this user.
     * It is also used as the verification recipient.
     */
    const user = await User.create({
      firstName,
      lastName,

      email: normalizedEmail,

      password,

      emailVerified: false,
      emailVerifiedAt: null,
    });

    try {
      await createAndSendVerification(user, req);
    } catch (emailError) {
      console.error(
        "Registration verification email failed:",
        emailError.message,
      );

      /*
       * The account still exists, allowing the user
       * to use the resend-verification page.
       */
      return res.status(201).json({
        success: true,

        message:
          "Account created, but the verification email could not be sent. Please request another verification email.",

        requiresEmailVerification: true,

        email: user.email,
      });
    }

    /*
     * Do not call sendAuthResponse here.
     * New accounts must verify their email first.
     */
    return res.status(201).json({
      success: true,

      message:
        "Account created successfully. Check your email to verify your account.",

      requiresEmailVerification: true,

      email: user.email,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,

        message: "An account with this email already exists.",
      });
    }

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(
        (validationError) => validationError.message,
      );

      return res.status(400).json({
        success: false,

        message: messages[0] || "Registration information is invalid.",

        errors: messages,
      });
    }

    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const normalizedEmail = normalizeText(req.body.email).toLowerCase();

    const password =
      typeof req.body.password === "string" ? req.body.password : "";

    if (!normalizedEmail || !password) {
      return res.status(400).json({
        success: false,

        message: "Email and password are required.",
      });
    }

    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,

        message: "Invalid email or password.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,

        message: "This account has been disabled.",
      });
    }

    /*
     * Validate the password first so another person
     * cannot check whether an email is unverified
     * without knowing the password.
     */
    const passwordMatches = await user.comparePassword(password);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,

        message: "Invalid email or password.",
      });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,

        message: "Please verify your email address before logging in.",

        code: "EMAIL_NOT_VERIFIED",

        email: user.email,
      });
    }

    user.lastLoginAt = new Date();

    await user.save({
      validateBeforeSave: false,
    });

    return sendAuthResponse(res, 200, "Login successful.", user);
  } catch (error) {
    return next(error);
  }
}

async function logout(req, res) {
  res.clearCookie("quizmaster_token", getAuthCookieClearOptions());

  return res.status(200).json({
    success: true,

    message: "Logout successful.",
  });
}

async function getCurrentUser(req, res) {
  return res.status(200).json({
    success: true,

    user: req.user.toSafeObject(),
  });
}

module.exports = {
  register,
  login,
  logout,
  getCurrentUser,
};
