"use strict";

const mongoose = require("mongoose");

const User = require("../models/User");
const Score = require("../models/Score");

const ALLOWED_ROLES = ["user", "admin"];

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createSafeUser(user) {
  return {
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
    email: user.email,
    role: user.role,
    avatar: user.avatar || "",
    totalXp: user.totalXp || 0,
    quizzesCompleted: user.quizzesCompleted || 0,
    correctAnswers: user.correctAnswers || 0,
    currentStreak: user.currentStreak || 0,
    isActive: Boolean(user.isActive),
    lastLoginAt: user.lastLoginAt || null,
    lastQuizDate: user.lastQuizDate || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
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
    const role = normalizeText(req.query.role);
    const status = normalizeText(req.query.status);
    const sort = normalizeText(req.query.sort) || "newest";

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

    if (role && role !== "all") {
      if (!ALLOWED_ROLES.includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Role filter is invalid.",
        });
      }

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

    const selectedSort = sortOptions[sort] || sortOptions.newest;

    const skip = (page - 1) * limit;

    const [users, totalUsers, totalAdmins, activeUsers, disabledUsers] =
      await Promise.all([
        User.find(filter)
          .select(
            "firstName lastName email role avatar totalXp quizzesCompleted correctAnswers currentStreak isActive lastLoginAt lastQuizDate createdAt updatedAt",
          )
          .sort({
            ...selectedSort,
            _id: -1,
          })
          .skip(skip)
          .limit(limit)
          .lean(),

        User.countDocuments(filter),

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

    const totalPages = Math.max(1, Math.ceil(totalUsers / limit));

    return res.status(200).json({
      success: true,

      summary: {
        totalUsers: await User.countDocuments(),
        totalAdmins,
        totalRegularUsers: Math.max(
          (await User.countDocuments()) - totalAdmins,
          0,
        ),
        activeUsers,
        disabledUsers,
      },

      users: users.map(createSafeUser),

      currentAdminId: String(req.user._id),

      filters: {
        search,
        role: role || "all",
        status: status || "all",
        sort,
      },

      pagination: {
        currentPage: page,
        totalPages,
        totalUsers,
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

    const user = await User.findById(userId).select("-password").lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User was not found.",
      });
    }

    const statistics = await Score.aggregate([
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
        },
      },
    ]);

    const scoreStatistics = statistics[0] || {};

    return res.status(200).json({
      success: true,
      user: createSafeUser(user),

      statistics: {
        totalAttempts: scoreStatistics.totalAttempts || 0,
        totalXpEarned: scoreStatistics.totalXpEarned || 0,
        averageAccuracy: Number(
          (scoreStatistics.averageAccuracy || 0).toFixed(2),
        ),
        bestAccuracy: scoreStatistics.bestAccuracy || 0,
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
    const role = normalizeText(req.body.role).toLowerCase();

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "The user ID is invalid.",
      });
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Role must be user or admin.",
      });
    }

    if (String(req.user._id) === String(userId) && role !== "admin") {
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

    user.role = role;

    await user.save({
      validateBeforeSave: false,
    });

    return res.status(200).json({
      success: true,
      message: "User role updated successfully.",
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
    const isActive = req.body.isActive;

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

    if (String(req.user._id) === String(userId) && !isActive) {
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

    user.isActive = isActive;

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
