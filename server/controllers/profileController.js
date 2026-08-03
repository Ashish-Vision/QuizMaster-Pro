"use strict";

const mongoose = require("mongoose");
const validator = require("validator");

const User = require("../models/User");
const Score = require("../models/Score");
const Achievement = require("../models/Achievement");

const { getLevelInformation } = require("../services/levelService");

const {
  getUserRankInformation,
  calculateProfileCompletion,
} = require("../services/rankService");

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function roundNumber(value, decimalPlaces = 2) {
  return Number(normalizeNumber(value).toFixed(decimalPlaces));
}

function getUserId(req) {
  return req.user?._id || req.user?.id;
}

function getSafeObjectId(value) {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) {
    return null;
  }

  return new mongoose.Types.ObjectId(value);
}

/* ============================================================
   Date Helpers
============================================================ */

function getStartOfUtcDay(date = new Date()) {
  const safeDate = date instanceof Date ? new Date(date) : new Date(date);

  if (Number.isNaN(safeDate.getTime())) {
    throw new Error("A valid date is required.");
  }

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
  const safeDate = getStartOfUtcDay(date);

  safeDate.setUTCDate(safeDate.getUTCDate() + numberOfDays);

  return safeDate;
}

function createDateKey(date) {
  return getStartOfUtcDay(date).toISOString().slice(0, 10);
}

function getDayLabel(date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "UTC",
  }).format(date);
}

function getDayNumber(date) {
  return Math.floor(getStartOfUtcDay(date).getTime() / (24 * 60 * 60 * 1000));
}

/* ============================================================
   Empty Statistics
============================================================ */

function getEmptyStatistics() {
  return {
    totalAttempts: 0,
    highestScore: 0,
    highestAccuracy: 0,
    averageAccuracy: 0,
    averageTimeSeconds: 0,
    totalTimeSeconds: 0,
    totalXpEarned: 0,
    totalQuestions: 0,
    totalQuestionsAnswered: 0,
    totalCorrectAnswers: 0,
    totalWrongAnswers: 0,
    totalUnansweredQuestions: 0,
    perfectScores: 0,
    favoriteCategory: null,
  };
}

/* ============================================================
   Profile Statistics
============================================================ */

async function getProfileStatistics(userId) {
  const objectId = getSafeObjectId(userId);

  if (!objectId) {
    return getEmptyStatistics();
  }

  const [statisticsResult, favoriteCategoryResult] = await Promise.all([
    Score.aggregate([
      {
        $match: {
          user: objectId,
        },
      },
      {
        $group: {
          _id: null,

          totalAttempts: {
            $sum: 1,
          },

          highestScore: {
            $max: {
              $ifNull: ["$score", 0],
            },
          },

          highestAccuracy: {
            $max: {
              $ifNull: ["$accuracy", 0],
            },
          },

          averageAccuracy: {
            $avg: {
              $ifNull: ["$accuracy", 0],
            },
          },

          averageTimeSeconds: {
            $avg: {
              $ifNull: ["$timeTakenSeconds", 0],
            },
          },

          totalTimeSeconds: {
            $sum: {
              $ifNull: ["$timeTakenSeconds", 0],
            },
          },

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

          totalQuestionsAnswered: {
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

    Score.aggregate([
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

          averageAccuracy: {
            $avg: {
              $ifNull: ["$accuracy", 0],
            },
          },

          highestAccuracy: {
            $max: {
              $ifNull: ["$accuracy", 0],
            },
          },

          totalXp: {
            $sum: {
              $ifNull: ["$xpEarned", 0],
            },
          },

          totalTimeSeconds: {
            $sum: {
              $ifNull: ["$timeTakenSeconds", 0],
            },
          },
        },
      },
      {
        $sort: {
          attempts: -1,
          averageAccuracy: -1,
          correctAnswers: -1,
          totalXp: -1,
        },
      },
      {
        $limit: 1,
      },
    ]),
  ]);

  const summary = statisticsResult[0] || {};

  const favoriteCategory = favoriteCategoryResult[0] || null;

  return {
    totalAttempts: normalizeNumber(summary.totalAttempts),

    highestScore: normalizeNumber(summary.highestScore),

    highestAccuracy: roundNumber(summary.highestAccuracy),

    averageAccuracy: roundNumber(summary.averageAccuracy),

    averageTimeSeconds: Math.round(normalizeNumber(summary.averageTimeSeconds)),

    totalTimeSeconds: Math.round(normalizeNumber(summary.totalTimeSeconds)),

    totalXpEarned: normalizeNumber(summary.totalXpEarned),

    totalQuestions: normalizeNumber(summary.totalQuestions),

    totalQuestionsAnswered: normalizeNumber(summary.totalQuestionsAnswered),

    totalCorrectAnswers: normalizeNumber(summary.totalCorrectAnswers),

    totalWrongAnswers: normalizeNumber(summary.totalWrongAnswers),

    totalUnansweredQuestions: normalizeNumber(summary.totalUnansweredQuestions),

    perfectScores: normalizeNumber(summary.perfectScores),

    favoriteCategory: favoriteCategory
      ? {
          name: favoriteCategory._id || "Unknown",

          attempts: normalizeNumber(favoriteCategory.attempts),

          totalQuestions: normalizeNumber(favoriteCategory.totalQuestions),

          attemptedQuestions: normalizeNumber(
            favoriteCategory.attemptedQuestions,
          ),

          correctAnswers: normalizeNumber(favoriteCategory.correctAnswers),

          wrongAnswers: normalizeNumber(favoriteCategory.wrongAnswers),

          averageAccuracy: roundNumber(favoriteCategory.averageAccuracy),

          highestAccuracy: roundNumber(favoriteCategory.highestAccuracy),

          totalXp: normalizeNumber(favoriteCategory.totalXp),

          totalTimeSeconds: Math.round(
            normalizeNumber(favoriteCategory.totalTimeSeconds),
          ),
        }
      : null,
  };
}

/* ============================================================
   Weekly Activity
============================================================ */

async function getWeeklyActivity(userId) {
  const objectId = getSafeObjectId(userId);

  const today = getStartOfUtcDay(new Date());

  const startDate = addUtcDays(today, -6);

  const endDate = addUtcDays(today, 1);

  const emptyDays = Array.from(
    {
      length: 7,
    },
    (_, index) => {
      const date = addUtcDays(startDate, index);

      return {
        dateKey: createDateKey(date),
        date: date.toISOString(),
        dayLabel: getDayLabel(date),
        quizCount: 0,
        xpEarned: 0,
        correctAnswers: 0,
        totalQuestions: 0,
        averageAccuracy: 0,
        isActive: false,
        isToday: createDateKey(date) === createDateKey(today),
      };
    },
  );

  if (!objectId) {
    return {
      currentStreak: 0,
      activeDays: 0,
      quizzesCompleted: 0,
      xpEarned: 0,
      correctAnswers: 0,
      averageAccuracy: 0,
      longestWeeklyStreak: 0,
      startDate: startDate.toISOString(),
      endDate: today.toISOString(),
      days: emptyDays,
    };
  }

  const activityResults = await Score.aggregate([
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

        xpEarned: {
          $ifNull: ["$xpEarned", 0],
        },

        correctAnswers: {
          $ifNull: ["$correctAnswers", 0],
        },

        totalQuestions: {
          $ifNull: ["$totalQuestions", 0],
        },

        accuracy: {
          $ifNull: ["$accuracy", 0],
        },
      },
    },

    {
      $group: {
        _id: "$dateKey",

        quizCount: {
          $sum: 1,
        },

        xpEarned: {
          $sum: "$xpEarned",
        },

        correctAnswers: {
          $sum: "$correctAnswers",
        },

        totalQuestions: {
          $sum: "$totalQuestions",
        },

        averageAccuracy: {
          $avg: "$accuracy",
        },
      },
    },

    {
      $sort: {
        _id: 1,
      },
    },
  ]);

  const activityMap = new Map(
    activityResults.map((activity) => [activity._id, activity]),
  );

  const days = emptyDays.map((day) => {
    const activity = activityMap.get(day.dateKey);

    if (!activity) {
      return day;
    }

    return {
      ...day,

      quizCount: normalizeNumber(activity.quizCount),

      xpEarned: normalizeNumber(activity.xpEarned),

      correctAnswers: normalizeNumber(activity.correctAnswers),

      totalQuestions: normalizeNumber(activity.totalQuestions),

      averageAccuracy: roundNumber(activity.averageAccuracy),

      isActive: normalizeNumber(activity.quizCount) > 0,
    };
  });

  const activeDays = days.filter((day) => day.isActive).length;

  const quizzesCompleted = days.reduce(
    (total, day) => total + day.quizCount,
    0,
  );

  const xpEarned = days.reduce((total, day) => total + day.xpEarned, 0);

  const correctAnswers = days.reduce(
    (total, day) => total + day.correctAnswers,
    0,
  );

  const totalAccuracy = days.reduce(
    (total, day) => total + day.averageAccuracy * day.quizCount,
    0,
  );

  const averageAccuracy =
    quizzesCompleted > 0 ? roundNumber(totalAccuracy / quizzesCompleted) : 0;

  let longestWeeklyStreak = 0;
  let runningWeeklyStreak = 0;

  for (const day of days) {
    if (day.isActive) {
      runningWeeklyStreak += 1;

      longestWeeklyStreak = Math.max(longestWeeklyStreak, runningWeeklyStreak);
    } else {
      runningWeeklyStreak = 0;
    }
  }

  /*
   * The current streak is calculated from the latest
   * quiz activity in the database, not only from the
   * seven displayed calendar days.
   */
  const recentActiveDates = await Score.aggregate([
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

  let currentStreak = 0;

  if (recentActiveDates.length > 0) {
    const latestDate = getStartOfUtcDay(recentActiveDates[0]._id);

    const differenceFromToday = getDayNumber(today) - getDayNumber(latestDate);

    /*
     * A streak remains current when the user played
     * today or yesterday.
     */
    if (differenceFromToday === 0 || differenceFromToday === 1) {
      let expectedDayNumber = getDayNumber(latestDate);

      for (const activityDate of recentActiveDates) {
        const activityDayNumber = getDayNumber(activityDate._id);

        if (activityDayNumber !== expectedDayNumber) {
          break;
        }

        currentStreak += 1;
        expectedDayNumber -= 1;
      }
    }
  }

  return {
    currentStreak,
    activeDays,
    quizzesCompleted,
    xpEarned,
    correctAnswers,
    averageAccuracy,
    longestWeeklyStreak,
    startDate: startDate.toISOString(),
    endDate: today.toISOString(),
    days,
  };
}

/* ============================================================
   Recent Attempts
============================================================ */

async function getRecentAttempts(userId, limit = 5) {
  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 5, 1), 10);

  const attempts = await Score.find({
    user: userId,
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
    .limit(safeLimit)
    .lean();

  return attempts.map((attempt) => ({
    id: attempt._id,

    category: attempt.category || "Unknown",

    score: normalizeNumber(attempt.score),

    totalQuestions: normalizeNumber(attempt.totalQuestions),

    attemptedQuestions: normalizeNumber(attempt.attemptedQuestions),

    correctAnswers: normalizeNumber(attempt.correctAnswers),

    wrongAnswers: normalizeNumber(attempt.wrongAnswers),

    unansweredQuestions: normalizeNumber(attempt.unansweredQuestions),

    accuracy: roundNumber(attempt.accuracy),

    xpEarned: normalizeNumber(attempt.xpEarned),

    timeTakenSeconds: Math.round(normalizeNumber(attempt.timeTakenSeconds)),

    completedAt: attempt.completedAt || attempt.createdAt || null,
  }));
}

/* ============================================================
   Recent Achievements
============================================================ */

async function getRecentAchievements(userId, limit = 4) {
  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 4, 1), 10);

  const achievements = await Achievement.find({
    user: userId,
  })
    .select(
      [
        "code",
        "title",
        "description",
        "icon",
        "category",
        "threshold",
        "unlockedAt",
        "createdAt",
      ].join(" "),
    )
    .sort({
      unlockedAt: -1,
      createdAt: -1,
    })
    .limit(safeLimit)
    .lean();

  return achievements.map((achievement) => ({
    id: achievement._id,

    code: achievement.code,

    title: achievement.title || "Achievement",

    description: achievement.description || "",

    icon: achievement.icon || "🏆",

    category: achievement.category || "quiz",

    threshold: normalizeNumber(achievement.threshold),

    unlockedAt: achievement.unlockedAt || achievement.createdAt || null,
  }));
}

/* ============================================================
   Profile Response
============================================================ */

async function buildProfileResponse(user) {
  const userId = user._id || user.id;

  const [
    statistics,
    recentAttempts,
    recentAchievements,
    achievementCount,
    ranking,
    weeklyActivity,
  ] = await Promise.all([
    getProfileStatistics(userId),

    getRecentAttempts(userId),

    getRecentAchievements(userId),

    Achievement.countDocuments({
      user: userId,
    }),

    getUserRankInformation(user),

    getWeeklyActivity(userId),
  ]);

  const safeUser = user.toSafeObject();

  const levelInformation = getLevelInformation(safeUser.totalXp);

  const baseProfile = {
    ...safeUser,

    level: levelInformation.level,

    rankTitle: levelInformation.rankTitle,

    levelProgress: levelInformation.progressPercentage,

    currentLevelMinimumXp: levelInformation.currentLevelMinimumXp,

    nextLevelMinimumXp: levelInformation.nextLevelMinimumXp,

    nextLevelTitle: levelInformation.nextLevelTitle || null,

    xpEarnedInCurrentLevel: levelInformation.xpEarnedInCurrentLevel,

    xpRequiredForNextLevel: levelInformation.xpRequiredForNextLevel,

    xpRemainingForNextLevel: levelInformation.xpRemainingForNextLevel,

    isMaximumLevel: levelInformation.isMaximumLevel,

    achievementCount: normalizeNumber(achievementCount),

    ranking: {
      rank: ranking.rank,

      totalPlayers: normalizeNumber(ranking.totalPlayers),

      topPercentage: normalizeNumber(ranking.topPercentage),
    },

    statistics,

    weeklyActivity,

    recentAttempts,

    recentAchievements,
  };

  return {
    ...baseProfile,

    profileCompletion: calculateProfileCompletion(baseProfile),
  };
}

/* ============================================================
   Get Profile
============================================================ */

async function getProfile(req, res, next) {
  try {
    const userId = getUserId(req);

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required to view this profile.",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User profile was not found.",
      });
    }

    const profile = await buildProfileResponse(user);

    return res.status(200).json({
      success: true,
      profile,
    });
  } catch (error) {
    return next(error);
  }
}

/* ============================================================
   Update Profile
============================================================ */

async function updateProfile(req, res, next) {
  try {
    const userId = getUserId(req);

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required to update this profile.",
      });
    }

    const firstName = normalizeText(req.body.firstName);

    const lastName = normalizeText(req.body.lastName);

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

    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          firstName,
          lastName,
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      },
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User profile was not found.",
      });
    }

    const profile = await buildProfileResponse(user);

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      profile,
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
