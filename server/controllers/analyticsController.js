"use strict";

const mongoose = require("mongoose");

const Score = require("../models/Score");
const User = require("../models/User");

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

function getUserId(req) {
  return req.user?._id || req.user?.id || null;
}

function normalizeNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function roundNumber(value, decimalPlaces = 2) {
  return Number(normalizeNumber(value).toFixed(decimalPlaces));
}

function getStartOfUtcDay(date = new Date()) {
  const safeDate = new Date(date);

  return new Date(
    Date.UTC(
      safeDate.getUTCFullYear(),
      safeDate.getUTCMonth(),
      safeDate.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
}

function addUtcDays(date, numberOfDays) {
  const result = getStartOfUtcDay(date);

  result.setUTCDate(result.getUTCDate() + numberOfDays);

  return result;
}

function getDateKey(date) {
  return getStartOfUtcDay(date).toISOString().slice(0, 10);
}

function getDayLabel(date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "UTC",
  }).format(date);
}

function getMonthLabel(year, month) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function getEmptySummary() {
  return {
    totalQuizzes: 0,
    totalQuestions: 0,
    totalAttemptedQuestions: 0,
    totalCorrectAnswers: 0,
    totalWrongAnswers: 0,
    totalUnansweredQuestions: 0,
    totalXpEarned: 0,
    averageAccuracy: 0,
    bestAccuracy: 0,
    lowestAccuracy: 0,
    averageTimeTakenSeconds: 0,
    fastestQuizSeconds: 0,
    longestQuizSeconds: 0,
    perfectScores: 0,
  };
}

/* ============================================================
   Summary Analytics
============================================================ */

async function getSummary(objectId) {
  const results = await Score.aggregate([
    {
      $match: {
        user: objectId,
      },
    },

    {
      $group: {
        _id: null,

        totalQuizzes: {
          $sum: 1,
        },

        totalQuestions: {
          $sum: {
            $ifNull: ["$totalQuestions", 0],
          },
        },

        totalAttemptedQuestions: {
          $sum: {
            $ifNull: ["$attemptedQuestions", 0],
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

        lowestAccuracy: {
          $min: {
            $ifNull: ["$accuracy", 0],
          },
        },

        averageTimeTakenSeconds: {
          $avg: {
            $ifNull: ["$timeTakenSeconds", 0],
          },
        },

        fastestQuizSeconds: {
          $min: {
            $ifNull: ["$timeTakenSeconds", 0],
          },
        },

        longestQuizSeconds: {
          $max: {
            $ifNull: ["$timeTakenSeconds", 0],
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
  ]);

  const summary = results[0] || getEmptySummary();

  return {
    totalQuizzes: normalizeNumber(summary.totalQuizzes),

    totalQuestions: normalizeNumber(summary.totalQuestions),

    totalAttemptedQuestions: normalizeNumber(summary.totalAttemptedQuestions),

    totalCorrectAnswers: normalizeNumber(summary.totalCorrectAnswers),

    totalWrongAnswers: normalizeNumber(summary.totalWrongAnswers),

    totalUnansweredQuestions: normalizeNumber(summary.totalUnansweredQuestions),

    totalXpEarned: normalizeNumber(summary.totalXpEarned),

    averageAccuracy: roundNumber(summary.averageAccuracy),

    bestAccuracy: roundNumber(summary.bestAccuracy),

    lowestAccuracy: roundNumber(summary.lowestAccuracy),

    averageTimeTakenSeconds: Math.round(
      normalizeNumber(summary.averageTimeTakenSeconds),
    ),

    fastestQuizSeconds: Math.round(normalizeNumber(summary.fastestQuizSeconds)),

    longestQuizSeconds: Math.round(normalizeNumber(summary.longestQuizSeconds)),

    perfectScores: normalizeNumber(summary.perfectScores),
  };
}

/* ============================================================
   Category Analytics
============================================================ */

async function getCategoryPerformance(objectId) {
  const results = await Score.aggregate([
    {
      $match: {
        user: objectId,
      },
    },

    {
      $group: {
        _id: "$category",

        quizzesCompleted: {
          $sum: 1,
        },

        totalQuestions: {
          $sum: {
            $ifNull: ["$totalQuestions", 0],
          },
        },

        attemptedQuestions: {
          $sum: {
            $ifNull: ["$attemptedQuestions", 0],
          },
        },

        correctAnswers: {
          $sum: {
            $ifNull: ["$correctAnswers", 0],
          },
        },

        wrongAnswers: {
          $sum: {
            $ifNull: ["$wrongAnswers", 0],
          },
        },

        unansweredQuestions: {
          $sum: {
            $ifNull: ["$unansweredQuestions", 0],
          },
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

        bestAccuracy: {
          $max: {
            $ifNull: ["$accuracy", 0],
          },
        },

        averageTimeTakenSeconds: {
          $avg: {
            $ifNull: ["$timeTakenSeconds", 0],
          },
        },

        latestAttemptAt: {
          $max: "$completedAt",
        },
      },
    },

    {
      $sort: {
        averageAccuracy: -1,
        quizzesCompleted: -1,
        xpEarned: -1,
      },
    },
  ]);

  return results.map((category) => ({
    category: category._id || "Unknown",

    quizzesCompleted: normalizeNumber(category.quizzesCompleted),

    totalQuestions: normalizeNumber(category.totalQuestions),

    attemptedQuestions: normalizeNumber(category.attemptedQuestions),

    correctAnswers: normalizeNumber(category.correctAnswers),

    wrongAnswers: normalizeNumber(category.wrongAnswers),

    unansweredQuestions: normalizeNumber(category.unansweredQuestions),

    xpEarned: normalizeNumber(category.xpEarned),

    averageAccuracy: roundNumber(category.averageAccuracy),

    bestAccuracy: roundNumber(category.bestAccuracy),

    averageTimeTakenSeconds: Math.round(
      normalizeNumber(category.averageTimeTakenSeconds),
    ),

    latestAttemptAt: category.latestAttemptAt || null,
  }));
}

/* ============================================================
   Recent Performance
============================================================ */

async function getRecentPerformance(objectId, limit = 10) {
  const scores = await Score.find({
    user: objectId,
  })
    .select(
      [
        "category",
        "score",
        "totalQuestions",
        "attemptedQuestions",
        "correctAnswers",
        "wrongAnswers",
        "unansweredQuestions",
        "accuracy",
        "xpEarned",
        "timeTakenSeconds",
        "completedAt",
        "createdAt",
      ].join(" "),
    )
    .sort({
      completedAt: -1,
      createdAt: -1,
    })
    .limit(limit)
    .lean();

  return scores.map((score) => ({
    id: score._id,

    category: score.category || "Unknown",

    score: normalizeNumber(score.score),

    totalQuestions: normalizeNumber(score.totalQuestions),

    attemptedQuestions: normalizeNumber(score.attemptedQuestions),

    correctAnswers: normalizeNumber(score.correctAnswers),

    wrongAnswers: normalizeNumber(score.wrongAnswers),

    unansweredQuestions: normalizeNumber(score.unansweredQuestions),

    accuracy: roundNumber(score.accuracy),

    xpEarned: normalizeNumber(score.xpEarned),

    timeTakenSeconds: Math.round(normalizeNumber(score.timeTakenSeconds)),

    completedAt: score.completedAt || score.createdAt || null,
  }));
}

/* ============================================================
   Monthly Performance
============================================================ */

async function getMonthlyPerformance(objectId) {
  const twelveMonthsAgo = new Date();

  twelveMonthsAgo.setUTCMonth(twelveMonthsAgo.getUTCMonth() - 11);

  twelveMonthsAgo.setUTCDate(1);
  twelveMonthsAgo.setUTCHours(0, 0, 0, 0);

  const results = await Score.aggregate([
    {
      $match: {
        user: objectId,

        completedAt: {
          $gte: twelveMonthsAgo,
        },
      },
    },

    {
      $group: {
        _id: {
          year: {
            $year: "$completedAt",
          },

          month: {
            $month: "$completedAt",
          },
        },

        quizzesCompleted: {
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

        totalCorrectAnswers: {
          $sum: {
            $ifNull: ["$correctAnswers", 0],
          },
        },
      },
    },

    {
      $sort: {
        "_id.year": 1,
        "_id.month": 1,
      },
    },
  ]);

  return results.map((item) => ({
    year: item._id.year,
    month: item._id.month,

    label: getMonthLabel(item._id.year, item._id.month),

    quizzesCompleted: normalizeNumber(item.quizzesCompleted),

    totalXpEarned: normalizeNumber(item.totalXpEarned),

    averageAccuracy: roundNumber(item.averageAccuracy),

    totalCorrectAnswers: normalizeNumber(item.totalCorrectAnswers),
  }));
}

/* ============================================================
   Daily Performance
============================================================ */

async function getDailyPerformance(objectId) {
  const today = getStartOfUtcDay(new Date());

  const startDate = addUtcDays(today, -13);

  const endDate = addUtcDays(today, 1);

  const results = await Score.aggregate([
    {
      $match: {
        user: objectId,

        completedAt: {
          $gte: startDate,
          $lt: endDate,
        },
      },
    },

    {
      $project: {
        dateKey: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$completedAt",
            timezone: "UTC",
          },
        },

        accuracy: {
          $ifNull: ["$accuracy", 0],
        },

        xpEarned: {
          $ifNull: ["$xpEarned", 0],
        },

        correctAnswers: {
          $ifNull: ["$correctAnswers", 0],
        },

        timeTakenSeconds: {
          $ifNull: ["$timeTakenSeconds", 0],
        },
      },
    },

    {
      $group: {
        _id: "$dateKey",

        quizzesCompleted: {
          $sum: 1,
        },

        xpEarned: {
          $sum: "$xpEarned",
        },

        correctAnswers: {
          $sum: "$correctAnswers",
        },

        averageAccuracy: {
          $avg: "$accuracy",
        },

        averageTimeTakenSeconds: {
          $avg: "$timeTakenSeconds",
        },
      },
    },

    {
      $sort: {
        _id: 1,
      },
    },
  ]);

  const activityMap = new Map(results.map((item) => [item._id, item]));

  return Array.from(
    {
      length: 14,
    },
    (_, index) => {
      const date = addUtcDays(startDate, index);

      const dateKey = getDateKey(date);

      const activity = activityMap.get(dateKey);

      return {
        dateKey,

        dayLabel: getDayLabel(date),

        date: date.toISOString(),

        quizzesCompleted: normalizeNumber(activity?.quizzesCompleted),

        xpEarned: normalizeNumber(activity?.xpEarned),

        correctAnswers: normalizeNumber(activity?.correctAnswers),

        averageAccuracy: roundNumber(activity?.averageAccuracy),

        averageTimeTakenSeconds: Math.round(
          normalizeNumber(activity?.averageTimeTakenSeconds),
        ),

        isActive: Boolean(activity?.quizzesCompleted),

        isToday: dateKey === getDateKey(today),
      };
    },
  );
}

/* ============================================================
   Recent Comparison
============================================================ */

async function getPerformanceComparison(objectId) {
  const recentScores = await Score.find({
    user: objectId,
  })
    .select("accuracy xpEarned timeTakenSeconds correctAnswers completedAt")
    .sort({
      completedAt: -1,
    })
    .limit(10)
    .lean();

  if (recentScores.length < 2) {
    return {
      available: false,
      recentQuizCount: recentScores.length,
      previousQuizCount: 0,
      accuracyChange: 0,
      xpChange: 0,
      timeChangeSeconds: 0,
      direction: "stable",
    };
  }

  const midpoint = Math.ceil(recentScores.length / 2);

  const recentGroup = recentScores.slice(0, midpoint);

  const previousGroup = recentScores.slice(midpoint);

  function calculateAverage(scores, property) {
    if (!scores.length) {
      return 0;
    }

    const total = scores.reduce(
      (sum, score) => sum + normalizeNumber(score[property]),
      0,
    );

    return total / scores.length;
  }

  const recentAccuracy = calculateAverage(recentGroup, "accuracy");

  const previousAccuracy = calculateAverage(previousGroup, "accuracy");

  const recentXp = calculateAverage(recentGroup, "xpEarned");

  const previousXp = calculateAverage(previousGroup, "xpEarned");

  const recentTime = calculateAverage(recentGroup, "timeTakenSeconds");

  const previousTime = calculateAverage(previousGroup, "timeTakenSeconds");

  const accuracyChange = roundNumber(recentAccuracy - previousAccuracy);

  return {
    available: previousGroup.length > 0,

    recentQuizCount: recentGroup.length,

    previousQuizCount: previousGroup.length,

    recentAccuracy: roundNumber(recentAccuracy),

    previousAccuracy: roundNumber(previousAccuracy),

    accuracyChange,

    recentAverageXp: roundNumber(recentXp),

    previousAverageXp: roundNumber(previousXp),

    xpChange: roundNumber(recentXp - previousXp),

    recentAverageTimeSeconds: Math.round(recentTime),

    previousAverageTimeSeconds: Math.round(previousTime),

    timeChangeSeconds: Math.round(recentTime - previousTime),

    direction:
      accuracyChange > 0
        ? "improving"
        : accuracyChange < 0
          ? "declining"
          : "stable",
  };
}

/* ============================================================
   Current Activity Streak
============================================================ */

async function getCurrentActivityStreak(objectId) {
  const activeDates = await Score.aggregate([
    {
      $match: {
        user: objectId,
      },
    },

    {
      $project: {
        dateKey: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$completedAt",
            timezone: "UTC",
          },
        },
      },
    },

    {
      $group: {
        _id: "$dateKey",
      },
    },

    {
      $sort: {
        _id: -1,
      },
    },

    {
      $limit: 365,
    },
  ]);

  if (activeDates.length === 0) {
    return 0;
  }

  const today = getStartOfUtcDay(new Date());

  const latestDate = getStartOfUtcDay(activeDates[0]._id);

  const daysSinceLatest = Math.round(
    (today.getTime() - latestDate.getTime()) / DAY_IN_MILLISECONDS,
  );

  if (daysSinceLatest !== 0 && daysSinceLatest !== 1) {
    return 0;
  }

  let currentStreak = 0;

  let expectedDate = latestDate;

  for (const activity of activeDates) {
    if (activity._id !== getDateKey(expectedDate)) {
      break;
    }

    currentStreak += 1;

    expectedDate = addUtcDays(expectedDate, -1);
  }

  return currentStreak;
}

/* ============================================================
   Analytics Controller
============================================================ */

async function getAnalytics(req, res, next) {
  try {
    const userId = getUserId(req);

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required to view analytics.",
      });
    }

    const objectId = new mongoose.Types.ObjectId(String(userId));

    const user = await User.findById(objectId)
      .select(
        [
          "totalXp",
          "quizzesCompleted",
          "correctAnswers",
          "currentStreak",
          "firstName",
          "lastName",
          "avatar",
        ].join(" "),
      )
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found.",
      });
    }

    const [
      summary,
      categoryPerformance,
      recentPerformance,
      monthlyPerformance,
      dailyPerformance,
      performanceComparison,
      currentActivityStreak,
    ] = await Promise.all([
      getSummary(objectId),

      getCategoryPerformance(objectId),

      getRecentPerformance(objectId),

      getMonthlyPerformance(objectId),

      getDailyPerformance(objectId),

      getPerformanceComparison(objectId),

      getCurrentActivityStreak(objectId),
    ]);

    const strongestCategory = categoryPerformance[0] || null;

    const weakestCategory =
      categoryPerformance.length > 1
        ? categoryPerformance[categoryPerformance.length - 1]
        : categoryPerformance[0] || null;

    const answerBreakdownTotal =
      summary.totalCorrectAnswers +
      summary.totalWrongAnswers +
      summary.totalUnansweredQuestions;

    const answerBreakdown = {
      correct: summary.totalCorrectAnswers,

      wrong: summary.totalWrongAnswers,

      unanswered: summary.totalUnansweredQuestions,

      total: answerBreakdownTotal,

      correctPercentage:
        answerBreakdownTotal > 0
          ? roundNumber(
              (summary.totalCorrectAnswers / answerBreakdownTotal) * 100,
            )
          : 0,

      wrongPercentage:
        answerBreakdownTotal > 0
          ? roundNumber(
              (summary.totalWrongAnswers / answerBreakdownTotal) * 100,
            )
          : 0,

      unansweredPercentage:
        answerBreakdownTotal > 0
          ? roundNumber(
              (summary.totalUnansweredQuestions / answerBreakdownTotal) * 100,
            )
          : 0,
    };

    return res.status(200).json({
      success: true,

      generatedAt: new Date().toISOString(),

      userStats: {
        firstName: user.firstName || "",

        lastName: user.lastName || "",

        avatar: user.avatar || "",

        totalXp: normalizeNumber(user.totalXp),

        quizzesCompleted: normalizeNumber(user.quizzesCompleted),

        correctAnswers: normalizeNumber(user.correctAnswers),

        currentStreak: currentActivityStreak,
      },

      summary,

      answerBreakdown,

      strongestCategory,

      weakestCategory,

      categoryPerformance,

      recentPerformance,

      monthlyPerformance,

      dailyPerformance,

      performanceComparison,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getAnalytics,
};
