"use strict";

const express = require("express");

const { getQuizHistory } = require("../controllers/historyController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, getQuizHistory);

module.exports = router;
