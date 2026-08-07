"use strict";

const { logRequestActivity } = require("../services/activityLogService");
const { createCsv } = require("../utils/csv");
const { normalizeText } = require("../utils/normalize");

const Achievement = require("../models/Achievement");
const Notification = require("../models/Notification");
const Question = require("../models/Question");
const Score = require("../models/Score");
const User = require("../models/User");

const MAX_EXPORT_ROWS = 1000;

function enforceExportRowLimit(records) {
  if (records.length <= MAX_EXPORT_ROWS) {
    return records;
  }

  const error = new Error(
    `This report exceeds the maximum of ${MAX_EXPORT_ROWS} export rows. Narrow the report filters and try again.`,
  );
  error.statusCode = 413;
  throw error;
}

function normalizeDays(value, fallback = 30) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, 365);
}

function getReportStartDate(days) {
  const date = new Date();

  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - (days - 1));

  return date;
}

function sendCsv(res, filename, csvContent) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");

  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  return res.status(200).send(`\uFEFF${csvContent}`);
}

function getSafeUser(user) {
  return {
    id: String(user._id),
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    fullName:
      `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown User",
    email: user.email || "",
    role: user.role || "user",
    totalXp: Number(user.totalXp) || 0,
    quizzesCompleted: Number(user.quizzesCompleted) || 0,
    correctAnswers: Number(user.correctAnswers) || 0,
    currentStreak: Number(user.currentStreak) || 0,
    isActive: Boolean(user.isActive),
    emailVerified: Boolean(user.emailVerified),
    createdAt: user.createdAt || null,
    lastLoginAt: user.lastLoginAt || null,
  };
}

/**
 * GET /api/admin/reports/summary
 */
async function getReportSummary(req, res, next) {
  try {
    const days = normalizeDays(req.query.days);

    const startDate = getReportStartDate(days);

    const [
      totalUsers,
      totalAdmins,
      activeUsers,
      verifiedUsers,
      totalQuestions,
      activeQuestions,
      totalAttempts,
      totalAchievements,
      totalNotifications,
      scoreSummary,
      recentUsers,
      recentAttempts,
    ] = await Promise.all([
      User.countDocuments(),

      User.countDocuments({
        role: "admin",
      }),

      User.countDocuments({
        isActive: {
          $ne: false,
        },
      }),

      User.countDocuments({
        emailVerified: true,
      }),

      Question.countDocuments(),

      Question.countDocuments({
        isActive: {
          $ne: false,
        },
      }),

      Score.countDocuments(),

      Achievement.countDocuments(),

      Notification.countDocuments(),

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

            perfectScores: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$accuracy", 100],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),

      User.countDocuments({
        createdAt: {
          $gte: startDate,
        },
      }),

      Score.countDocuments({
        completedAt: {
          $gte: startDate,
        },
      }),
    ]);

    const scoreStatistics = scoreSummary[0] || {};

    return res.status(200).json({
      success: true,

      generatedAt: new Date().toISOString(),

      period: {
        days,
        startDate,
        endDate: new Date(),
      },

      summary: {
        totalUsers,
        totalRegularUsers: Math.max(totalUsers - totalAdmins, 0),
        totalAdmins,
        activeUsers,
        disabledUsers: Math.max(totalUsers - activeUsers, 0),
        verifiedUsers,
        unverifiedUsers: Math.max(totalUsers - verifiedUsers, 0),

        totalQuestions,
        activeQuestions,
        inactiveQuestions: Math.max(totalQuestions - activeQuestions, 0),

        totalAttempts,
        totalAchievements,
        totalNotifications,

        totalXpEarned: Number(scoreStatistics.totalXpEarned) || 0,

        averageAccuracy: Number(
          (Number(scoreStatistics.averageAccuracy) || 0).toFixed(2),
        ),

        averageTimeTakenSeconds: Math.round(
          Number(scoreStatistics.averageTimeTakenSeconds) || 0,
        ),

        perfectScores: Number(scoreStatistics.perfectScores) || 0,

        recentUsers,
        recentAttempts,
      },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/admin/reports/users
 */
async function exportUsersReport(req, res, next) {
  try {
    const role = normalizeText(req.query.role).toLowerCase();
    const status = normalizeText(req.query.status).toLowerCase();

    const filter = {};

    if (["user", "admin"].includes(role)) {
      filter.role = role;
    }

    if (status === "active") {
      filter.isActive = true;
    }

    if (status === "disabled") {
      filter.isActive = false;
    }

    const users = await User.find(filter)
      .select(
        "firstName lastName email role totalXp quizzesCompleted correctAnswers currentStreak isActive emailVerified createdAt lastLoginAt",
      )
      .sort({
        createdAt: -1,
      })
      .limit(MAX_EXPORT_ROWS + 1)
      .lean();

    enforceExportRowLimit(users);

    const rows = users.map((user) => {
      const safeUser = getSafeUser(user);

      return [
        safeUser.id,
        safeUser.fullName,
        safeUser.email,
        safeUser.role,
        safeUser.totalXp,
        safeUser.quizzesCompleted,
        safeUser.correctAnswers,
        safeUser.currentStreak,
        safeUser.isActive ? "Active" : "Disabled",
        safeUser.emailVerified ? "Verified" : "Unverified",
        safeUser.createdAt ? new Date(safeUser.createdAt).toISOString() : "",
        safeUser.lastLoginAt
          ? new Date(safeUser.lastLoginAt).toISOString()
          : "",
      ];
    });

    const csv = createCsv(
      [
        "User ID",
        "Full Name",
        "Email",
        "Role",
        "Total XP",
        "Quizzes Completed",
        "Correct Answers",
        "Current Streak",
        "Status",
        "Email Verification",
        "Registered At",
        "Last Login",
      ],
      rows,
    );

    await logRequestActivity({
      req,
      action: "EXPORT",
      entityType: "Report",
      entityId: "users",
      description: `Exported users report containing ${
        users.length
      } record${users.length === 1 ? "" : "s"}.`,
      metadata: {
        reportType: "users",
        recordCount: users.length,
        role: role || "all",
        status: status || "all",
      },
    });

    return sendCsv(res, `quizmaster-users-${Date.now()}.csv`, csv);
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/admin/reports/attempts
 */
async function exportAttemptsReport(req, res, next) {
  try {
    const days = normalizeDays(req.query.days, 365);

    const startDate = getReportStartDate(days);

    const attempts = await Score.find({
      completedAt: {
        $gte: startDate,
      },
    })
      .populate({
        path: "user",
        select: "firstName lastName email",
      })
      .select(
        "user category score totalQuestions attemptedQuestions correctAnswers wrongAnswers unansweredQuestions accuracy xpEarned timeTakenSeconds completedAt",
      )
      .sort({
        completedAt: -1,
      })
      .limit(MAX_EXPORT_ROWS + 1)
      .lean();

    enforceExportRowLimit(attempts);

    const rows = attempts.map((attempt) => [
      String(attempt._id),

      attempt.user
        ? `${attempt.user.firstName || ""} ${
            attempt.user.lastName || ""
          }`.trim()
        : "Unknown User",

      attempt.user?.email || "",
      attempt.category || "",
      Number(attempt.score) || 0,
      Number(attempt.totalQuestions) || 0,
      Number(attempt.attemptedQuestions) || 0,
      Number(attempt.correctAnswers) || 0,
      Number(attempt.wrongAnswers) || 0,
      Number(attempt.unansweredQuestions) || 0,
      Number(attempt.accuracy) || 0,
      Number(attempt.xpEarned) || 0,
      Number(attempt.timeTakenSeconds) || 0,

      attempt.completedAt ? new Date(attempt.completedAt).toISOString() : "",
    ]);

    const csv = createCsv(
      [
        "Attempt ID",
        "User",
        "Email",
        "Category",
        "Score",
        "Total Questions",
        "Attempted Questions",
        "Correct Answers",
        "Wrong Answers",
        "Unanswered Questions",
        "Accuracy",
        "XP Earned",
        "Time Taken Seconds",
        "Completed At",
      ],
      rows,
    );

    await logRequestActivity({
      req,
      action: "EXPORT",
      entityType: "Report",
      entityId: "attempts",
      description: `Exported attempts report containing ${
        attempts.length
      } record${attempts.length === 1 ? "" : "s"}.`,
      metadata: {
        reportType: "attempts",
        recordCount: attempts.length,
        days,
        startDate: startDate.toISOString(),
      },
    });

    return sendCsv(res, `quizmaster-attempts-${Date.now()}.csv`, csv);
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/admin/reports/questions
 */
async function exportQuestionsReport(req, res, next) {
  try {
    const category = normalizeText(req.query.category);
    const difficulty = normalizeText(req.query.difficulty);

    const filter = {};

    if (category && category !== "all") {
      filter.category = category;
    }

    if (["Easy", "Medium", "Hard"].includes(difficulty)) {
      filter.difficulty = difficulty;
    }

    const questions = await Question.find(filter)
      .sort({
        category: 1,
        difficulty: 1,
        createdAt: -1,
      })
      .limit(MAX_EXPORT_ROWS + 1)
      .lean();

    enforceExportRowLimit(questions);

    const rows = questions.map((question) => [
      String(question._id),
      question.question || "",
      question.category || "",
      question.difficulty || "",

      Array.isArray(question.options) ? question.options[0] || "" : "",

      Array.isArray(question.options) ? question.options[1] || "" : "",

      Array.isArray(question.options) ? question.options[2] || "" : "",

      Array.isArray(question.options) ? question.options[3] || "" : "",

      Number(question.correctAnswer) || 0,
      question.explanation || "",
      question.isActive === false ? "Inactive" : "Active",

      question.createdAt ? new Date(question.createdAt).toISOString() : "",
    ]);

    const csv = createCsv(
      [
        "Question ID",
        "Question",
        "Category",
        "Difficulty",
        "Option 1",
        "Option 2",
        "Option 3",
        "Option 4",
        "Correct Answer Index",
        "Explanation",
        "Status",
        "Created At",
      ],
      rows,
    );

    await logRequestActivity({
      req,
      action: "EXPORT",
      entityType: "Report",
      entityId: "questions",
      description: `Exported questions report containing ${
        questions.length
      } record${questions.length === 1 ? "" : "s"}.`,
      metadata: {
        reportType: "questions",
        recordCount: questions.length,
        category: category || "all",
        difficulty: difficulty || "all",
      },
    });

    return sendCsv(res, `quizmaster-questions-${Date.now()}.csv`, csv);
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/admin/reports/categories
 */
async function exportCategoriesReport(req, res, next) {
  try {
    const [questionStatistics, scoreStatistics] = await Promise.all([
      Question.aggregate([
        {
          $group: {
            _id: "$category",

            totalQuestions: {
              $sum: 1,
            },

            activeQuestions: {
              $sum: {
                $cond: [
                  {
                    $ne: ["$isActive", false],
                  },
                  1,
                  0,
                ],
              },
            },

            easyQuestions: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$difficulty", "Easy"],
                  },
                  1,
                  0,
                ],
              },
            },

            mediumQuestions: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$difficulty", "Medium"],
                  },
                  1,
                  0,
                ],
              },
            },

            hardQuestions: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$difficulty", "Hard"],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        {
          $limit: MAX_EXPORT_ROWS + 1,
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
          },
        },
        {
          $limit: MAX_EXPORT_ROWS + 1,
        },
      ]),
    ]);

    enforceExportRowLimit(questionStatistics);
    enforceExportRowLimit(scoreStatistics);

    const scoreMap = new Map(
      scoreStatistics.map((item) => [String(item._id), item]),
    );

    const rows = questionStatistics
      .map((category) => {
        const scores = scoreMap.get(String(category._id)) || {};

        return [
          category._id || "Unknown",
          Number(category.totalQuestions) || 0,
          Number(category.activeQuestions) || 0,
          Number(category.easyQuestions) || 0,
          Number(category.mediumQuestions) || 0,
          Number(category.hardQuestions) || 0,
          Number(scores.attempts) || 0,
          Number(scores.totalXpEarned) || 0,
          Number((Number(scores.averageAccuracy) || 0).toFixed(2)),
          Math.round(Number(scores.averageTimeTakenSeconds) || 0),
        ];
      })
      .sort((first, second) =>
        String(first[0]).localeCompare(String(second[0])),
      );

    const csv = createCsv(
      [
        "Category",
        "Total Questions",
        "Active Questions",
        "Easy Questions",
        "Medium Questions",
        "Hard Questions",
        "Quiz Attempts",
        "Total XP Earned",
        "Average Accuracy",
        "Average Time Seconds",
      ],
      rows,
    );

    await logRequestActivity({
      req,
      action: "EXPORT",
      entityType: "Report",
      entityId: "categories",
      description: `Exported categories report containing ${
        rows.length
      } record${rows.length === 1 ? "" : "s"}.`,
      metadata: {
        reportType: "categories",
        recordCount: rows.length,
        questionCategoryCount: questionStatistics.length,
        scoreCategoryCount: scoreStatistics.length,
      },
    });

    return sendCsv(res, `quizmaster-categories-${Date.now()}.csv`, csv);
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/admin/reports/achievements
 */
async function exportAchievementsReport(req, res, next) {
  try {
    const achievements = await Achievement.find()
      .populate({
        path: "user",
        select: "firstName lastName email",
      })
      .sort({
        unlockedAt: -1,
      })
      .limit(MAX_EXPORT_ROWS + 1)
      .lean();

    enforceExportRowLimit(achievements);

    const rows = achievements.map((achievement) => [
      String(achievement._id),
      achievement.code || "",
      achievement.title || "",
      achievement.category || "",
      Number(achievement.threshold) || 0,

      achievement.user
        ? `${achievement.user.firstName || ""} ${
            achievement.user.lastName || ""
          }`.trim()
        : "Unknown User",

      achievement.user?.email || "",

      achievement.unlockedAt
        ? new Date(achievement.unlockedAt).toISOString()
        : "",
    ]);

    const csv = createCsv(
      [
        "Achievement Record ID",
        "Code",
        "Title",
        "Category",
        "Threshold",
        "User",
        "Email",
        "Unlocked At",
      ],
      rows,
    );

    await logRequestActivity({
      req,
      action: "EXPORT",
      entityType: "Report",
      entityId: "achievements",
      description: `Exported achievements report containing ${
        achievements.length
      } record${achievements.length === 1 ? "" : "s"}.`,
      metadata: {
        reportType: "achievements",
        recordCount: achievements.length,
      },
    });

    return sendCsv(res, `quizmaster-achievements-${Date.now()}.csv`, csv);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  MAX_EXPORT_ROWS,
  enforceExportRowLimit,
  getReportSummary,
  exportUsersReport,
  exportAttemptsReport,
  exportQuestionsReport,
  exportCategoriesReport,
  exportAchievementsReport,
};
