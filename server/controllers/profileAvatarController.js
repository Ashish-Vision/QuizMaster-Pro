"use strict";

const User = require("../models/User");

const {
  cloudinary,
  configureCloudinary,
  isCloudinaryConfigured,
} = require("../config/cloudinary");

const AVATAR_FOLDER = "quizmaster-pro/avatars";

function getUserId(req) {
  return req.user?._id || req.user?.id || null;
}

function getAvatarPublicId(userId) {
  return `${AVATAR_FOLDER}/user-${String(userId)}`;
}

function uploadAvatarBuffer({ buffer, userId }) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: AVATAR_FOLDER,

        public_id: `user-${String(userId)}`,

        resource_type: "image",

        overwrite: true,

        invalidate: true,

        transformation: [
          {
            width: 512,
            height: 512,
            crop: "fill",
            gravity: "auto",
          },

          {
            quality: "auto",
            fetch_format: "auto",
          },
        ],
      },

      (error, result) => {
        if (error) {
          return reject(error);
        }

        return resolve(result);
      },
    );

    uploadStream.end(buffer);
  });
}

async function uploadProfileAvatar(req, res, next) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required to upload an avatar.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Select an avatar image before uploading.",
      });
    }

    if (!isCloudinaryConfigured()) {
      return res.status(503).json({
        success: false,
        message:
          "Avatar storage is not configured. Add the Cloudinary environment variables.",
      });
    }

    configureCloudinary();

    const uploadedImage = await uploadAvatarBuffer({
      buffer: req.file.buffer,
      userId,
    });

    if (!uploadedImage?.secure_url) {
      throw new Error("Cloudinary did not return an avatar URL.");
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        avatar: uploadedImage.secure_url,
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!user) {
      /*
       * Remove the uploaded image when the
       * user no longer exists.
       */
      await cloudinary.uploader.destroy(getAvatarPublicId(userId), {
        resource_type: "image",
        invalidate: true,
      });

      return res.status(404).json({
        success: false,
        message: "User profile was not found.",
      });
    }

    return res.status(200).json({
      success: true,

      message: "Profile picture uploaded successfully.",

      avatar: user.avatar,

      user: {
        id: user._id,
        avatar: user.avatar,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (error) {
    console.error("Profile avatar upload error:", error);

    if (error.http_code === 400 || error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message || "The avatar image could not be uploaded.",
      });
    }

    return next(error);
  }
}

async function deleteProfileAvatar(req, res, next) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required to remove an avatar.",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User profile was not found.",
      });
    }

    if (isCloudinaryConfigured()) {
      configureCloudinary();

      try {
        const deletionResult = await cloudinary.uploader.destroy(
          getAvatarPublicId(userId),
          {
            resource_type: "image",
            invalidate: true,
            timeout: 15000,
          },
        );

        console.log(
          "Cloudinary avatar deletion result:",
          deletionResult.result,
        );
      } catch (cloudinaryError) {
        console.error("Cloudinary avatar deletion error:", cloudinaryError);
      }
    }

    user.avatar = "";

    await user.save();

    return res.status(200).json({
      success: true,

      message: "Profile picture removed successfully.",

      avatar: "",
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  uploadProfileAvatar,
  deleteProfileAvatar,
};
