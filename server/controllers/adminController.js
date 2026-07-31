"use strict";

const User = require("../models/User");
const Score = require("../models/Score");
const Achievement = require("../models/Achievement");

/**
 * GET /api/admin/dashboard
 *
 * Returns platform-wide statistics for administrators.
 */
async function getAdminDashboard(req, res, next) {
  try {
    const [
      totalUsers,
      totalAdmins,
      totalScores,
      totalAchievementsUnlocked,
      userStatistics,
      scoreStatistics,
      categoryStatistics,
      recentUsers,
      recentAttempts,
    ] = await Promise.all([
      User.countDocuments(),

      User.countDocuments({
        role: "admin",
      }),

      Score.countDocuments(),

      Achievement.countDocuments(),

      User.aggregate([
        {
          $group: {
            _id: null,

            totalStoredXp: {
              $sum: {
                $ifNull: ["$totalXp", 0],
              },
            },

            totalStoredQuizzes: {
              $sum: {
                $ifNull: ["$quizzesCompleted", 0],
              },
            },

            totalStoredCorrectAnswers: {
              $sum: {
                $ifNull: ["$correctAnswers", 0],
              },
            },

            averageUserXp: {
              $avg: {
                $ifNull: ["$totalXp", 0],
              },
            },
          },
        },
      ]),

      Score.aggregate([
        {
          $group: {
            _id: null,

            totalXpEarned: {
              $sum: {
                $ifNull: ["$xpEarned", 0],
              },
            },

            totalQuestions: {
              $sum: {
                $ifNull: ["$totalQuestions", 0],
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

            averageAccuracy: {
              $avg: {
                $ifNull: ["$accuracy", 0],
              },
            },

            averageQuizTimeSeconds: {
              $avg: {
                $ifNull: ["$timeTakenSeconds", 0],
              },
            },

            highestAccuracy: {
              $max: {
                $ifNull: ["$accuracy", 0],
              },
            },
          },
        },
      ]),

      Score.aggregate([
        {
          $group: {
            _id: "$category",

            attempts: {
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
          },
        },

        {
          $sort: {
            attempts: -1,
          },
        },
      ]),

      User.find()
        .select("firstName lastName email role totalXp createdAt")
        .sort({
          createdAt: -1,
        })
        .limit(5)
        .lean(),

      Score.find()
        .populate("user", "firstName lastName email")
        .select(
          "user category score totalQuestions accuracy xpEarned completedAt createdAt",
        )
        .sort({
          completedAt: -1,
          createdAt: -1,
        })
        .limit(8)
        .lean(),
    ]);

    const storedUserStats = userStatistics[0] || {};

    const storedScoreStats = scoreStatistics[0] || {};

    const normalizedCategories = categoryStatistics.map((category) => ({
      category: category._id || "Unknown",

      attempts: category.attempts || 0,

      totalXpEarned: category.totalXpEarned || 0,

      averageAccuracy: Number((category.averageAccuracy || 0).toFixed(2)),
    }));

    return res.status(200).json({
      success: true,

      overview: {
        totalUsers,
        totalAdmins,

        totalRegularUsers: Math.max(totalUsers - totalAdmins, 0),

        totalQuizAttempts: totalScores,

        totalAchievementsUnlocked,

        totalXpEarned: storedScoreStats.totalXpEarned || 0,

        averageAccuracy: Number(
          (storedScoreStats.averageAccuracy || 0).toFixed(2),
        ),

        averageQuizTimeSeconds: Math.round(
          storedScoreStats.averageQuizTimeSeconds || 0,
        ),

        highestAccuracy: storedScoreStats.highestAccuracy || 0,
      },

      answerStatistics: {
        totalQuestions: storedScoreStats.totalQuestions || 0,

        correctAnswers: storedScoreStats.totalCorrectAnswers || 0,

        wrongAnswers: storedScoreStats.totalWrongAnswers || 0,
      },

      userStatistics: {
        storedTotalXp: storedUserStats.totalStoredXp || 0,

        storedQuizzesCompleted: storedUserStats.totalStoredQuizzes || 0,

        storedCorrectAnswers: storedUserStats.totalStoredCorrectAnswers || 0,

        averageUserXp: Number((storedUserStats.averageUserXp || 0).toFixed(2)),
      },

      categoryStatistics: normalizedCategories,

      recentUsers,

      recentAttempts,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getAdminDashboard,
};
