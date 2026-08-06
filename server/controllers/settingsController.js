"use strict";

const validator = require("validator");

const User = require("../models/User");
const { incrementUserTokenVersion } = require("../utils/authToken");
const { sendAuthResponse } = require("../utils/helpers");
const { normalizeText } = require("../utils/normalize");

function createSafeAccount(user) {
  return {
    id: user._id,

    firstName: user.firstName,

    lastName: user.lastName,

    fullName: `${user.firstName || ""} ${user.lastName || ""}`.trim(),

    email: user.email,

    role: user.role,

    avatar: user.avatar || "",

    totalXp: Number(user.totalXp) || 0,

    quizzesCompleted: Number(user.quizzesCompleted) || 0,

    correctAnswers: Number(user.correctAnswers) || 0,

    currentStreak: Number(user.currentStreak) || 0,

    isActive: Boolean(user.isActive),

    lastLoginAt: user.lastLoginAt || null,

    lastQuizDate: user.lastQuizDate || null,

    createdAt: user.createdAt,

    updatedAt: user.updatedAt,
  };
}

/**
 * GET /api/settings
 *
 * Returns the authenticated user's account settings.
 */
async function getSettings(req, res, next) {
  try {
    const user = await User.findById(req.user._id).select("-password").lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Your account could not be found.",
      });
    }

    return res.status(200).json({
      success: true,

      account: createSafeAccount(user),
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * PATCH /api/settings/profile
 *
 * Updates the authenticated user's profile details.
 */
async function updateProfile(req, res, next) {
  try {
    const firstName = normalizeText(req.body.firstName);
    const lastName = normalizeText(req.body.lastName);
    const email = normalizeText(req.body.email).toLowerCase();

    if (!firstName || !lastName || !email) {
      return res.status(400).json({
        success: false,
        message: "First name, last name and email are required.",
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

    if (!validator.isEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address.",
      });
    }

    const duplicateUser = await User.findOne({
      email,
      _id: {
        $ne: req.user._id,
      },
    })
      .select("_id")
      .lean();

    if (duplicateUser) {
      return res.status(409).json({
        success: false,
        message: "Another account already uses this email address.",
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Your account could not be found.",
      });
    }

    user.firstName = firstName;
    user.lastName = lastName;
    user.email = email;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",

      account: createSafeAccount(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Another account already uses this email address.",
      });
    }

    if (error.name === "ValidationError") {
      const validationMessages = Object.values(error.errors).map(
        (validationError) => validationError.message,
      );

      return res.status(400).json({
        success: false,
        message: validationMessages[0] || "Profile information is invalid.",
        errors: validationMessages,
      });
    }

    return next(error);
  }
}

/**
 * PATCH /api/settings/password
 *
 * Changes the authenticated user's password after
 * validating the existing password.
 */
async function changePassword(req, res, next) {
  try {
    const currentPassword =
      typeof req.body.currentPassword === "string"
        ? req.body.currentPassword
        : "";

    const newPassword =
      typeof req.body.newPassword === "string" ? req.body.newPassword : "";

    const confirmPassword =
      typeof req.body.confirmPassword === "string"
        ? req.body.confirmPassword
        : "";

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message:
          "Current password, new password and password confirmation are required.",
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

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from your current password.",
      });
    }

    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Your account could not be found.",
      });
    }

    const currentPasswordMatches = await user.comparePassword(currentPassword);

    if (!currentPasswordMatches) {
      return res.status(401).json({
        success: false,
        message: "Your current password is incorrect.",
      });
    }

    user.password = newPassword;
    incrementUserTokenVersion(user);

    await user.save();

    return sendAuthResponse(res, 200, "Password changed successfully.", user);
  } catch (error) {
    if (error.name === "ValidationError") {
      const validationMessages = Object.values(error.errors).map(
        (validationError) => validationError.message,
      );

      return res.status(400).json({
        success: false,
        message: validationMessages[0] || "Password information is invalid.",
        errors: validationMessages,
      });
    }

    return next(error);
  }
}

module.exports = {
  getSettings,
  updateProfile,
  changePassword,
};
