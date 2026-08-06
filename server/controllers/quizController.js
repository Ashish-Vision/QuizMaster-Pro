"use strict";

const mongoose = require("mongoose");

const Question = require("../models/Question");
const Score = require("../models/Score");
const User = require("../models/User");
const QuizSession = require("../models/QuizSession");

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

function getServerMeasuredDurationSeconds(
  quizSession,
  completedAt = new Date(),
) {
  const startedAt = new Date(quizSession.startedAt).getTime();
  const expiresAt = new Date(quizSession.expiresAt).getTime();
  const completedTime = completedAt.getTime();

  if (
    !Number.isFinite(startedAt) ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= startedAt
  ) {
    return 0;
  }

  const elapsedMilliseconds = Math.max(completedTime - startedAt, 0);
  const sessionDurationMilliseconds = expiresAt - startedAt;

  return Math.floor(
    Math.min(elapsedMilliseconds, sessionDurationMilliseconds) / 1000,
  );
}

function sendSessionStateResponse(res, quizSession) {
  if (quizSession.status === "completed") {
    return res.status(409).json({
      success: false,
      replayed: true,
      message: "This quiz was already submitted.",
      existingResultId: quizSession.result || null,
    });
  }

  if (quizSession.status === "processing") {
    return res.status(409).json({
      success: false,
      replayed: false,
      message: "Quiz submission is already being processed.",
    });
  }

  if (quizSession.status === "cancelled") {
    return res.status(409).json({
      success: false,
      replayed: false,
      message: "This quiz session was cancelled.",
    });
  }

  if (quizSession.status === "expired" || quizSession.expiresAt <= new Date()) {
    return res.status(410).json({
      success: false,
      replayed: false,
      message: "This quiz session has expired.",
    });
  }

  return null;
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
    const categories = await Question.distinct("category", {
      isActive: {
        $ne: false,
      },
    });

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

          isActive: {
            $ne: false,
          },
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

    const startedAt = new Date();
    const quizSession = await QuizSession.create({
      user: getUserId(req),
      category,
      questions: questions.map((question) => question._id),
      mode: "standard",
      startedAt,
      expiresAt: new Date(startedAt.getTime() + 30 * 60 * 1000),
    });

    return res.status(200).json({
      success: true,
      quizSessionId: quizSession.sessionId,
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
  let databaseSession = null;
  let requestedSessionId = null;

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
      dailyChallengeId = null,
      mode,
      quizSessionId,
    } = req.body;

    if (typeof quizSessionId !== "string" || !quizSessionId.trim()) {
      return res.status(400).json({
        success: false,
        message: "A valid quiz session ID is required.",
      });
    }

    requestedSessionId = quizSessionId.trim();

    if (
      !Array.isArray(answers) ||
      answers.length === 0 ||
      answers.length > 25
    ) {
      return res.status(400).json({
        success: false,
        message: "The quiz submission must contain between 1 and 25 answers.",
      });
    }

    const quizSession = await QuizSession.findOne({
      sessionId: requestedSessionId,
      user: userId,
    });

    if (!quizSession) {
      return res
        .status(404)
        .json({ success: false, message: "Quiz session not found." });
    }

    const stateResponse = sendSessionStateResponse(res, quizSession);

    if (stateResponse) {
      return stateResponse;
    }

    if (quizSession.status !== "active") {
      return res.status(409).json({
        success: false,
        message: "This quiz session is not available for submission.",
      });
    }

    const normalizedCategory = quizSession.category;
    const isDailyChallenge = quizSession.mode === "daily";
    const authoritativeDailyChallengeId = isDailyChallenge
      ? String(quizSession.dailyChallenge)
      : null;

    if (
      category !== undefined &&
      (typeof category !== "string" || category.trim() !== normalizedCategory)
    ) {
      return res.status(400).json({
        success: false,
        message: "The submission does not match this quiz session.",
      });
    }

    if (mode !== undefined && mode !== quizSession.mode) {
      return res.status(400).json({
        success: false,
        message: "The submission mode does not match this quiz session.",
      });
    }

    if (
      dailyChallengeId !== null &&
      dailyChallengeId !== undefined &&
      dailyChallengeId !== "" &&
      (!isDailyChallenge ||
        String(dailyChallengeId) !== authoritativeDailyChallengeId)
    ) {
      return res.status(400).json({
        success: false,
        message: "The daily challenge does not match this quiz session.",
      });
    }

    let dailyChallenge = null;

    if (isDailyChallenge) {
      if (!mongoose.Types.ObjectId.isValid(authoritativeDailyChallengeId)) {
        return res.status(400).json({
          success: false,
          message: "The daily challenge ID is invalid.",
        });
      }

      dailyChallenge = await getDailyChallengeDocument({
        challengeId: authoritativeDailyChallengeId,
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

    if (
      !haveSameQuestionIds(
        submittedQuestionIds,
        quizSession.questions.map(String),
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "The submitted questions do not match this quiz session.",
      });
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

    /*
     * Activity is enforced when the server creates the immutable session
     * question set. Do not filter by the question's current isActive value
     * here: an administrator may disable a question after this unexpired
     * session was issued, and the exact server-selected set remains
     * authoritative for this one submission.
     */

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

    const completedAt = new Date();
    const timeTakenSeconds = getServerMeasuredDurationSeconds(
      quizSession,
      completedAt,
    );

    databaseSession = await mongoose.startSession();
    databaseSession.startTransaction();

    const claimedSession = await QuizSession.findOneAndUpdate(
      {
        _id: quizSession._id,
        user: userId,
        status: "active",
        expiresAt: { $gt: new Date() },
      },
      { $set: { status: "processing" } },
      { returnDocument: "after", session: databaseSession },
    );

    if (!claimedSession) {
      const conflict = new Error("This quiz session is no longer available.");
      conflict.statusCode = 409;
      throw conflict;
    }

    const user = await User.findById(userId)
      .select(
        [
          "totalXp",
          "quizzesCompleted",
          "correctAnswers",
          "currentStreak",
          "lastQuizDate",
        ].join(" "),
      )
      .session(databaseSession);

    if (!user) {
      const missingUserError = new Error(
        "The authenticated user could not be found.",
      );
      missingUserError.statusCode = 404;
      throw missingUserError;
    }

    const previousStreak = user.currentStreak || 0;

    const newStreak = calculateNewStreak(user);

    const [scoreDocument] = await Score.create(
      [
        {
          user: userId,
          quizSession: claimedSession._id,
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
          completedAt,
        },
      ],
      { session: databaseSession },
    );

    const previousTotalXp = user.totalXp || 0;

    const updatedUser = await User.findOneAndUpdate(
      {
        _id: userId,
        isActive: {
          $ne: false,
        },
      },
      {
        $inc: {
          totalXp: totalXpEarned,
          quizzesCompleted: 1,
          correctAnswers,
        },
        $set: {
          currentStreak: newStreak,
          lastQuizDate: completedAt,
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
        session: databaseSession,
      },
    );

    if (!updatedUser) {
      const unavailableUserError = new Error(
        "The authenticated user is no longer available.",
      );
      unavailableUserError.statusCode = 409;
      throw unavailableUserError;
    }

    let dailyChallengeCompletion = null;

    if (isDailyChallenge) {
      dailyChallengeCompletion = await completeDailyChallenge({
        challengeId: authoritativeDailyChallengeId,

        userId,

        resultId: scoreDocument._id,

        score: correctAnswers,

        totalQuestions,

        accuracy,

        xpAwarded: dailyChallengeBonusXp,
        session: databaseSession,
      });

      if (
        !dailyChallengeCompletion.success ||
        dailyChallengeCompletion.alreadyCompleted
      ) {
        const errorResponse = getDailyChallengeErrorResponse(
          dailyChallengeCompletion.reason,
        );
        const completionError = new Error(errorResponse.message);
        completionError.statusCode = errorResponse.statusCode;
        throw completionError;
      }
    }

    const levelChange = didLevelIncrease(previousTotalXp, updatedUser.totalXp);

    const levelInformation = getLevelInformation(updatedUser.totalXp);

    let newlyUnlockedAchievements = [];

    try {
      const achievementResult = await checkAndUnlockAchievements(userId, {
        session: databaseSession,
      });

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
      throw achievementError;
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

        currentStreak: updatedUser.currentStreak,

        previousStreak,

        achievements: newlyUnlockedAchievements,
        session: databaseSession,
      });

      console.log(
        `Created ${createdNotifications.length} notifications for user ${userId}.`,
      );
    } catch (notificationError) {
      throw notificationError;
    }

    claimedSession.status = "completed";
    claimedSession.completedAt = completedAt;
    claimedSession.result = scoreDocument._id;
    await claimedSession.save({ session: databaseSession });

    await databaseSession.commitTransaction();

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

        dailyChallengeId: authoritativeDailyChallengeId,
      },

      dailyChallenge: isDailyChallenge
        ? {
            completed: true,

            challengeId: authoritativeDailyChallengeId,

            rewardXp: dailyChallengeBonusXp,

            rewardBadge: dailyChallenge.rewardBadge,

            completion: dailyChallengeCompletion.completion,
          }
        : null,

      userStats: {
        totalXp: updatedUser.totalXp,

        quizzesCompleted: updatedUser.quizzesCompleted,

        correctAnswers: updatedUser.correctAnswers,

        currentStreak: updatedUser.currentStreak,

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
    if (databaseSession?.inTransaction()) {
      await databaseSession.abortTransaction();
    }

    if (
      requestedSessionId &&
      (error.statusCode === 409 ||
        error.code === 11000 ||
        error.code === 112 ||
        error.hasErrorLabel?.("TransientTransactionError"))
    ) {
      const latestSession = await QuizSession.findOne({
        sessionId: requestedSessionId,
        user: getUserId(req),
      }).select("status result expiresAt");

      if (latestSession) {
        const conflictResponse = sendSessionStateResponse(res, latestSession);

        if (conflictResponse) {
          return conflictResponse;
        }
      }

      return res.status(409).json({
        success: false,
        replayed: false,
        message:
          "This quiz submission conflicted with another request. You can retry safely.",
      });
    }

    return next(error);
  } finally {
    if (databaseSession) {
      await databaseSession.endSession();
    }
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
