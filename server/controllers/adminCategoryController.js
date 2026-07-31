"use strict";

const Question = require("../models/Question");
const Score = require("../models/Score");

function normalizeCategory(value) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * GET /api/admin/categories
 *
 * Returns category statistics generated from questions.
 */
async function getCategories(req, res, next) {
  try {
    const categories = await Question.aggregate([
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
    ]);

    const scoreStatistics = await Score.aggregate([
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
    ]);

    const scoreStatisticsMap = new Map(
      scoreStatistics.map((item) => [item._id, item]),
    );

    const normalizedCategories = categories.map((category) => {
      const scoreData = scoreStatisticsMap.get(category._id) || {};

      return {
        name: category._id,
        totalQuestions: category.totalQuestions || 0,
        easyQuestions: category.easyQuestions || 0,
        mediumQuestions: category.mediumQuestions || 0,
        hardQuestions: category.hardQuestions || 0,
        quizAttempts: scoreData.quizAttempts || 0,
        totalXpEarned: scoreData.totalXpEarned || 0,
        averageAccuracy: Number((scoreData.averageAccuracy || 0).toFixed(2)),
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

    return res.status(200).json({
      success: true,
      summary,
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

    const newCategory = normalizeCategory(req.body.name);

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

    if (newCategory.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Category name cannot exceed 100 characters.",
      });
    }

    if (oldCategory.toLowerCase() === newCategory.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message:
          "The new category name must be different from the current name.",
      });
    }

    const categoryExists = await Question.exists({
      category: {
        $regex: `^${escapeRegex(oldCategory)}$`,
        $options: "i",
      },
    });

    if (!categoryExists) {
      return res.status(404).json({
        success: false,
        message: "Category was not found.",
      });
    }

    const duplicateCategory = await Question.exists({
      category: {
        $regex: `^${escapeRegex(newCategory)}$`,
        $options: "i",
      },
    });

    if (duplicateCategory) {
      return res.status(409).json({
        success: false,
        message: "A category with the new name already exists.",
      });
    }

    const questionUpdate = await Question.updateMany(
      {
        category: oldCategory,
      },
      {
        $set: {
          category: newCategory,
        },
      },
    );

    const scoreUpdate = await Score.updateMany(
      {
        category: oldCategory,
      },
      {
        $set: {
          category: newCategory,
        },
      },
    );

    return res.status(200).json({
      success: true,
      message: "Category renamed successfully.",

      category: {
        oldName: oldCategory,
        newName: newCategory,
        updatedQuestions: questionUpdate.modifiedCount,
        updatedScores: scoreUpdate.modifiedCount,
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
 * Deleting the category deletes all its questions.
 */
async function deleteCategory(req, res, next) {
  try {
    const category = normalizeCategory(
      decodeURIComponent(req.params.categoryName || ""),
    );

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Category name is required.",
      });
    }

    const questionCount = await Question.countDocuments({
      category,
    });

    if (questionCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Category was not found.",
      });
    }

    const savedAttemptCount = await Score.countDocuments({
      category,
    });

    if (savedAttemptCount > 0) {
      return res.status(409).json({
        success: false,
        message: "This category has saved quiz attempts and cannot be deleted.",
      });
    }

    const deletionResult = await Question.deleteMany({
      category,
    });

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully.",

      deletedCategory: {
        name: category,
        deletedQuestions: deletionResult.deletedCount,
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
