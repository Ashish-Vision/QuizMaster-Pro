"use strict";

const mongoose = require("mongoose");

const Question = require("../models/Question");
const Score = require("../models/Score");
const User = require("../models/User");

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
    const category = decodeURIComponent(req.params.category).trim();

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
      if (!answer || !mongoose.Types.ObjectId.isValid(answer.questionId)) {
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

      const selectedAnswer =
        answer.selectedAnswer === null || answer.selectedAnswer === undefined
          ? null
          : Number(answer.selectedAnswer);

      if (
        selectedAnswer !== null &&
        (!Number.isInteger(selectedAnswer) ||
          selectedAnswer < 0 ||
          selectedAnswer > 3)
      ) {
        return res.status(400).json({
          success: false,
          message: "One or more selected answers are invalid.",
        });
      }

      submittedQuestionIds.push(questionId);

      submittedAnswers.set(questionId, selectedAnswer);
    }

    const questions = await Question.find({
      _id: {
        $in: submittedQuestionIds,
      },
      category: normalizedCategory,
    }).select("_id correctAnswer category question options explanation");

    if (questions.length !== submittedQuestionIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more questions do not belong to this quiz category.",
      });
    }

    let correctAnswers = 0;
    let wrongAnswers = 0;
    let unansweredQuestions = 0;

    const evaluatedAnswers = questions.map((question) => {
      const questionId = String(question._id);

      const selectedAnswer = submittedAnswers.get(questionId);

      const isUnanswered =
        selectedAnswer === null || selectedAnswer === undefined;

      const isCorrect =
        !isUnanswered && selectedAnswer === question.correctAnswer;

      if (isCorrect) {
        correctAnswers += 1;
      } else if (isUnanswered) {
        unansweredQuestions += 1;
      } else {
        wrongAnswers += 1;
      }

      return {
        question: question._id,
        selectedAnswer: selectedAnswer === undefined ? null : selectedAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect,
      };
    });

    const totalQuestions = questions.length;

    const attemptedQuestions = totalQuestions - unansweredQuestions;

    const accuracy = Number(
      ((correctAnswers / totalQuestions) * 100).toFixed(2),
    );

    const xpEarned = correctAnswers * 10;

    const safeDuration = Number.isFinite(Number(quizDurationSeconds))
      ? Math.max(0, Math.floor(Number(quizDurationSeconds)))
      : 600;

    const safeRemainingSeconds = Number.isFinite(Number(remainingSeconds))
      ? Math.max(
          0,
          Math.min(safeDuration, Math.floor(Number(remainingSeconds))),
        )
      : 0;

    const timeTakenSeconds = safeDuration - safeRemainingSeconds;

    const scoreDocument = await Score.create({
      user: req.user._id,
      category: normalizedCategory,
      totalQuestions,
      attemptedQuestions,
      correctAnswers,
      wrongAnswers,
      unansweredQuestions,
      score: correctAnswers,
      accuracy,
      xpEarned,
      timeTakenSeconds,
      answers: evaluatedAnswers,
    });

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        $inc: {
          totalXp: xpEarned,
          quizzesCompleted: 1,
          correctAnswers,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    ).select("firstName totalXp quizzesCompleted correctAnswers currentStreak");

    return res.status(201).json({
      success: true,
      message: "Quiz submitted successfully.",
      result: {
        resultId: scoreDocument._id,
        category: normalizedCategory,
        totalQuestions,
        attemptedQuestions,
        correctAnswers,
        wrongAnswers,
        unansweredQuestions,
        score: correctAnswers,
        accuracy,
        xpEarned,
        timeTakenSeconds,
      },
      userStats: updatedUser
        ? {
            totalXp: updatedUser.totalXp || 0,
            quizzesCompleted: updatedUser.quizzesCompleted || 0,
            correctAnswers: updatedUser.correctAnswers || 0,
            currentStreak: updatedUser.currentStreak || 0,
          }
        : null,
    });
  } catch (error) {
    return next(error);
  }
}

async function getResult(req, res, next) {
  try {
    const { resultId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(resultId)) {
      return res.status(400).json({
        success: false,
        message: "The result ID is invalid.",
      });
    }

    const result = await Score.findOne({
      _id: resultId,
      user: req.user._id,
    }).select("-answers.correctAnswer");

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
