"use strict";

const express = require("express");

const {
  getAdminSettings,
  updateAdminSettings,
  resetAdminSettings,
} = require("../controllers/adminSettingsController");

const { protect } = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/adminMiddleware");

const router = express.Router();

router.use(protect);
router.use(adminOnly);

/**
 * GET /api/admin/settings
 *
 * Returns all platform settings.
 */
router.get("/", getAdminSettings);

/**
 * PATCH /api/admin/settings
 *
 * Updates one or more platform settings.
 *
 * Expected body:
 * {
 *   "settings": {
 *     "platform_name": "QuizMaster Pro",
 *     "registration_enabled": true
 *   }
 * }
 */
router.patch("/", updateAdminSettings);

/**
 * POST /api/admin/settings/reset
 *
 * Restores every platform setting to its default value.
 */
router.post("/reset", resetAdminSettings);

module.exports = router;
