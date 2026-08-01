"use strict";

const express = require("express");

const {
  getSettings,
  updateProfile,
  changePassword,
} = require("../controllers/settingsController");

const { protect } = require("../middleware/authMiddleware");

const { settingsUpdateLimiter } = require("../middleware/rateLimitMiddleware");

const router = express.Router();

router.use(protect);

router.get("/", getSettings);

router.patch("/profile", settingsUpdateLimiter, updateProfile);

router.patch("/password", settingsUpdateLimiter, changePassword);

module.exports = router;
