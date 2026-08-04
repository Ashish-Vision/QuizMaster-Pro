"use strict";

const express = require("express");

const {
  getCategories,
  renameCategory,
  deleteCategory,
} = require("../controllers/adminCategoryController");

const { protect } = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/adminMiddleware");

const router = express.Router();

router.use(protect);
router.use(adminOnly);

router.get("/", getCategories);

router.route("/:categoryName").patch(renameCategory).delete(deleteCategory);

module.exports = router;
