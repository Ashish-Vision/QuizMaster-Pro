"use strict";

const express = require("express");

const router = express.Router();

const quizController = require("../controllers/quizController");

const { protect } = require("../middleware/authMiddleware");

router.get("/categories", protect, quizController.getCategories);

router.get("/start/:category", protect, quizController.startQuiz);

module.exports = router;
