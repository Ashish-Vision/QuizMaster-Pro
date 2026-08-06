"use strict";

const mongoose = require("mongoose");

const ActivityLog = require("../models/ActivityLog");
const { normalizeText } = require("../utils/normalize");

function getRequestIpAddress(req) {
  if (!req) {
    return "";
  }

  const forwardedFor = normalizeText(req.headers?.["x-forwarded-for"]);

  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return (
    normalizeText(req.ip) || normalizeText(req.socket?.remoteAddress) || ""
  );
}

function getRequestUserAgent(req) {
  return normalizeText(req?.headers?.["user-agent"]);
}

async function logActivity({
  adminId,
  action,
  entityType,
  entityId = "",
  description,
  metadata = {},
  ipAddress = "",
  userAgent = "",
}) {
  if (!mongoose.Types.ObjectId.isValid(adminId)) {
    return null;
  }

  const normalizedDescription = normalizeText(description);

  if (!normalizedDescription) {
    return null;
  }

  try {
    return await ActivityLog.create({
      admin: adminId,
      action: normalizeText(action).toUpperCase(),
      entityType: normalizeText(entityType),
      entityId: normalizeText(String(entityId || "")),
      description: normalizedDescription,
      metadata: metadata && typeof metadata === "object" ? metadata : {},
      ipAddress: normalizeText(ipAddress),
      userAgent: normalizeText(userAgent),
    });
  } catch (error) {
    /*
     * Activity logging must never break the original admin action.
     */
    console.error("Activity log creation failed:", error.message);

    return null;
  }
}

async function logRequestActivity({
  req,
  action,
  entityType,
  entityId = "",
  description,
  metadata = {},
}) {
  const adminId = req?.user?._id || req?.user?.id;

  return logActivity({
    adminId,
    action,
    entityType,
    entityId,
    description,
    metadata,
    ipAddress: getRequestIpAddress(req),
    userAgent: getRequestUserAgent(req),
  });
}

module.exports = {
  logActivity,
  logRequestActivity,
  getRequestIpAddress,
  getRequestUserAgent,
};
