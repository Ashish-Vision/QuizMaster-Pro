"use strict";

const express = require("express");

const {
  getAttempts,
  getAttemptById,
  deleteAttempt,
} = require("../controllers/adminAttemptController");

const { protect } = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/adminMiddleware");

const router = express.Router();

router.use(protect);
router.use(adminOnly);

router.get("/", getAttempts);

router.route("/:attemptId").get(getAttemptById).delete(deleteAttempt);

module.exports = router;
