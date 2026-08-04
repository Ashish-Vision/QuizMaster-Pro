"use strict";

const Question = require("../models/Question");
const Score = require("../models/Score");

const MAX_CATEGORY_LENGTH = 100;

function normalizeCategory(value) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createExactCaseInsensitiveRegex(value) {
  return new RegExp(`^${escapeRegex(value)}$`, "i");
}

/**
 * GET /api/admin/categories
 *
 * Returns category statistics generated from questions and score history.
 */
async function getCategories(req, res, next) {
  try {
    const [questionCategories, scoreStatistics] = await Promise.all([
      Question.aggregate([
        {
          $match: {
            category: {
              $type: "string",
              $ne: "",
            },
          },
        },
        {
          $group: {
            _id: "$category",

            totalQuestions: {
              $sum: 1,
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

            createdAt: {
              $min: "$createdAt",
            },

            updatedAt: {
              $max: "$updatedAt",
            },
          },
        },
        {
          $sort: {
            _id: 1,
          },
        },
      ]),

      Score.aggregate([
        {
          $match: {
            category: {
              $type: "string",
              $ne: "",
            },
          },
        },
        {
          $group: {
            _id: "$category",

            quizAttempts: {
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
          },
        },
      ]),
    ]);

    const scoreStatisticsMap = new Map(
      scoreStatistics.map((item) => [String(item._id).toLowerCase(), item]),
    );

    const normalizedCategories = questionCategories.map((category) => {
      const categoryName = normalizeCategory(category._id);

      const scoreData =
        scoreStatisticsMap.get(categoryName.toLowerCase()) || {};

      return {
        name: categoryName,

        totalQuestions: Number(category.totalQuestions) || 0,

        easyQuestions: Number(category.easyQuestions) || 0,

        mediumQuestions: Number(category.mediumQuestions) || 0,

        hardQuestions: Number(category.hardQuestions) || 0,

        quizAttempts: Number(scoreData.quizAttempts) || 0,

        totalXpEarned: Number(scoreData.totalXpEarned) || 0,

        averageAccuracy: Number(
          (Number(scoreData.averageAccuracy) || 0).toFixed(2),
        ),

        createdAt: category.createdAt || null,

        updatedAt: category.updatedAt || null,
      };
    });

    const summary = normalizedCategories.reduce(
      (result, category) => {
        result.totalCategories += 1;
        result.totalQuestions += category.totalQuestions;
        result.totalAttempts += category.quizAttempts;

        return result;
      },
      {
        totalCategories: 0,
        totalQuestions: 0,
        totalAttempts: 0,
      },
    );

    const mostPopularCategory =
      [...normalizedCategories].sort((first, second) => {
        if (second.quizAttempts !== first.quizAttempts) {
          return second.quizAttempts - first.quizAttempts;
        }

        return second.totalQuestions - first.totalQuestions;
      })[0] || null;

    return res.status(200).json({
      success: true,

      summary: {
        ...summary,

        mostPopularCategory:
          mostPopularCategory && mostPopularCategory.quizAttempts > 0
            ? mostPopularCategory.name
            : null,
      },

      categories: normalizedCategories,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * PATCH /api/admin/categories/:categoryName
 *
 * Renames a category across questions and score history.
 */
async function renameCategory(req, res, next) {
  try {
    const oldCategory = normalizeCategory(
      decodeURIComponent(req.params.categoryName || ""),
    );

    const newCategory = normalizeCategory(req.body?.name);

    if (!oldCategory) {
      return res.status(400).json({
        success: false,
        message: "The current category name is required.",
      });
    }

    if (!newCategory) {
      return res.status(400).json({
        success: false,
        message: "The new category name is required.",
      });
    }

    if (newCategory.length > MAX_CATEGORY_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Category name cannot exceed ${MAX_CATEGORY_LENGTH} characters.`,
      });
    }

    const oldCategoryRegex = createExactCaseInsensitiveRegex(oldCategory);
    const newCategoryRegex = createExactCaseInsensitiveRegex(newCategory);

    const existingQuestion = await Question.findOne({
      category: oldCategoryRegex,
    })
      .select("category")
      .lean();

    if (!existingQuestion) {
      return res.status(404).json({
        success: false,
        message: "Category was not found.",
      });
    }

    const storedCategoryName = existingQuestion.category;

    if (storedCategoryName.toLowerCase() === newCategory.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message:
          "The new category name must be different from the current name.",
      });
    }

    const duplicateCategory = await Question.exists({
      category: newCategoryRegex,
    });

    if (duplicateCategory) {
      return res.status(409).json({
        success: false,
        message: "A category with the new name already exists.",
      });
    }

    const [questionUpdate, scoreUpdate] = await Promise.all([
      Question.updateMany(
        {
          category: createExactCaseInsensitiveRegex(storedCategoryName),
        },
        {
          $set: {
            category: newCategory,
          },
        },
      ),

      Score.updateMany(
        {
          category: createExactCaseInsensitiveRegex(storedCategoryName),
        },
        {
          $set: {
            category: newCategory,
          },
        },
      ),
    ]);

    return res.status(200).json({
      success: true,

      message: "Category renamed successfully.",

      category: {
        oldName: storedCategoryName,
        newName: newCategory,
        updatedQuestions: Number(questionUpdate.modifiedCount) || 0,
        updatedScores: Number(scoreUpdate.modifiedCount) || 0,
      },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * DELETE /api/admin/categories/:categoryName
 *
 * A category can only be deleted when it has no saved attempts.
 * Deleting the category removes all questions in that category.
 */
async function deleteCategory(req, res, next) {
  try {
    const requestedCategory = normalizeCategory(
      decodeURIComponent(req.params.categoryName || ""),
    );

    if (!requestedCategory) {
      return res.status(400).json({
        success: false,
        message: "Category name is required.",
      });
    }

    const categoryRegex = createExactCaseInsensitiveRegex(requestedCategory);

    const existingQuestion = await Question.findOne({
      category: categoryRegex,
    })
      .select("category")
      .lean();

    if (!existingQuestion) {
      return res.status(404).json({
        success: false,
        message: "Category was not found.",
      });
    }

    const storedCategoryName = existingQuestion.category;
    const storedCategoryRegex =
      createExactCaseInsensitiveRegex(storedCategoryName);

    const [questionCount, savedAttemptCount] = await Promise.all([
      Question.countDocuments({
        category: storedCategoryRegex,
      }),

      Score.countDocuments({
        category: storedCategoryRegex,
      }),
    ]);

    if (savedAttemptCount > 0) {
      return res.status(409).json({
        success: false,
        message: "This category has saved quiz attempts and cannot be deleted.",
      });
    }

    const deletionResult = await Question.deleteMany({
      category: storedCategoryRegex,
    });

    return res.status(200).json({
      success: true,

      message: "Category deleted successfully.",

      deletedCategory: {
        name: storedCategoryName,
        deletedQuestions: Number(deletionResult.deletedCount) || questionCount,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getCategories,
  renameCategory,
  deleteCategory,
};
