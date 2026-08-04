"use strict";

const mongoose = require("mongoose");

const platformSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 100,
    },

    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    category: {
      type: String,
      enum: [
        "general",
        "authentication",
        "quiz",
        "features",
        "email",
        "maintenance",
      ],
      required: true,
      index: true,
    },

    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    valueType: {
      type: String,
      enum: ["string", "number", "boolean"],
      required: true,
    },

    isPublic: {
      type: Boolean,
      default: false,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

platformSettingSchema.index({
  category: 1,
  key: 1,
});

const PlatformSetting = mongoose.model(
  "PlatformSetting",
  platformSettingSchema,
);

module.exports = PlatformSetting;
