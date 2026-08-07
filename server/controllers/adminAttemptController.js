"use strict";

const mongoose = require("mongoose");

const Score = require("../models/Score");
const User = require("../models/User");
const { escapeRegex } = require("../utils/mongoSearch");
const { normalizeText } = require("../utils/normalize");
const {
  createPaginationMeta,
  parsePagination,
} = require("../utils/pagination");

const ALLOWED_SORTS = {
  newest: {
    completedAt: -1,
    createdAt: -1,
  },

  oldest: {
    completedAt: 1,
    createdAt: 1,
  },

  accuracy: {
    accuracy: -1,
    completedAt: -1,
  },

  score: {
    score: -1,
    completedAt: -1,
  },

  xp: {
    xpEarned: -1,
    completedAt: -1,
  },

  time: {
    timeTakenSeconds: 1,
    completedAt: -1,
  },
};

function normalizeAttempt(attempt) {
  return {
    id: attempt._id,

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
    score: attempt.score || 0,
    totalQuestions: attempt.totalQuestions || 0,
    attemptedQuestions: attempt.attemptedQuestions || 0,
    correctAnswers: attempt.correctAnswers || 0,
    wrongAnswers: attempt.wrongAnswers || 0,
    unansweredQuestions: attempt.unansweredQuestions || 0,
    accuracy: attempt.accuracy || 0,
    xpEarned: attempt.xpEarned || 0,
    timeTakenSeconds: attempt.timeTakenSeconds || 0,
    completedAt: attempt.completedAt || attempt.createdAt,
    createdAt: attempt.createdAt,
  };
}

/**
 * Recalculates the stored statistics on the User document
 * from the remaining Score documents.
 */
async function recalculateUserStatistics(userId) {
  const [statistics] = await Score.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(String(userId)),
      },
    },

    {
      $group: {
        _id: null,

        totalXp: {
          $sum: {
            $ifNull: ["$xpEarned", 0],
          },
        },

        quizzesCompleted: {
          $sum: 1,
        },

        correctAnswers: {
          $sum: {
            $ifNull: ["$correctAnswers", 0],
          },
        },

        latestQuizDate: {
          $max: {
            $ifNull: ["$completedAt", "$createdAt"],
          },
        },
      },
    },
  ]);

  await User.findByIdAndUpdate(
    userId,
    {
      $set: {
        totalXp: statistics?.totalXp || 0,
        quizzesCompleted: statistics?.quizzesCompleted || 0,
        correctAnswers: statistics?.correctAnswers || 0,
        lastQuizDate: statistics?.latestQuizDate || null,

        /*
         * A reliable historical streak cannot be reconstructed
         * from only summary values, so it is reset after an
         * administrator deletes an attempt.
         */
        currentStreak: statistics?.quizzesCompleted ? 1 : 0,
      },
    },
    {
      runValidators: true,
    },
  );
}

/**
 * GET /api/admin/attempts
 */
async function getAttempts(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 10,
      maxLimit: 100,
    });

    const search = normalizeText(req.query.search);
    const category = normalizeText(req.query.category);
    const userId = normalizeText(req.query.userId);
    const sort = normalizeText(req.query.sort) || "newest";

    const scoreFilter = {};

    if (category && category !== "all") {
      scoreFilter.category = category;
    }

    if (userId && userId !== "all") {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
          success: false,
          message: "The selected user filter is invalid.",
        });
      }

      scoreFilter.user = new mongoose.Types.ObjectId(userId);
    }

    if (search) {
      const safeSearch = escapeRegex(search);

      const matchingUsers = await User.find({
        $or: [
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
        ],
      })
        .select("_id")
        .lean();

      const matchingUserIds = matchingUsers.map((user) => user._id);

      scoreFilter.$or = [
        {
          category: {
            $regex: safeSearch,
            $options: "i",
          },
        },

        {
          user: {
            $in: matchingUserIds,
          },
        },
      ];
    }

    const selectedSort = ALLOWED_SORTS[sort] || ALLOWED_SORTS.newest;
    const [
      attempts,
      filteredAttemptCount,
      totalAttemptCount,
      categories,
      users,
      summaryResult,
    ] = await Promise.all([
      Score.find(scoreFilter)
        .populate({
          path: "user",
          select: "firstName lastName email avatar",
        })
        .select(
          "user category score totalQuestions attemptedQuestions correctAnswers wrongAnswers unansweredQuestions accuracy xpEarned timeTakenSeconds completedAt createdAt",
        )
        .sort({
          ...selectedSort,
          _id: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      Score.countDocuments(scoreFilter),

      Score.countDocuments(),

      Score.distinct("category"),

      User.find({})
        .select("firstName lastName email")
        .sort({
          firstName: 1,
          lastName: 1,
        })
        .lean(),

      Score.aggregate([
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
    ]);

    categories.sort((firstCategory, secondCategory) =>
      firstCategory.localeCompare(secondCategory),
    );

    const summary = summaryResult[0] || {};

    const pagination = createPaginationMeta({
      page,
      limit,
      totalItems: filteredAttemptCount,
    });

    return res.status(200).json({
      success: true,

      summary: {
        totalAttempts: totalAttemptCount,
        totalXpEarned: summary.totalXpEarned || 0,
        averageAccuracy: Number((summary.averageAccuracy || 0).toFixed(2)),
        perfectScores: summary.perfectScores || 0,
      },

      attempts: attempts.map(normalizeAttempt),

      categories,

      users: users.map((user) => ({
        id: user._id,
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        fullName:
          `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
          "Unknown User",
        email: user.email || "",
      })),

      filters: {
        search,
        category: category || "all",
        userId: userId || "all",
        sort,
      },

      pagination: {
        ...pagination,
        totalAttempts: filteredAttemptCount,
      },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/admin/attempts/:attemptId
 */
async function getAttemptById(req, res, next) {
  try {
    const { attemptId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(attemptId)) {
      return res.status(400).json({
        success: false,
        message: "The attempt ID is invalid.",
      });
    }

    const attempt = await Score.findById(attemptId)
      .populate({
        path: "user",
        select: "firstName lastName email role avatar",
      })
      .populate({
        path: "answers.question",
        select: "question options explanation category difficulty",
      })
      .lean();

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Quiz attempt was not found.",
      });
    }

    const answers = Array.isArray(attempt.answers)
      ? attempt.answers.map((answer, index) => {
          const question = answer.question;

          const selectedAnswerText =
            question &&
            answer.selectedAnswer !== null &&
            answer.selectedAnswer !== undefined
              ? question.options?.[answer.selectedAnswer] || null
              : null;

          const correctAnswerText = question
            ? question.options?.[answer.correctAnswer] || null
            : null;

          return {
            number: index + 1,

            questionId: question?._id || null,
            question: question?.question || "Question no longer exists.",
            options: question?.options || [],
            difficulty: question?.difficulty || "Unknown",
            explanation: question?.explanation || "",

            selectedAnswer: answer.selectedAnswer,
            selectedAnswerText,

            correctAnswer: answer.correctAnswer,
            correctAnswerText,

            isCorrect: Boolean(answer.isCorrect),
            isUnanswered:
              answer.selectedAnswer === null ||
              answer.selectedAnswer === undefined,
          };
        })
      : [];

    return res.status(200).json({
      success: true,

      attempt: {
        ...normalizeAttempt(attempt),

        user: attempt.user
          ? {
              id: attempt.user._id,
              firstName: attempt.user.firstName || "",
              lastName: attempt.user.lastName || "",
              fullName:
                `${attempt.user.firstName || ""} ${
                  attempt.user.lastName || ""
                }`.trim() || "Unknown User",
              email: attempt.user.email || "",
              role: attempt.user.role || "user",
              avatar: attempt.user.avatar || "",
            }
          : null,

        answers,
      },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * DELETE /api/admin/attempts/:attemptId
 */
async function deleteAttempt(req, res, next) {
  try {
    const { attemptId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(attemptId)) {
      return res.status(400).json({
        success: false,
        message: "The attempt ID is invalid.",
      });
    }

    const attempt = await Score.findById(attemptId);

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Quiz attempt was not found.",
      });
    }

    const affectedUserId = attempt.user;

    await attempt.deleteOne();

    if (affectedUserId) {
      await recalculateUserStatistics(affectedUserId);
    }

    return res.status(200).json({
      success: true,
      message: "Quiz attempt deleted successfully.",

      deletedAttempt: {
        id: attempt._id,
        userId: affectedUserId,
        category: attempt.category,
        score: attempt.score,
        totalQuestions: attempt.totalQuestions,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getAttempts,
  getAttemptById,
  deleteAttempt,
};
