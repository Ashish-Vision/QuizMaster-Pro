"use strict";

const express = require("express");

const {
  getUsers,
  getUserById,
  updateUserRole,
  updateUserStatus,
} = require("../controllers/adminUserController");

const { protect } = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/adminMiddleware");

const router = express.Router();

router.use(protect);
router.use(adminOnly);

router.get("/", getUsers);

router.get("/:userId", getUserById);

router.patch("/:userId/role", updateUserRole);

router.patch("/:userId/status", updateUserStatus);

module.exports = router;
