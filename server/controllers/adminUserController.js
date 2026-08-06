"use strict";

const mongoose = require("mongoose");
const { incrementUserTokenVersion } = require("../utils/authToken");

const User = require("../models/User");
const Score = require("../models/Score");

const ALLOWED_ROLES = new Set(["user", "admin"]);

const ALLOWED_STATUSES = new Set(["all", "active", "disabled"]);

const ALLOWED_SORTS = new Set(["newest", "oldest", "xp", "quizzes", "name"]);

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getAuthenticatedUserId(req) {
  return String(req.user?._id || req.user?.id || "");
}

function createSafeUser(user) {
  return {
    id: String(user._id),

    firstName: typeof user.firstName === "string" ? user.firstName : "",

    lastName: typeof user.lastName === "string" ? user.lastName : "",

    fullName:
      `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown User",

    email: typeof user.email === "string" ? user.email : "",

    role: ALLOWED_ROLES.has(user.role) ? user.role : "user",

    avatar: typeof user.avatar === "string" ? user.avatar : "",

    totalXp: Number(user.totalXp) || 0,

    quizzesCompleted: Number(user.quizzesCompleted) || 0,

    correctAnswers: Number(user.correctAnswers) || 0,

    currentStreak: Number(user.currentStreak) || 0,

    isActive: user.isActive !== false,

    lastLoginAt: user.lastLoginAt || null,

    lastQuizDate: user.lastQuizDate || null,

    createdAt: user.createdAt || null,

    updatedAt: user.updatedAt || null,
  };
}

/**
 * GET /api/admin/users
 */
async function getUsers(req, res, next) {
  try {
    const requestedPage = Number.parseInt(req.query.page, 10);

    const requestedLimit = Number.parseInt(req.query.limit, 10);

    const page =
      Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

    const limit =
      Number.isInteger(requestedLimit) &&
      requestedLimit >= 1 &&
      requestedLimit <= 100
        ? requestedLimit
        : 10;

    const search = normalizeText(req.query.search);

    const role = normalizeText(req.query.role).toLowerCase() || "all";

    const status = normalizeText(req.query.status).toLowerCase() || "all";

    const sort = normalizeText(req.query.sort).toLowerCase() || "newest";

    if (role !== "all" && !ALLOWED_ROLES.has(role)) {
      return res.status(400).json({
        success: false,
        message: "Role filter is invalid.",
      });
    }

    if (!ALLOWED_STATUSES.has(status)) {
      return res.status(400).json({
        success: false,
        message: "Status filter is invalid.",
      });
    }

    if (!ALLOWED_SORTS.has(sort)) {
      return res.status(400).json({
        success: false,
        message: "Sort option is invalid.",
      });
    }

    const filter = {};

    if (search) {
      const safeSearch = escapeRegex(search);

      filter.$or = [
        {
          firstName: {
            $regex: safeSearch,
            $options: "i",
          },
        },
        {
          lastName: {
            $regex: safeSearch,
            $options: "i",
          },
        },
        {
          email: {
            $regex: safeSearch,
            $options: "i",
          },
        },
      ];
    }

    if (role !== "all") {
      filter.role = role;
    }

    if (status === "active") {
      filter.isActive = true;
    }

    if (status === "disabled") {
      filter.isActive = false;
    }

    const sortOptions = {
      newest: {
        createdAt: -1,
      },

      oldest: {
        createdAt: 1,
      },

      xp: {
        totalXp: -1,
      },

      quizzes: {
        quizzesCompleted: -1,
      },

      name: {
        firstName: 1,
        lastName: 1,
      },
    };

    const selectedSort = sortOptions[sort];

    const skip = (page - 1) * limit;

    const [
      users,
      filteredUserCount,
      platformUserCount,
      totalAdmins,
      activeUsers,
      disabledUsers,
    ] = await Promise.all([
      User.find(filter)
        .select(
          "firstName lastName email role avatar totalXp quizzesCompleted correctAnswers currentStreak isActive lastLoginAt lastQuizDate createdAt updatedAt",
        )
        .sort({
          ...selectedSort,
          _id: sort === "oldest" ? 1 : -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      User.countDocuments(filter),

      User.countDocuments(),

      User.countDocuments({
        role: "admin",
      }),

      User.countDocuments({
        isActive: true,
      }),

      User.countDocuments({
        isActive: false,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(filteredUserCount / limit));

    return res.status(200).json({
      success: true,

      summary: {
        totalUsers: platformUserCount,

        totalAdmins,

        totalRegularUsers: Math.max(platformUserCount - totalAdmins, 0),

        activeUsers,

        disabledUsers,
      },

      users: users.map(createSafeUser),

      currentAdminId: getAuthenticatedUserId(req),

      filters: {
        search,
        role,
        status,
        sort,
      },

      pagination: {
        currentPage: page,
        totalPages,

        totalUsers: filteredUserCount,

        limit,

        hasPreviousPage: page > 1,

        hasNextPage: page < totalPages,
      },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/admin/users/:userId
 */
async function getUserById(req, res, next) {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "The user ID is invalid.",
      });
    }

    const user = await User.findById(userId)
      .select(
        "firstName lastName email role avatar totalXp quizzesCompleted correctAnswers currentStreak isActive lastLoginAt lastQuizDate createdAt updatedAt",
      )
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User was not found.",
      });
    }

    const [statisticsResult] = await Score.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
        },
      },

      {
        $group: {
          _id: null,

          totalAttempts: {
            $sum: 1,
          },

          totalXpEarned: {
            $sum: {
              $ifNull: ["$xpEarned", 0],
            },
          },

          averageAccuracy: {
            $avg: {
              $ifNull: ["$accuracy", 0],
            },
          },

          bestAccuracy: {
            $max: {
              $ifNull: ["$accuracy", 0],
            },
          },

          totalCorrectAnswers: {
            $sum: {
              $ifNull: ["$correctAnswers", 0],
            },
          },

          totalWrongAnswers: {
            $sum: {
              $ifNull: ["$wrongAnswers", 0],
            },
          },

          totalUnansweredQuestions: {
            $sum: {
              $ifNull: ["$unansweredQuestions", 0],
            },
          },
        },
      },
    ]);

    const scoreStatistics = statisticsResult || {};

    return res.status(200).json({
      success: true,

      user: createSafeUser(user),

      statistics: {
        totalAttempts: Number(scoreStatistics.totalAttempts) || 0,

        totalXpEarned: Number(scoreStatistics.totalXpEarned) || 0,

        averageAccuracy: Number(
          (Number(scoreStatistics.averageAccuracy) || 0).toFixed(2),
        ),

        bestAccuracy: Number(scoreStatistics.bestAccuracy) || 0,

        totalCorrectAnswers: Number(scoreStatistics.totalCorrectAnswers) || 0,

        totalWrongAnswers: Number(scoreStatistics.totalWrongAnswers) || 0,

        totalUnansweredQuestions:
          Number(scoreStatistics.totalUnansweredQuestions) || 0,
      },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * PATCH /api/admin/users/:userId/role
 */
async function updateUserRole(req, res, next) {
  try {
    const { userId } = req.params;

    const role = normalizeText(req.body?.role).toLowerCase();

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "The user ID is invalid.",
      });
    }

    if (!ALLOWED_ROLES.has(role)) {
      return res.status(400).json({
        success: false,
        message: "Role must be user or admin.",
      });
    }

    const currentAdminId = getAuthenticatedUserId(req);

    if (currentAdminId === String(userId) && role !== "admin") {
      return res.status(400).json({
        success: false,
        message: "You cannot remove your own administrator role.",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User was not found.",
      });
    }

    if (user.role === role) {
      return res.status(200).json({
        success: true,
        message: "User already has this role.",
        user: createSafeUser(user),
      });
    }

    if (user.role === "admin" && role === "user") {
      const totalAdmins = await User.countDocuments({
        role: "admin",
      });

      if (totalAdmins <= 1) {
        return res.status(400).json({
          success: false,
          message: "The final administrator cannot be demoted.",
        });
      }
    }

    user.role = role;
    incrementUserTokenVersion(user);

    await user.save({
      validateBeforeSave: false,
    });

    return res.status(200).json({
      success: true,

      message:
        role === "admin"
          ? "User promoted to administrator successfully."
          : "Administrator role removed successfully.",

      user: createSafeUser(user),
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * PATCH /api/admin/users/:userId/status
 */
async function updateUserStatus(req, res, next) {
  try {
    const { userId } = req.params;

    const isActive = req.body?.isActive;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "The user ID is invalid.",
      });
    }

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be true or false.",
      });
    }

    const currentAdminId = getAuthenticatedUserId(req);

    if (currentAdminId === String(userId) && !isActive) {
      return res.status(400).json({
        success: false,
        message: "You cannot disable your own account.",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User was not found.",
      });
    }

    if (user.isActive === isActive) {
      return res.status(200).json({
        success: true,

        message: isActive
          ? "User account is already active."
          : "User account is already disabled.",

        user: createSafeUser(user),
      });
    }

    if (user.role === "admin" && !isActive) {
      const activeAdminCount = await User.countDocuments({
        role: "admin",
        isActive: true,
      });

      if (activeAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: "The final active administrator cannot be disabled.",
        });
      }
    }

    user.isActive = isActive;
    incrementUserTokenVersion(user);

    await user.save({
      validateBeforeSave: false,
    });

    return res.status(200).json({
      success: true,

      message: isActive
        ? "User account activated successfully."
        : "User account disabled successfully.",

      user: createSafeUser(user),
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getUsers,
  getUserById,
  updateUserRole,
  updateUserStatus,
};
