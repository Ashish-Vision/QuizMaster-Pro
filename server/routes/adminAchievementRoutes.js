"use strict";

const express = require("express");

const {
  getAdminAchievements,
  getAdminAchievementByCode,
} = require("../controllers/adminAchievementController");

const { protect } = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/adminMiddleware");

const router = express.Router();

router.use(protect);
router.use(adminOnly);

router.get("/", getAdminAchievements);
router.get("/:code", getAdminAchievementByCode);

module.exports = router;
