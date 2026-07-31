"use strict";

const Score = require("../models/Score");

async function getQuizHistory(req, res, next) {
  try {
    const userId = req.user?._id || req.user?.id;

    const requestedPage = Number.parseInt(req.query.page, 10);
    const requestedLimit = Number.parseInt(req.query.limit, 10);

    const page =
      Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

    const limit =
      Number.isInteger(requestedLimit) &&
      requestedLimit >= 1 &&
      requestedLimit <= 50
        ? requestedLimit
        : 10;

    const category =
      typeof req.query.category === "string" ? req.query.category.trim() : "";

    const filter = {
      user: userId,
    };

    if (category && category.toLowerCase() !== "all") {
      filter.category = category;
    }

    const skip = (page - 1) * limit;

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

    const totalPages = Math.max(1, Math.ceil(totalAttempts / limit));

    return res.status(200).json({
      success: true,

      history,

      categories,

      pagination: {
        currentPage: page,
        totalPages,
        totalAttempts,
        limit,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getQuizHistory,
};
