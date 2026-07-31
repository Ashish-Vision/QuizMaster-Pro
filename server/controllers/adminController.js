"use strict";

const User = require("../models/User");
const Score = require("../models/Score");
const Achievement = require("../models/Achievement");

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

/**
 * Returns the beginning of a date in UTC.
 */
function getUtcDayStart(dateValue) {
  const date = new Date(dateValue);

  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/**
 * Creates details for the most recent seven UTC days,
 * including today.
 */
function createLastSevenDays() {
  const today = getUtcDayStart(new Date());

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getTime() - (6 - index) * DAY_IN_MILLISECONDS);

    return {
      date,
      key: date.toISOString().slice(0, 10),

      label: new Intl.DateTimeFormat("en-IN", {
        weekday: "short",
        timeZone: "UTC",
      }).format(date),
    };
  });
}

/**
 * Inserts missing days with zero values so every chart
 * always receives exactly seven entries.
 */
function normalizeDailyTrend(days, records, valueFields) {
  const recordMap = new Map(
    records.map((record) => [String(record._id), record]),
  );

  return days.map((day) => {
    const record = recordMap.get(day.key) || {};

    const normalizedDay = {
      date: day.key,
      label: day.label,
    };

    valueFields.forEach((field) => {
      normalizedDay[field] = Number(record[field]) || 0;
    });

    return normalizedDay;
  });
}

/**
 * GET /api/admin/dashboard
 *
 * Returns platform-wide statistics, recent activity,
 * category performance and seven-day chart data.
 */
async function getAdminDashboard(req, res, next) {
  try {
    const sevenDays = createLastSevenDays();
    const sevenDayStart = sevenDays[0].date;

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
      dailyScoreStatistics,
      dailyUserStatistics,
      accuracyDistribution,
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

            totalUnansweredQuestions: {
              $sum: {
                $ifNull: ["$unansweredQuestions", 0],
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
            _id: 1,
          },
        },
      ]),

      User.find()
        .select("firstName lastName email role totalXp createdAt")
        .sort({
          createdAt: -1,
          _id: -1,
        })
        .limit(5)
        .lean(),

      Score.find()
        .populate({
          path: "user",
          select: "firstName lastName email",
        })
        .select(
          "user category score totalQuestions accuracy xpEarned completedAt createdAt",
        )
        .sort({
          completedAt: -1,
          createdAt: -1,
          _id: -1,
        })
        .limit(8)
        .lean(),

      Score.aggregate([
        {
          $addFields: {
            chartDate: {
              $ifNull: ["$completedAt", "$createdAt"],
            },
          },
        },

        {
          $match: {
            chartDate: {
              $gte: sevenDayStart,
            },
          },
        },

        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$chartDate",
                timezone: "UTC",
              },
            },

            attempts: {
              $sum: 1,
            },

            xpEarned: {
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
            _id: 1,
          },
        },
      ]),

      User.aggregate([
        {
          $match: {
            createdAt: {
              $gte: sevenDayStart,
            },
          },
        },

        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
                timezone: "UTC",
              },
            },

            newUsers: {
              $sum: 1,
            },
          },
        },

        {
          $sort: {
            _id: 1,
          },
        },
      ]),

      Score.aggregate([
        {
          $bucket: {
            groupBy: {
              $ifNull: ["$accuracy", 0],
            },

            boundaries: [0, 40, 60, 80, 100, 101],

            default: "Unknown",

            output: {
              count: {
                $sum: 1,
              },
            },
          },
        },
      ]),
    ]);

    const storedUserStats = userStatistics[0] || {};
    const storedScoreStats = scoreStatistics[0] || {};

    const normalizedCategories = categoryStatistics.map((category) => ({
      category: category._id || "Unknown",

      attempts: Number(category.attempts) || 0,

      totalXpEarned: Number(category.totalXpEarned) || 0,

      averageAccuracy: Number(
        (Number(category.averageAccuracy) || 0).toFixed(2),
      ),
    }));

    const normalizedDailyScores = normalizeDailyTrend(
      sevenDays,
      dailyScoreStatistics,
      ["attempts", "xpEarned", "averageAccuracy"],
    ).map((day) => ({
      ...day,

      averageAccuracy: Number((Number(day.averageAccuracy) || 0).toFixed(2)),
    }));

    const normalizedDailyUsers = normalizeDailyTrend(
      sevenDays,
      dailyUserStatistics,
      ["newUsers"],
    );

    const dailyTrends = normalizedDailyScores.map((scoreDay, index) => ({
      ...scoreDay,

      newUsers: Number(normalizedDailyUsers[index]?.newUsers) || 0,
    }));

    const accuracyMap = new Map(
      accuracyDistribution.map((item) => [
        String(item._id),
        Number(item.count) || 0,
      ]),
    );

    const normalizedAccuracyDistribution = [
      {
        label: "Below 40%",
        count: accuracyMap.get("0") || 0,
      },
      {
        label: "40–59%",
        count: accuracyMap.get("40") || 0,
      },
      {
        label: "60–79%",
        count: accuracyMap.get("60") || 0,
      },
      {
        label: "80–99%",
        count: accuracyMap.get("80") || 0,
      },
      {
        label: "100%",
        count: accuracyMap.get("100") || 0,
      },
    ];

    return res.status(200).json({
      success: true,

      overview: {
        totalUsers,

        totalAdmins,

        totalRegularUsers: Math.max(totalUsers - totalAdmins, 0),

        totalQuizAttempts: totalScores,

        totalAchievementsUnlocked,

        totalXpEarned: Number(storedScoreStats.totalXpEarned) || 0,

        averageAccuracy: Number(
          (Number(storedScoreStats.averageAccuracy) || 0).toFixed(2),
        ),

        averageQuizTimeSeconds: Math.round(
          Number(storedScoreStats.averageQuizTimeSeconds) || 0,
        ),

        highestAccuracy: Number(storedScoreStats.highestAccuracy) || 0,
      },

      answerStatistics: {
        totalQuestions: Number(storedScoreStats.totalQuestions) || 0,

        correctAnswers: Number(storedScoreStats.totalCorrectAnswers) || 0,

        wrongAnswers: Number(storedScoreStats.totalWrongAnswers) || 0,

        unansweredQuestions:
          Number(storedScoreStats.totalUnansweredQuestions) || 0,
      },

      userStatistics: {
        storedTotalXp: Number(storedUserStats.totalStoredXp) || 0,

        storedQuizzesCompleted: Number(storedUserStats.totalStoredQuizzes) || 0,

        storedCorrectAnswers:
          Number(storedUserStats.totalStoredCorrectAnswers) || 0,

        averageUserXp: Number(
          (Number(storedUserStats.averageUserXp) || 0).toFixed(2),
        ),
      },

      trends: {
        periodDays: 7,

        daily: dailyTrends,

        accuracyDistribution: normalizedAccuracyDistribution,
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
