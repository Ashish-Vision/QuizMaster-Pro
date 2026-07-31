"use strict";

const express = require("express");

const {
  getCategories,
  startQuiz,
  submitQuiz,
  getResult,
} = require("../controllers/quizController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/categories", protect, getCategories);

router.get("/start/:category", protect, startQuiz);

router.post("/submit", protect, submitQuiz);

router.get("/result/:resultId", protect, getResult);

module.exports = router;
