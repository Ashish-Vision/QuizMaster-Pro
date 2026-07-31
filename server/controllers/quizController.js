"use strict";

const Question = require("../models/Question");

exports.getCategories = async (req, res) => {
  const categories = await Question.distinct("category");

  res.json({
    success: true,
    categories,
  });
};

exports.startQuiz = async (req, res) => {
  const category = req.params.category;

  const questions = await Question.aggregate([
    {
      $match: {
        category,
      },
    },
    {
      $sample: {
        size: 10,
      },
    },
  ]);

  res.json({
    success: true,
    questions,
  });
};
