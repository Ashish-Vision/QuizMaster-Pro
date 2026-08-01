"use strict";

const mongoose = require("mongoose");

const {
  getDailyChallengeForUser,
  getDailyChallengeDocument,
  serializeDailyChallenge,
} = require("../services/dailyChallengeService");

function getUserId(req) {
  return req.user?._id || req.user?.id || null;
}

function isValidObjectId(value) {
  return Boolean(value && mongoose.Types.ObjectId.isValid(value));
}

async function getTodayDailyChallenge(req, res, next) {
  try {
    const userId = getUserId(req);

    if (!isValidObjectId(userId)) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required to view the daily challenge.",
      });
    }

    const challenge = await getDailyChallengeForUser({
      userId,
    });

    if (!challenge) {
      return res.status(404).json({
        success: false,
        message: "Today's daily challenge is not available.",
      });
    }

    if (!challenge.isAvailable) {
      return res.status(410).json({
        success: false,
        message: "Today's daily challenge has expired.",
        challenge,
      });
    }

    return res.status(200).json({
      success: true,

      message: challenge.completed
        ? "You have already completed today's daily challenge."
        : "Today's daily challenge loaded successfully.",

      challenge,
    });
  } catch (error) {
    if (error.message?.includes("No category and difficulty combination")) {
      return res.status(503).json({
        success: false,
        message:
          "The daily challenge cannot be generated because there are not enough questions available.",
      });
    }

    return next(error);
  }
}

async function getDailyChallengeById(req, res, next) {
  try {
    const userId = getUserId(req);
    const { challengeId } = req.params;

    if (!isValidObjectId(userId)) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required to view this daily challenge.",
      });
    }

    if (!isValidObjectId(challengeId)) {
      return res.status(400).json({
        success: false,
        message: "The daily challenge ID is invalid.",
      });
    }

    const challengeDocument = await getDailyChallengeDocument({
      challengeId,
      populateQuestions: true,
    });

    if (!challengeDocument) {
      return res.status(404).json({
        success: false,
        message: "Daily challenge not found.",
      });
    }

    const challenge = serializeDailyChallenge(challengeDocument, userId);

    return res.status(200).json({
      success: true,
      challenge,
    });
  } catch (error) {
    return next(error);
  }
}

async function startDailyChallenge(req, res, next) {
  try {
    const userId = getUserId(req);
    const { challengeId } = req.params;

    if (!isValidObjectId(userId)) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required to start the daily challenge.",
      });
    }

    if (!isValidObjectId(challengeId)) {
      return res.status(400).json({
        success: false,
        message: "The daily challenge ID is invalid.",
      });
    }

    const challengeDocument = await getDailyChallengeDocument({
      challengeId,
      populateQuestions: true,
    });

    if (!challengeDocument) {
      return res.status(404).json({
        success: false,
        message: "Daily challenge not found.",
      });
    }

    const challenge = serializeDailyChallenge(challengeDocument, userId);

    if (!challenge.isActive) {
      return res.status(410).json({
        success: false,
        message: "This daily challenge is no longer active.",
      });
    }

    if (!challenge.isAvailable) {
      return res.status(410).json({
        success: false,
        message: "This daily challenge has expired.",
      });
    }

    if (challenge.completed) {
      return res.status(409).json({
        success: false,
        message: "You have already completed today's daily challenge.",
        challenge,
      });
    }

    return res.status(200).json({
      success: true,

      message: "Daily challenge started successfully.",

      challenge: {
        id: challenge.id,
        dateKey: challenge.dateKey,
        title: challenge.title,
        description: challenge.description,
        category: challenge.category,
        difficulty: challenge.difficulty,
        questionCount: challenge.questionCount,
        rewardXp: challenge.rewardXp,
        rewardBadge: challenge.rewardBadge,
        startsAt: challenge.startsAt,
        expiresAt: challenge.expiresAt,
        millisecondsRemaining: challenge.millisecondsRemaining,
        questions: challenge.questions,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getTodayDailyChallenge,
  getDailyChallengeById,
  startDailyChallenge,
};
