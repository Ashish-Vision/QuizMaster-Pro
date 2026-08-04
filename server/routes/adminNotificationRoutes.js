"use strict";

const express = require("express");

const {
  getAdminNotifications,
  createAdminNotification,
  deleteAdminNotification,
  deleteNotificationBatch,
} = require("../controllers/adminNotificationController");

const { protect } = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/adminMiddleware");

const router = express.Router();

router.use(protect);
router.use(adminOnly);

router.route("/").get(getAdminNotifications).post(createAdminNotification);

router.delete("/batch/:batchId", deleteNotificationBatch);

router.delete("/:notificationId", deleteAdminNotification);

module.exports = router;
