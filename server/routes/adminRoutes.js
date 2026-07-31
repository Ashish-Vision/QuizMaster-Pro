"use strict";

const express = require("express");

const { getAdminDashboard } = require("../controllers/adminController");

const { protect } = require("../middleware/authMiddleware");

const { adminOnly } = require("../middleware/adminMiddleware");

const router = express.Router();

/*
 * Every route below these middleware calls
 * requires an authenticated administrator.
 */
router.use(protect);
router.use(adminOnly);

router.get("/dashboard", getAdminDashboard);

module.exports = router;
