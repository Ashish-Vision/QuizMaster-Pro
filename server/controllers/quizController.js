"use strict";

const mongoose = require("mongoose");

const Question = require("../models/Question");
const Score = require("../models/Score");
const User = require("../models/User");

const {
  checkAndUnlockAchievements,
} = require("../services/achievementService");

/**
 * Returns a day number without considering hours, minutes or seconds.
 * This helps calculate daily quiz streaks.
 */
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

  /*
   * User already completed a quiz today.
   */
  if (differenceInDays === 0) {
    return Math.max(user.currentStreak || 0, 1);
  }

  /*
   * User completed a quiz yesterday.
   */
  if (differenceInDays === 1) {
    return (user.currentStreak || 0) + 1;
  }

  /*
   * Streak was broken.
   */
  return 1;
}

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

async function submitQuiz(req, res, next) {
  try {
    const userId = req.user?._id || req.user?.id;

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

    const questions = await Question.find({
      _id: {
        $in: submittedQuestionIds,
      },

      category: normalizedCategory,
    }).select(
      "_id question options correctAnswer explanation category difficulty",
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
     * XP rules:
     * 10 XP per correct answer.
     * 20 bonus XP when accuracy is at least 80%.
     */
    const baseXp = correctAnswers * 10;

    const performanceBonus = accuracy >= 80 ? 20 : 0;

    const xpEarned = baseXp + performanceBonus;

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
      "totalXp quizzesCompleted correctAnswers currentStreak lastQuizDate",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "The authenticated user could not be found.",
      });
    }

    const newStreak = calculateNewStreak(user);

    const scoreDocument = await Score.create({
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
      xpEarned,
      timeTakenSeconds,
      completedAt: new Date(),
    });

    user.totalXp += xpEarned;
    user.quizzesCompleted += 1;
    user.correctAnswers += correctAnswers;
    user.currentStreak = newStreak;
    user.lastQuizDate = new Date();

    await user.save();

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
      /*
       * Achievement errors should not make an
       * otherwise successful quiz submission fail.
       */
      console.error("Achievement check failed:", achievementError);
    }

    return res.status(201).json({
      success: true,
      message: "Quiz submitted successfully.",

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
        xpEarned,
        timeTakenSeconds,
      },

      userStats: {
        totalXp: user.totalXp,
        quizzesCompleted: user.quizzesCompleted,
        correctAnswers: user.correctAnswers,
        currentStreak: user.currentStreak,
      },

      newlyUnlockedAchievements,
    });
  } catch (error) {
    return next(error);
  }
}

async function getResult(req, res, next) {
  try {
    const userId = req.user?._id || req.user?.id;

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

        select: "question options explanation difficulty",
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
