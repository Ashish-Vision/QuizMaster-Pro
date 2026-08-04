"use strict";

const express = require("express");

const {
  getReportSummary,
  exportUsersReport,
  exportAttemptsReport,
  exportQuestionsReport,
  exportCategoriesReport,
  exportAchievementsReport,
} = require("../controllers/adminReportController");

const { protect } = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/adminMiddleware");

const router = express.Router();

router.use(protect);
router.use(adminOnly);

router.get("/summary", getReportSummary);
router.get("/users", exportUsersReport);
router.get("/attempts", exportAttemptsReport);
router.get("/questions", exportQuestionsReport);
router.get("/categories", exportCategoriesReport);
router.get("/achievements", exportAchievementsReport);

module.exports = router;
