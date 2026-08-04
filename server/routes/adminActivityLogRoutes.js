"use strict";

const express = require("express");

const {
  getActivityLogs,
  getActivityLogSummary,
} = require("../controllers/adminActivityLogController");

const { protect } = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/adminMiddleware");

const router = express.Router();

router.use(protect);
router.use(adminOnly);

router.get("/summary", getActivityLogSummary);

router.get("/", getActivityLogs);

module.exports = router;
