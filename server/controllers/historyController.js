"use strict";

const Score = require("../models/Score");
const { normalizeText } = require("../utils/normalize");
const {
  createPaginationMeta,
  parsePagination,
} = require("../utils/pagination");

async function getQuizHistory(req, res, next) {
  try {
    const userId = req.user?._id || req.user?.id;

    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 10,
      maxLimit: 50,
      clampLimit: false,
    });
    const category = normalizeText(req.query.category);

    const filter = {
      user: userId,
    };

    if (category && category.toLowerCase() !== "all") {
      filter.category = category;
    }

    const [history, totalAttempts, categories] = await Promise.all([
      Score.find(filter)
        .select(
          [
            "category",
            "score",
            "attemptedQuestions",
            "correctAnswers",
            "wrongAnswers",
            "unansweredQuestions",
            "totalQuestions",
            "accuracy",
            "xpEarned",
            "timeTakenSeconds",
            "completedAt",
          ].join(" "),
        )
        .sort({
          completedAt: -1,
          _id: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      Score.countDocuments(filter),

      Score.distinct("category", {
        user: userId,
      }),
    ]);

    categories.sort((firstCategory, secondCategory) =>
      firstCategory.localeCompare(secondCategory),
    );

    const pagination = createPaginationMeta({
      page,
      limit,
      totalItems: totalAttempts,
    });

    return res.status(200).json({
      success: true,

      history,

      categories,

      pagination: {
        ...pagination,
        totalAttempts,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getQuizHistory,
};
