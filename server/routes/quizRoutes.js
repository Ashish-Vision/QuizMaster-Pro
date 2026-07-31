"use strict";

const express = require("express");

const quizController = require("../controllers/quizController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/categories", protect, quizController.getCategories);

router.get("/start/:category", protect, quizController.startQuiz);

router.post("/submit", protect, quizController.submitQuiz);

router.get("/result/:resultId", protect, quizController.getResult);

module.exports = router;
