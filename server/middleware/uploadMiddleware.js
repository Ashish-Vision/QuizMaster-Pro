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

function detectAvatarMimeType(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  )
    return "image/jpeg";
  if (
    buffer.length >= 8 &&
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return "image/png";
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  return null;
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
      if (req.file) {
        const detectedMimeType = detectAvatarMimeType(req.file.buffer);
        if (!detectedMimeType || detectedMimeType !== req.file.mimetype) {
          return res.status(400).json({
            success: false,
            message:
              "The uploaded file content does not match a supported image type.",
          });
        }
      }
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
  detectAvatarMimeType,
};
