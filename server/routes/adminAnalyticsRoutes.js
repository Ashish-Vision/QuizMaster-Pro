"use strict";

const express = require("express");

const {
  getAdminAnalytics,
} = require("../controllers/adminAnalyticsController");

const { protect } = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/adminMiddleware");

const router = express.Router();

router.use(protect);
router.use(adminOnly);

router.get("/", getAdminAnalytics);

module.exports = router;
