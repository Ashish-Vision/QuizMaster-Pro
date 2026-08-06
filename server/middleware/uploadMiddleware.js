"use strict";

const multer = require("multer");

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_AVATAR_DIMENSION = 4096;
const MAX_AVATAR_PIXELS = 16_000_000;

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

function getJpegDimensions(buffer) {
  let offset = 2;

  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (segmentLength < 2 || offset + 2 + segmentLength > buffer.length) {
      return null;
    }
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc9, 0xca, 0xcb].includes(marker)) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + segmentLength;
  }

  return null;
}

function inspectAvatarImage(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer) || detectAvatarMimeType(buffer) !== mimeType) {
    return null;
  }

  let dimensions = null;
  let structurallyComplete = false;

  if (mimeType === "image/png" && buffer.length >= 33) {
    dimensions = {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
    structurallyComplete =
      buffer.readUInt32BE(buffer.length - 12) === 0 &&
      buffer.toString("ascii", buffer.length - 8, buffer.length - 4) === "IEND";
  } else if (mimeType === "image/jpeg" && buffer.length >= 12) {
    dimensions = getJpegDimensions(buffer);
    structurallyComplete =
      buffer[buffer.length - 2] === 0xff && buffer[buffer.length - 1] === 0xd9;
  } else if (mimeType === "image/webp" && buffer.length >= 30) {
    const declaredLength = buffer.readUInt32LE(4) + 8;
    structurallyComplete =
      declaredLength <= buffer.length &&
      ["VP8 ", "VP8L", "VP8X"].includes(buffer.toString("ascii", 12, 16));
    const webpType = buffer.toString("ascii", 12, 16);
    if (webpType === "VP8X") {
      dimensions = {
        width: 1 + buffer.readUIntLE(24, 3),
        height: 1 + buffer.readUIntLE(27, 3),
      };
    } else if (
      webpType === "VP8 " &&
      buffer[23] === 0x9d &&
      buffer[24] === 0x01 &&
      buffer[25] === 0x2a
    ) {
      dimensions = {
        width: buffer.readUInt16LE(26) & 0x3fff,
        height: buffer.readUInt16LE(28) & 0x3fff,
      };
    } else if (webpType === "VP8L" && buffer[20] === 0x2f) {
      const bits = buffer.readUInt32LE(21);
      dimensions = {
        width: 1 + (bits & 0x3fff),
        height: 1 + ((bits >> 14) & 0x3fff),
      };
    }
  }

  if (!structurallyComplete || !dimensions) return null;
  const { width, height } = dimensions;
  if (
    width < 1 ||
    height < 1 ||
    width > MAX_AVATAR_DIMENSION ||
    height > MAX_AVATAR_DIMENSION ||
    width * height > MAX_AVATAR_PIXELS
  ) {
    return null;
  }

  return { mimeType, width, height };
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
        const image = inspectAvatarImage(req.file.buffer, req.file.mimetype);
        if (!image) {
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
  inspectAvatarImage,
  MAX_AVATAR_DIMENSION,
  MAX_AVATAR_PIXELS,
};
