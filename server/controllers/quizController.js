"use strict";

const mongoose = require("mongoose");

const Question = require("../models/Question");
const Score = require("../models/Score");
const User = require("../models/User");

const { createQuizNotifications } = require("../services/notificationService");

const {
  getLevelInformation,
  didLevelIncrease,
} = require("../services/levelService");

const {
  checkAndUnlockAchievements,
} = require("../services/achievementService");

const {
  getDailyChallengeDocument,
  completeDailyChallenge,
} = require("../services/dailyChallengeService");

/* ============================================================
   Utility Functions
============================================================ */

function getUserId(req) {
  return req.user?._id || req.user?.id || null;
}

function getDayNumber(date) {
  const parsedDate = new Date(date);

  return Math.floor(
    Date.UTC(
      parsedDate.getUTCFullYear(),
      parsedDate.getUTCMonth(),
      parsedDate.getUTCDate(),
    ) /
      (1000 * 60 * 60 * 24),
  );
}

function calculateNewStreak(user) {
  if (!user.lastQuizDate) {
    return 1;
  }

  const todayDayNumber = getDayNumber(new Date());

  const lastQuizDayNumber = getDayNumber(user.lastQuizDate);

  const differenceInDays = todayDayNumber - lastQuizDayNumber;

  if (differenceInDays === 0) {
    return Math.max(user.currentStreak || 0, 1);
  }

  if (differenceInDays === 1) {
    return (user.currentStreak || 0) + 1;
  }

  return 1;
}

function normalizeObjectIdList(values) {
  return values.map((value) => String(value)).sort();
}

function haveSameQuestionIds(submittedIds, expectedIds) {
  if (submittedIds.length !== expectedIds.length) {
    return false;
  }

  const normalizedSubmitted = normalizeObjectIdList(submittedIds);

  const normalizedExpected = normalizeObjectIdList(expectedIds);

  return normalizedSubmitted.every(
    (value, index) => value === normalizedExpected[index],
  );
}

function getDailyChallengeErrorResponse(reason) {
  switch (reason) {
    case "not_found":
      return {
        statusCode: 404,
        message: "The daily challenge could not be found.",
      };

    case "expired":
      return {
        statusCode: 410,
        message: "The daily challenge has expired.",
      };

    case "already_completed":
      return {
        statusCode: 409,
        message: "You have already completed today's daily challenge.",
      };

    default:
      return {
        statusCode: 409,
        message: "The daily challenge could not be completed.",
      };
  }
}

/* ============================================================
   Categories
============================================================ */

async function getCategories(req, res, next) {
  try {
    const categories = await Question.distinct("category");

    categories.sort((firstCategory, secondCategory) =>
      firstCategory.localeCompare(secondCategory),
    );

    return res.status(200).json({
      success: true,
      categories,
    });
  } catch (error) {
    return next(error);
  }
}

/* ============================================================
   Start Standard Quiz
============================================================ */

async function startQuiz(req, res, next) {
  try {
    const category = decodeURIComponent(req.params.category || "").trim();

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "A quiz category is required.",
      });
    }

    const requestedLimit = Number.parseInt(req.query.limit, 10);

    const limit =
      Number.isInteger(requestedLimit) &&
      requestedLimit >= 1 &&
      requestedLimit <= 20
        ? requestedLimit
        : 10;

    const questions = await Question.aggregate([
      {
        $match: {
          category,
        },
      },

      {
        $sample: {
          size: limit,
        },
      },

      {
        $project: {
          question: 1,
          options: 1,
          category: 1,
          difficulty: 1,
        },
      },
    ]);

    if (questions.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No questions were found for "${category}".`,
      });
    }

    return res.status(200).json({
      success: true,
      category,
      totalQuestions: questions.length,
      questions,
    });
  } catch (error) {
    return next(error);
  }
}

/* ============================================================
   Submit Quiz
============================================================ */

async function submitQuiz(req, res, next) {
  let scoreDocument = null;

  try {
    const userId = getUserId(req);

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required to submit a quiz.",
      });
    }

    const {
      category,
      answers,
      remainingSeconds = 0,
      quizDurationSeconds = 600,
      dailyChallengeId = null,
    } = req.body;

    if (typeof category !== "string" || category.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "A valid quiz category is required.",
      });
    }

    if (
      !Array.isArray(answers) ||
      answers.length === 0 ||
      answers.length > 20
    ) {
      return res.status(400).json({
        success: false,
        message: "The quiz submission must contain between 1 and 20 answers.",
      });
    }

    const normalizedCategory = category.trim();

    const isDailyChallenge = Boolean(dailyChallengeId);

    let dailyChallenge = null;

    if (isDailyChallenge) {
      if (!mongoose.Types.ObjectId.isValid(dailyChallengeId)) {
        return res.status(400).json({
          success: false,
          message: "The daily challenge ID is invalid.",
        });
      }

      dailyChallenge = await getDailyChallengeDocument({
        challengeId: dailyChallengeId,
        populateQuestions: false,
      });

      if (!dailyChallenge) {
        return res.status(404).json({
          success: false,
          message: "The daily challenge was not found.",
        });
      }

      if (!dailyChallenge.isCurrentlyAvailable()) {
        return res.status(410).json({
          success: false,
          message: "The daily challenge has expired.",
        });
      }

      if (dailyChallenge.hasUserCompleted(userId)) {
        return res.status(409).json({
          success: false,
          message: "You have already completed today's daily challenge.",
        });
      }

      if (dailyChallenge.category !== normalizedCategory) {
        return res.status(400).json({
          success: false,
          message: "The submitted category does not match the daily challenge.",
        });
      }
    }

    const submittedQuestionIds = [];

    const submittedAnswers = new Map();

    for (const answer of answers) {
      if (
        !answer ||
        !answer.questionId ||
        !mongoose.Types.ObjectId.isValid(answer.questionId)
      ) {
        return res.status(400).json({
          success: false,
          message: "The submission contains an invalid question ID.",
        });
      }

      const questionId = String(answer.questionId);

      if (submittedAnswers.has(questionId)) {
        return res.status(400).json({
          success: false,
          message: "The same question cannot be submitted more than once.",
        });
      }

      let selectedAnswer = null;

      if (
        answer.selectedAnswer !== null &&
        answer.selectedAnswer !== undefined
      ) {
        selectedAnswer = Number(answer.selectedAnswer);

        if (!Number.isInteger(selectedAnswer) || selectedAnswer < 0) {
          return res.status(400).json({
            success: false,
            message: "One or more selected answers are invalid.",
          });
        }
      }

      submittedQuestionIds.push(questionId);

      submittedAnswers.set(questionId, selectedAnswer);
    }

    if (isDailyChallenge) {
      const challengeQuestionIds = dailyChallenge.questions.map((questionId) =>
        String(questionId?._id || questionId),
      );

      if (!haveSameQuestionIds(submittedQuestionIds, challengeQuestionIds)) {
        return res.status(400).json({
          success: false,
          message:
            "The submitted questions do not match today's daily challenge.",
        });
      }
    }

    const questions = await Question.find({
      _id: {
        $in: submittedQuestionIds,
      },

      category: normalizedCategory,
    }).select(
      [
        "_id",
        "question",
        "options",
        "correctAnswer",
        "explanation",
        "category",
        "difficulty",
      ].join(" "),
    );

    if (questions.length !== submittedQuestionIds.length) {
      return res.status(400).json({
        success: false,
        message:
          "One or more questions do not exist or do not belong to this quiz category.",
      });
    }

    let correctAnswers = 0;
    let wrongAnswers = 0;
    let unansweredQuestions = 0;

    const evaluatedAnswers = [];

    for (const question of questions) {
      const questionId = String(question._id);

      const selectedAnswer = submittedAnswers.get(questionId);

      const isUnanswered =
        selectedAnswer === null || selectedAnswer === undefined;

      if (
        !isUnanswered &&
        (selectedAnswer < 0 || selectedAnswer >= question.options.length)
      ) {
        return res.status(400).json({
          success: false,
          message: `The selected answer for question "${question.question}" is invalid.`,
        });
      }

      const isCorrect =
        !isUnanswered && selectedAnswer === question.correctAnswer;

      if (isCorrect) {
        correctAnswers += 1;
      } else if (isUnanswered) {
        unansweredQuestions += 1;
      } else {
        wrongAnswers += 1;
      }

      evaluatedAnswers.push({
        question: question._id,

        selectedAnswer: isUnanswered ? null : selectedAnswer,

        correctAnswer: question.correctAnswer,

        isCorrect,
      });
    }

    const totalQuestions = questions.length;

    const attemptedQuestions = correctAnswers + wrongAnswers;

    const accuracy = Number(
      ((correctAnswers / totalQuestions) * 100).toFixed(2),
    );

    /*
     * Standard quiz XP:
     * 10 XP for each correct answer.
     * 20 XP performance bonus for 80%+
     */
    const baseXp = correctAnswers * 10;

    const performanceBonus = accuracy >= 80 ? 20 : 0;

    const standardXpEarned = baseXp + performanceBonus;

    /*
     * The daily reward is additional to the
     * standard score-based XP.
     */
    const dailyChallengeBonusXp = isDailyChallenge
      ? Math.max(Number(dailyChallenge.rewardXp) || 0, 0)
      : 0;

    const totalXpEarned = standardXpEarned + dailyChallengeBonusXp;

    const parsedDuration = Number(quizDurationSeconds);

    const safeDuration = Number.isFinite(parsedDuration)
      ? Math.max(0, Math.floor(parsedDuration))
      : 600;

    const parsedRemainingSeconds = Number(remainingSeconds);

    const safeRemainingSeconds = Number.isFinite(parsedRemainingSeconds)
      ? Math.max(0, Math.min(safeDuration, Math.floor(parsedRemainingSeconds)))
      : 0;

    const timeTakenSeconds = safeDuration - safeRemainingSeconds;

    const user = await User.findById(userId).select(
      [
        "totalXp",
        "quizzesCompleted",
        "correctAnswers",
        "currentStreak",
        "lastQuizDate",
      ].join(" "),
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "The authenticated user could not be found.",
      });
    }

    const previousStreak = user.currentStreak || 0;

    const newStreak = calculateNewStreak(user);

    scoreDocument = await Score.create({
      user: userId,
      category: normalizedCategory,
      answers: evaluatedAnswers,
      score: correctAnswers,
      attemptedQuestions,
      correctAnswers,
      wrongAnswers,
      unansweredQuestions,
      totalQuestions,
      accuracy,
      xpEarned: totalXpEarned,
      timeTakenSeconds,
      completedAt: new Date(),
    });

    let dailyChallengeCompletion = null;

    if (isDailyChallenge) {
      dailyChallengeCompletion = await completeDailyChallenge({
        challengeId: dailyChallengeId,

        userId,

        resultId: scoreDocument._id,

        score: correctAnswers,

        totalQuestions,

        accuracy,

        xpAwarded: dailyChallengeBonusXp,
      });

      if (
        !dailyChallengeCompletion.success ||
        dailyChallengeCompletion.alreadyCompleted
      ) {
        await Score.deleteOne({
          _id: scoreDocument._id,
        });

        scoreDocument = null;

        const errorResponse = getDailyChallengeErrorResponse(
          dailyChallengeCompletion.reason,
        );

        return res.status(errorResponse.statusCode).json({
          success: false,
          message: errorResponse.message,
        });
      }
    }

    const previousTotalXp = user.totalXp || 0;

    user.totalXp += totalXpEarned;

    user.quizzesCompleted += 1;

    user.correctAnswers += correctAnswers;

    user.currentStreak = newStreak;

    user.lastQuizDate = new Date();

    await user.save();

    const levelChange = didLevelIncrease(previousTotalXp, user.totalXp);

    const levelInformation = getLevelInformation(user.totalXp);

    let newlyUnlockedAchievements = [];

    try {
      const achievementResult = await checkAndUnlockAchievements(userId);

      newlyUnlockedAchievements = achievementResult.newlyUnlocked.map(
        (achievement) => ({
          id: achievement._id,
          code: achievement.code,
          title: achievement.title,
          description: achievement.description,
          icon: achievement.icon,
          category: achievement.category,
          threshold: achievement.threshold,
          unlockedAt: achievement.unlockedAt,
        }),
      );
    } catch (achievementError) {
      console.error("Achievement check failed:", achievementError);
    }

    try {
      const createdNotifications = await createQuizNotifications({
        userId,

        resultId: scoreDocument._id,

        category: normalizedCategory,

        score: correctAnswers,

        totalQuestions,

        accuracy,

        xpEarned: totalXpEarned,

        currentStreak: user.currentStreak,

        previousStreak,

        achievements: newlyUnlockedAchievements,
      });

      console.log(
        `Created ${createdNotifications.length} notifications for user ${userId}.`,
      );
    } catch (notificationError) {
      console.error("Quiz notification creation failed:", notificationError);
    }

    return res.status(201).json({
      success: true,

      message: isDailyChallenge
        ? "Daily challenge completed successfully."
        : "Quiz submitted successfully.",

      result: {
        resultId: scoreDocument._id,

        category: normalizedCategory,

        score: correctAnswers,

        totalQuestions,

        attemptedQuestions,

        correctAnswers,

        wrongAnswers,

        unansweredQuestions,

        accuracy,

        xpEarned: totalXpEarned,

        standardXpEarned,

        dailyChallengeBonusXp,

        timeTakenSeconds,

        isDailyChallenge,

        dailyChallengeId: isDailyChallenge ? dailyChallengeId : null,
      },

      dailyChallenge: isDailyChallenge
        ? {
            completed: true,

            challengeId: dailyChallengeId,

            rewardXp: dailyChallengeBonusXp,

            rewardBadge: dailyChallenge.rewardBadge,

            completion: dailyChallengeCompletion.completion,
          }
        : null,

      userStats: {
        totalXp: user.totalXp,

        quizzesCompleted: user.quizzesCompleted,

        correctAnswers: user.correctAnswers,

        currentStreak: user.currentStreak,

        level: levelInformation.level,

        rankTitle: levelInformation.rankTitle,

        levelProgress: levelInformation.progressPercentage,

        currentLevelMinimumXp: levelInformation.currentLevelMinimumXp,

        nextLevelMinimumXp: levelInformation.nextLevelMinimumXp,

        xpEarnedInCurrentLevel: levelInformation.xpEarnedInCurrentLevel,

        xpRequiredForNextLevel: levelInformation.xpRequiredForNextLevel,

        xpRemainingForNextLevel: levelInformation.xpRemainingForNextLevel,

        nextLevelTitle: levelInformation.nextLevelTitle,

        isMaximumLevel: levelInformation.isMaximumLevel,

        leveledUp: levelChange.leveledUp,

        previousLevel: levelChange.previousLevel,

        currentLevel: levelChange.currentLevel,

        previousRankTitle: levelChange.previousRankTitle,

        currentRankTitle: levelChange.currentRankTitle,
      },

      newlyUnlockedAchievements,
    });
  } catch (error) {
    /*
     * Remove a provisional score if an unexpected
     * error occurs before the submission finishes.
     */
    if (scoreDocument?._id) {
      try {
        await Score.deleteOne({
          _id: scoreDocument._id,
        });
      } catch (cleanupError) {
        console.error("Quiz score cleanup failed:", cleanupError);
      }
    }

    return next(error);
  }
}

/* ============================================================
   Result
============================================================ */

async function getResult(req, res, next) {
  try {
    const userId = getUserId(req);

    const { resultId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(resultId)) {
      return res.status(400).json({
        success: false,
        message: "The result ID is invalid.",
      });
    }

    const result = await Score.findOne({
      _id: resultId,
      user: userId,
    })
      .populate({
        path: "answers.question",

        select: ["question", "options", "explanation", "difficulty"].join(" "),
      })
      .lean();

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Quiz result not found.",
      });
    }

    return res.status(200).json({
      success: true,
      result,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getCategories,
  startQuiz,
  submitQuiz,
  getResult,
};
