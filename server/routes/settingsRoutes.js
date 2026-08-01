"use strict";

const express = require("express");

const {
  getSettings,
  updateProfile,
  changePassword,
} = require("../controllers/settingsController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.get("/", getSettings);

router.patch("/profile", updateProfile);

router.patch("/password", changePassword);

module.exports = router;
