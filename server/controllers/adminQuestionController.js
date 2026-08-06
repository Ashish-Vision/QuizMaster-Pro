"use strict";

const mongoose = require("mongoose");

const Question = require("../models/Question");
const Score = require("../models/Score");

const ALLOWED_DIFFICULTIES = ["Easy", "Medium", "Hard"];

const ALLOWED_SORT_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "question",
  "category",
  "difficulty",
]);

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeOptions(options) {
  if (!Array.isArray(options)) {
    return [];
  }

  return options.map((option) => normalizeText(option));
}

function validateQuestionPayload(payload) {
  const question = normalizeText(payload.question);

  const category = normalizeText(payload.category);

  const difficulty = normalizeText(payload.difficulty);

  const explanation = normalizeText(payload.explanation);

  const options = normalizeOptions(payload.options);

  const correctAnswer = Number(payload.correctAnswer);

  const errors = [];

  if (question.length < 5) {
    errors.push("Question text must contain at least 5 characters.");
  }

  if (question.length > 1000) {
    errors.push("Question text cannot exceed 1000 characters.");
  }

  if (options.length !== 4) {
    errors.push("Exactly four answer options are required.");
  }

  if (options.length === 4 && options.some((option) => !option)) {
    errors.push("All four answer options must contain text.");
  }

  if (options.some((option) => option.length > 500)) {
    errors.push("Each answer option must be 500 characters or fewer.");
  }

  const normalizedOptionSet = new Set(
    options.map((option) => option.toLowerCase()),
  );

  if (options.length === 4 && normalizedOptionSet.size !== 4) {
    errors.push("All answer options must be unique.");
  }

  if (
    !Number.isInteger(correctAnswer) ||
    correctAnswer < 0 ||
    correctAnswer > 3
  ) {
    errors.push("Correct answer must be an option index between 0 and 3.");
  }

  if (!category) {
    errors.push("Question category is required.");
  }

  if (category.length > 100) {
    errors.push("Category cannot exceed 100 characters.");
  }

  if (!ALLOWED_DIFFICULTIES.includes(difficulty)) {
    errors.push("Difficulty must be Easy, Medium or Hard.");
  }

  if (explanation.length > 2000) {
    errors.push("Explanation cannot exceed 2000 characters.");
  }

  return {
    isValid: errors.length === 0,
    errors,

    value: {
      question,
      options,
      correctAnswer,
      category,
      difficulty,
      explanation,
    },
  };
}

/**
 * GET /api/admin/questions
 *
 * Supported query parameters:
 * page, limit, search, category, difficulty,
 * sortBy and sortOrder.
 */
async function getQuestions(req, res, next) {
  try {
    const requestedPage = Number.parseInt(req.query.page, 10);

    const requestedLimit = Number.parseInt(req.query.limit, 10);

    const page =
      Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

    const limit =
      Number.isInteger(requestedLimit) &&
      requestedLimit >= 1 &&
      requestedLimit <= 100
        ? requestedLimit
        : 10;

    const search = normalizeText(req.query.search);

    const category = normalizeText(req.query.category);

    const difficulty = normalizeText(req.query.difficulty);

    const requestedSortBy = normalizeText(req.query.sortBy);

    if (requestedSortBy && !ALLOWED_SORT_FIELDS.has(requestedSortBy)) {
      return res.status(400).json({
        success: false,
        message: "Question sort field is invalid.",
      });
    }

    if (req.query.sortOrder && !["asc", "desc"].includes(req.query.sortOrder)) {
      return res.status(400).json({
        success: false,
        message: "Question sort order must be asc or desc.",
      });
    }

    const sortBy = ALLOWED_SORT_FIELDS.has(requestedSortBy)
      ? requestedSortBy
      : "createdAt";

    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    const filter = {};

    if (search) {
      const safeSearch = escapeRegex(search);

      filter.$or = [
        {
          question: {
            $regex: safeSearch,
            $options: "i",
          },
        },
        {
          category: {
            $regex: safeSearch,
            $options: "i",
          },
        },
        {
          explanation: {
            $regex: safeSearch,
            $options: "i",
          },
        },
      ];
    }

    if (category && category.toLowerCase() !== "all") {
      filter.category = category;
    }

    if (difficulty && difficulty.toLowerCase() !== "all") {
      if (!ALLOWED_DIFFICULTIES.includes(difficulty)) {
        return res.status(400).json({
          success: false,
          message: "Difficulty filter is invalid.",
        });
      }

      filter.difficulty = difficulty;
    }

    const skip = (page - 1) * limit;

    const [questions, totalQuestions, categories, difficultyStatistics] =
      await Promise.all([
        Question.find(filter)
          .sort({
            [sortBy]: sortOrder,
            _id: -1,
          })
          .skip(skip)
          .limit(limit)
          .lean(),

        Question.countDocuments(filter),

        Question.distinct("category"),

        Question.aggregate([
          {
            $group: {
              _id: "$difficulty",
              count: {
                $sum: 1,
              },
            },
          },
        ]),
      ]);

    categories.sort((firstCategory, secondCategory) =>
      firstCategory.localeCompare(secondCategory),
    );

    const totalPages = Math.max(1, Math.ceil(totalQuestions / limit));

    return res.status(200).json({
      success: true,

      questions,

      filters: {
        search,
        category: category || "all",
        difficulty: difficulty || "all",
        sortBy,
        sortOrder: sortOrder === 1 ? "asc" : "desc",
      },

      categories,

      difficultyStatistics: difficultyStatistics.reduce(
        (statistics, item) => {
          statistics[item._id || "Unknown"] = item.count;

          return statistics;
        },
        {
          Easy: 0,
          Medium: 0,
          Hard: 0,
        },
      ),

      pagination: {
        currentPage: page,
        totalPages,
        totalQuestions,
        limit,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
      },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/admin/questions/:questionId
 */
async function getQuestionById(req, res, next) {
  try {
    const { questionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(questionId)) {
      return res.status(400).json({
        success: false,
        message: "The question ID is invalid.",
      });
    }

    const question = await Question.findById(questionId).lean();

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question was not found.",
      });
    }

    return res.status(200).json({
      success: true,
      question,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/admin/questions
 */
async function createQuestion(req, res, next) {
  try {
    const validation = validateQuestionPayload(req.body);

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.errors[0],
        errors: validation.errors,
      });
    }

    const duplicateQuestion = await Question.findOne({
      question: {
        $regex: `^${escapeRegex(validation.value.question)}$`,
        $options: "i",
      },
      category: validation.value.category,
    }).lean();

    if (duplicateQuestion) {
      return res.status(409).json({
        success: false,
        message:
          "A question with the same text already exists in this category.",
      });
    }

    const question = await Question.create(validation.value);

    return res.status(201).json({
      success: true,
      message: "Question created successfully.",
      question,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map(
        (validationError) => validationError.message,
      );

      return res.status(400).json({
        success: false,
        message: errors[0] || "Question validation failed.",
        errors,
      });
    }

    return next(error);
  }
}

/**
 * PUT /api/admin/questions/:questionId
 */
async function updateQuestion(req, res, next) {
  try {
    const { questionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(questionId)) {
      return res.status(400).json({
        success: false,
        message: "The question ID is invalid.",
      });
    }

    const validation = validateQuestionPayload(req.body);

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.errors[0],
        errors: validation.errors,
      });
    }

    const existingQuestion = await Question.findById(questionId);

    if (!existingQuestion) {
      return res.status(404).json({
        success: false,
        message: "Question was not found.",
      });
    }

    const duplicateQuestion = await Question.findOne({
      _id: {
        $ne: questionId,
      },
      question: {
        $regex: `^${escapeRegex(validation.value.question)}$`,
        $options: "i",
      },
      category: validation.value.category,
    }).lean();

    if (duplicateQuestion) {
      return res.status(409).json({
        success: false,
        message:
          "Another question with the same text already exists in this category.",
      });
    }

    Object.assign(existingQuestion, validation.value);

    await existingQuestion.save();

    return res.status(200).json({
      success: true,
      message: "Question updated successfully.",
      question: existingQuestion,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map(
        (validationError) => validationError.message,
      );

      return res.status(400).json({
        success: false,
        message: errors[0] || "Question validation failed.",
        errors,
      });
    }

    return next(error);
  }
}

/**
 * DELETE /api/admin/questions/:questionId
 *
 * Questions already used in quiz attempts are
 * protected because deleting them would damage
 * old result-review pages.
 */
async function deleteQuestion(req, res, next) {
  try {
    const { questionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(questionId)) {
      return res.status(400).json({
        success: false,
        message: "The question ID is invalid.",
      });
    }

    const question = await Question.findById(questionId);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question was not found.",
      });
    }

    const isUsedInScore = await Score.exists({
      "answers.question": questionId,
    });

    if (isUsedInScore) {
      return res.status(409).json({
        success: false,
        message:
          "This question is used in saved quiz results and cannot be deleted.",
      });
    }

    await question.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Question deleted successfully.",
      deletedQuestion: {
        id: question._id,
        question: question.question,
        category: question.category,
      },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/admin/questions/meta/options
 */
async function getQuestionMetadata(req, res, next) {
  try {
    const categories = await Question.distinct("category");

    categories.sort((firstCategory, secondCategory) =>
      firstCategory.localeCompare(secondCategory),
    );

    return res.status(200).json({
      success: true,
      categories,
      difficulties: ALLOWED_DIFFICULTIES,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  getQuestionMetadata,
};
