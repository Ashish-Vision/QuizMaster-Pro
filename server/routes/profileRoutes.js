"use strict";

const express = require("express");

const {
  getProfile,
  updateProfile,
} = require("../controllers/profileController");

const {
  uploadProfileAvatar,
  deleteProfileAvatar,
} = require("../controllers/profileAvatarController");

const { protect } = require("../middleware/authMiddleware");

const { handleAvatarUpload } = require("../middleware/uploadMiddleware");

const router = express.Router();

/* ============================================================
   Profile Information
============================================================ */

router.get("/", protect, getProfile);

router.put("/", protect, updateProfile);

/* ============================================================
   Profile Avatar
============================================================ */

router.post("/avatar", protect, handleAvatarUpload, uploadProfileAvatar);

router.delete("/avatar", protect, deleteProfileAvatar);

module.exports = router;
