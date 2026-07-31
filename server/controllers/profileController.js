"use strict";

const mongoose = require("mongoose");
const validator = require("validator");

const User = require("../models/User");
const Score = require("../models/Score");

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function getProfileStatistics(userId) {
  const objectId = new mongoose.Types.ObjectId(userId);

  const statistics = await Score.aggregate([
    {
      $match: {
        user: objectId,
      },
    },
    {
      $group: {
        _id: null,
        highestScore: {
          $max: "$score",
        },
        highestAccuracy: {
          $max: "$accuracy",
        },
        averageAccuracy: {
          $avg: "$accuracy",
        },
        averageTimeSeconds: {
          $avg: "$timeTakenSeconds",
        },
        totalXpEarned: {
          $sum: "$xpEarned",
        },
        totalQuestionsAnswered: {
          $sum: "$attemptedQuestions",
        },
        totalWrongAnswers: {
          $sum: "$wrongAnswers",
        },
        totalUnansweredQuestions: {
          $sum: "$unansweredQuestions",
        },
      },
    },
  ]);

  const categoryStatistics = await Score.aggregate([
    {
      $match: {
        user: objectId,
      },
    },
    {
      $group: {
        _id: "$category",
        attempts: {
          $sum: 1,
        },
        correctAnswers: {
          $sum: "$correctAnswers",
        },
        averageAccuracy: {
          $avg: "$accuracy",
        },
        totalXp: {
          $sum: "$xpEarned",
        },
      },
    },
    {
      $sort: {
        attempts: -1,
        averageAccuracy: -1,
        correctAnswers: -1,
      },
    },
    {
      $limit: 1,
    },
  ]);

  const summary = statistics[0] || {};
  const favoriteCategory = categoryStatistics[0] || null;

  return {
    highestScore: summary.highestScore || 0,

    highestAccuracy: Number((summary.highestAccuracy || 0).toFixed(2)),

    averageAccuracy: Number((summary.averageAccuracy || 0).toFixed(2)),

    averageTimeSeconds: Math.round(summary.averageTimeSeconds || 0),

    totalXpEarned: summary.totalXpEarned || 0,

    totalQuestionsAnswered: summary.totalQuestionsAnswered || 0,

    totalWrongAnswers: summary.totalWrongAnswers || 0,

    totalUnansweredQuestions: summary.totalUnansweredQuestions || 0,

    favoriteCategory: favoriteCategory
      ? {
          name: favoriteCategory._id,
          attempts: favoriteCategory.attempts,
          correctAnswers: favoriteCategory.correctAnswers,
          averageAccuracy: Number(
            (favoriteCategory.averageAccuracy || 0).toFixed(2),
          ),
          totalXp: favoriteCategory.totalXp,
        }
      : null,
  };
}

async function getProfile(req, res, next) {
  try {
    const userId = req.user?._id || req.user?.id;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User profile was not found.",
      });
    }

    const statistics = await getProfileStatistics(userId);

    return res.status(200).json({
      success: true,
      profile: {
        ...user.toSafeObject(),
        statistics,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function updateProfile(req, res, next) {
  try {
    const userId = req.user?._id || req.user?.id;

    const firstName = normalizeText(req.body.firstName);

    const lastName = normalizeText(req.body.lastName);

    const avatar = normalizeText(req.body.avatar);

    if (!firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: "First name and last name are required.",
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

    if (
      avatar &&
      !validator.isURL(avatar, {
        protocols: ["http", "https"],
        require_protocol: true,
      })
    ) {
      return res.status(400).json({
        success: false,
        message: "Avatar must be a valid HTTP or HTTPS URL.",
      });
    }

    if (avatar.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Avatar URL cannot exceed 1000 characters.",
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        firstName,
        lastName,
        avatar,
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User profile was not found.",
      });
    }

    const statistics = await getProfileStatistics(userId);

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      profile: {
        ...user.toSafeObject(),
        statistics,
      },
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(
        (validationError) => validationError.message,
      );

      return res.status(400).json({
        success: false,
        message: messages[0] || "Profile validation failed.",
        errors: messages,
      });
    }

    return next(error);
  }
}

module.exports = {
  getProfile,
  updateProfile,
};
