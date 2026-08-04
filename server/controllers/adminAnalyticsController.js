"use strict";

const User = require("../models/User");
const Score = require("../models/Score");
const Question = require("../models/Question");
const Achievement = require("../models/Achievement");

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

function getUtcDayStart(dateValue = new Date()) {
  const date = new Date(dateValue);

  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function createRecentDays(numberOfDays) {
  const today = getUtcDayStart(new Date());

  return Array.from(
    {
      length: numberOfDays,
    },
    (_, index) => {
      const offset = numberOfDays - 1 - index;

      const date = new Date(today.getTime() - offset * DAY_IN_MILLISECONDS);

      return {
        date,
        key: date.toISOString().slice(0, 10),
        label: new Intl.DateTimeFormat("en-IN", {
          day: "2-digit",
          month: "short",
          timeZone: "UTC",
        }).format(date),
      };
    },
  );
}

function normalizeDailyData(days, records) {
  const recordMap = new Map(
    records.map((record) => [String(record._id), record]),
  );

  return days.map((day) => {
    const record = recordMap.get(day.key) || {};

    return {
      date: day.key,
      label: day.label,
      attempts: Number(record.attempts) || 0,
      xpEarned: Number(record.xpEarned) || 0,
      averageAccuracy: Number((Number(record.averageAccuracy) || 0).toFixed(2)),
      newUsers: Number(record.newUsers) || 0,
    };
  });
}

function normalizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: String(user._id),

    firstName: user.firstName || "",

    lastName: user.lastName || "",

    fullName:
      `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown User",

    email: user.email || "",

    avatar: user.avatar || "",

    totalXp: Number(user.totalXp) || 0,

    quizzesCompleted: Number(user.quizzesCompleted) || 0,

    correctAnswers: Number(user.correctAnswers) || 0,

    currentStreak: Number(user.currentStreak) || 0,

    isActive: user.isActive !== false,
  };
}

async function getAdminAnalytics(req, res, next) {
  try {
    const requestedDays = Number.parseInt(req.query.days, 10);

    const periodDays = [7, 14, 30, 90].includes(requestedDays)
      ? requestedDays
      : 30;

    const days = createRecentDays(periodDays);
    const periodStart = days[0].date;

    const [
      totalUsers,
      totalActiveUsers,
      totalQuestions,
      totalActiveQuestions,
      totalAttempts,
      totalAchievementsUnlocked,
      distinctCategories,
      scoreSummaryResult,
      difficultyStatistics,
      categoryStatistics,
      dailyScoreStatistics,
      dailyUserStatistics,
      accuracyDistribution,
      topUsers,
      recentAttempts,
    ] = await Promise.all([
      User.countDocuments(),

      User.countDocuments({
        isActive: true,
      }),

      Question.countDocuments(),

      Question.countDocuments({
        isActive: {
          $ne: false,
        },
      }),

      Score.countDocuments(),

      Achievement.countDocuments(),

      Question.distinct("category"),

      Score.aggregate([
        {
          $group: {
            _id: null,

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

            averageTimeTakenSeconds: {
              $avg: {
                $ifNull: ["$timeTakenSeconds", 0],
              },
            },

            totalQuestionsAnswered: {
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

            perfectScores: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      {
                        $ifNull: ["$accuracy", 0],
                      },
                      100,
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),

      Question.aggregate([
        {
          $group: {
            _id: "$difficulty",

            count: {
              $sum: 1,
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

            averageTimeTakenSeconds: {
              $avg: {
                $ifNull: ["$timeTakenSeconds", 0],
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
          },
        },

        {
          $sort: {
            attempts: -1,
            averageAccuracy: -1,
          },
        },
      ]),

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
              $gte: periodStart,
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
              $gte: periodStart,
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

      User.find({
        role: "user",
      })
        .select(
          "firstName lastName email avatar totalXp quizzesCompleted correctAnswers currentStreak isActive",
        )
        .sort({
          totalXp: -1,
          quizzesCompleted: -1,
          correctAnswers: -1,
        })
        .limit(10)
        .lean(),

      Score.find()
        .populate({
          path: "user",
          select: "firstName lastName email avatar",
        })
        .select(
          "user category score totalQuestions accuracy xpEarned timeTakenSeconds completedAt createdAt",
        )
        .sort({
          completedAt: -1,
          createdAt: -1,
          _id: -1,
        })
        .limit(10)
        .lean(),
    ]);

    const scoreSummary = scoreSummaryResult[0] || {};

    const difficultyMap = new Map(
      difficultyStatistics.map((item) => [
        String(item._id),
        Number(item.count) || 0,
      ]),
    );

    const normalizedDifficultyStatistics = [
      {
        label: "Easy",
        count: difficultyMap.get("Easy") || 0,
      },
      {
        label: "Medium",
        count: difficultyMap.get("Medium") || 0,
      },
      {
        label: "Hard",
        count: difficultyMap.get("Hard") || 0,
      },
    ];

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

    const dailyScoreMap = new Map(
      dailyScoreStatistics.map((item) => [String(item._id), item]),
    );

    const dailyUserMap = new Map(
      dailyUserStatistics.map((item) => [String(item._id), item]),
    );

    const mergedDailyRecords = days.map((day) => {
      const scoreRecord = dailyScoreMap.get(day.key) || {};

      const userRecord = dailyUserMap.get(day.key) || {};

      return {
        _id: day.key,
        attempts: scoreRecord.attempts || 0,
        xpEarned: scoreRecord.xpEarned || 0,
        averageAccuracy: scoreRecord.averageAccuracy || 0,
        newUsers: userRecord.newUsers || 0,
      };
    });

    const normalizedDailyData = normalizeDailyData(days, mergedDailyRecords);

    const normalizedCategories = categoryStatistics.map((category) => ({
      category: category._id || "Unknown",

      attempts: Number(category.attempts) || 0,

      totalXpEarned: Number(category.totalXpEarned) || 0,

      averageAccuracy: Number(
        (Number(category.averageAccuracy) || 0).toFixed(2),
      ),

      averageTimeTakenSeconds: Math.round(
        Number(category.averageTimeTakenSeconds) || 0,
      ),

      totalCorrectAnswers: Number(category.totalCorrectAnswers) || 0,

      totalWrongAnswers: Number(category.totalWrongAnswers) || 0,
    }));

    const normalizedRecentAttempts = recentAttempts.map((attempt) => ({
      id: String(attempt._id),

      user: attempt.user
        ? {
            id: String(attempt.user._id),

            firstName: attempt.user.firstName || "",

            lastName: attempt.user.lastName || "",

            fullName:
              `${attempt.user.firstName || ""} ${
                attempt.user.lastName || ""
              }`.trim() || "Unknown User",

            email: attempt.user.email || "",

            avatar: attempt.user.avatar || "",
          }
        : null,

      category: attempt.category || "Unknown",

      score: Number(attempt.score) || 0,

      totalQuestions: Number(attempt.totalQuestions) || 0,

      accuracy: Number(attempt.accuracy) || 0,

      xpEarned: Number(attempt.xpEarned) || 0,

      timeTakenSeconds: Number(attempt.timeTakenSeconds) || 0,

      completedAt: attempt.completedAt || attempt.createdAt || null,
    }));

    return res.status(200).json({
      success: true,

      generatedAt: new Date().toISOString(),

      period: {
        days: periodDays,
        startDate: periodStart.toISOString(),
        endDate: new Date().toISOString(),
      },

      overview: {
        totalUsers,

        totalActiveUsers,

        totalQuestions,

        totalActiveQuestions,

        totalAttempts,

        totalCategories: distinctCategories.length,

        totalAchievementsUnlocked,

        totalXpEarned: Number(scoreSummary.totalXpEarned) || 0,

        averageAccuracy: Number(
          (Number(scoreSummary.averageAccuracy) || 0).toFixed(2),
        ),

        averageTimeTakenSeconds: Math.round(
          Number(scoreSummary.averageTimeTakenSeconds) || 0,
        ),

        totalQuestionsAnswered:
          Number(scoreSummary.totalQuestionsAnswered) || 0,

        perfectScores: Number(scoreSummary.perfectScores) || 0,
      },

      answerStatistics: {
        correctAnswers: Number(scoreSummary.totalCorrectAnswers) || 0,

        wrongAnswers: Number(scoreSummary.totalWrongAnswers) || 0,

        unansweredQuestions: Number(scoreSummary.totalUnansweredQuestions) || 0,
      },

      dailyTrends: normalizedDailyData,

      difficultyStatistics: normalizedDifficultyStatistics,

      accuracyDistribution: normalizedAccuracyDistribution,

      categoryStatistics: normalizedCategories,

      topUsers: topUsers.map(normalizeUser),

      recentAttempts: normalizedRecentAttempts,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getAdminAnalytics,
};
