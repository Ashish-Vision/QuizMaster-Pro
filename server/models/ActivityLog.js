"use strict";

const mongoose = require("mongoose");

const ACTIVITY_ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "LOGOUT",
  "EXPORT",
  "SEND",
  "ENABLE",
  "DISABLE",
  "PROMOTE",
  "DEMOTE",
  "VIEW",
  "SYSTEM",
];

const ENTITY_TYPES = [
  "User",
  "Question",
  "Category",
  "Attempt",
  "Achievement",
  "Notification",
  "Report",
  "Analytics",
  "System",
];

const activityLogSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    action: {
      type: String,
      enum: ACTIVITY_ACTIONS,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    entityType: {
      type: String,
      enum: ENTITY_TYPES,
      required: true,
      trim: true,
      index: true,
    },

    entityId: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    ipAddress: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },

    userAgent: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

activityLogSchema.index({
  admin: 1,
  createdAt: -1,
});

activityLogSchema.index({
  action: 1,
  createdAt: -1,
});

activityLogSchema.index({
  entityType: 1,
  createdAt: -1,
});

activityLogSchema.index({
  createdAt: -1,
});

const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);

module.exports = ActivityLog;
