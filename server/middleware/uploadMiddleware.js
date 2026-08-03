"use strict";

const multer = require("multer");

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

const ALLOWED_AVATAR_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const storage = multer.memoryStorage();

function avatarFileFilter(req, file, callback) {
  if (!ALLOWED_AVATAR_MIME_TYPES.has(file.mimetype)) {
    const error = new Error("Only JPEG, PNG and WebP images are allowed.");

    error.statusCode = 400;
    error.code = "INVALID_AVATAR_TYPE";

    return callback(error);
  }

  return callback(null, true);
}

const uploadAvatar = multer({
  storage,

  limits: {
    fileSize: MAX_AVATAR_SIZE_BYTES,

    files: 1,
  },

  fileFilter: avatarFileFilter,
}).single("avatar");

function handleAvatarUpload(req, res, next) {
  uploadAvatar(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,

          message: "Avatar image cannot exceed 5 MB.",
        });
      }

      if (error.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({
          success: false,

          message: "Only one avatar image can be uploaded.",
        });
      }

      if (error.code === "LIMIT_UNEXPECTED_FILE") {
        return res.status(400).json({
          success: false,

          message: 'Use the form field name "avatar" for the image upload.',
        });
      }

      return res.status(400).json({
        success: false,

        message: error.message || "Avatar upload failed.",
      });
    }

    return res.status(error.statusCode || 400).json({
      success: false,

      message: error.message || "Avatar upload failed.",
    });
  });
}

module.exports = {
  handleAvatarUpload,

  MAX_AVATAR_SIZE_BYTES,

  ALLOWED_AVATAR_MIME_TYPES,
};
