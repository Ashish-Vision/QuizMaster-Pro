"use strict";

const express = require("express");

const {
  getQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  getQuestionMetadata,
} = require("../controllers/adminQuestionController");

const { protect } = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/adminMiddleware");

const router = express.Router();

router.use(protect);
router.use(adminOnly);

router.route("/").get(getQuestions).post(createQuestion);

router.get("/meta/options", getQuestionMetadata);

router
  .route("/:questionId")
  .get(getQuestionById)
  .put(updateQuestion)
  .delete(deleteQuestion);

module.exports = router;
