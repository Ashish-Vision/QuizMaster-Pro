"use strict";

const express = require("express");

const {
  getTodayDailyChallenge,
  getDailyChallengeById,
  startDailyChallenge,
} = require("../controllers/dailyChallengeController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.get("/", getTodayDailyChallenge);

router.get("/:challengeId", getDailyChallengeById);

router.post("/:challengeId/start", startDailyChallenge);

module.exports = router;
