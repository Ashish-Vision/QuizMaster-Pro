"use strict";

const {
  getPlatformSettings,
  updatePlatformSettings,
  resetPlatformSettings,
} = require("../services/platformSettingsService");

const { logActivity } = require("../services/activityLogService");

function groupSettings(settings) {
  return settings.reduce((result, setting) => {
    if (!result[setting.category]) {
      result[setting.category] = [];
    }

    result[setting.category].push({
      id: setting._id,
      key: setting.key,
      label: setting.label,
      description: setting.description,
      value: setting.value,
      valueType: setting.valueType,
      isPublic: setting.isPublic,
      updatedAt: setting.updatedAt,
    });

    return result;
  }, {});
}

async function getAdminSettings(req, res, next) {
  try {
    const settings = await getPlatformSettings();

    return res.status(200).json({
      success: true,
      settings,
      grouped: groupSettings(settings),
    });
  } catch (error) {
    next(error);
  }
}

async function updateAdminSettings(req, res, next) {
  try {
    const values =
      req.body && typeof req.body.settings === "object"
        ? req.body.settings
        : {};

    const updated = await updatePlatformSettings(values, req.user._id);

    await logActivity({
      adminId: req.user._id,
      action: "UPDATE",
      entityType: "Settings",
      entityId: "platform-settings",
      description: `Updated ${updated.length} platform settings.`,
      metadata: {
        updatedKeys: Object.keys(values),
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    return res.status(200).json({
      success: true,
      message: "Platform settings updated successfully.",
      updated,
    });
  } catch (error) {
    next(error);
  }
}

async function resetAdminSettings(req, res, next) {
  try {
    const settings = await resetPlatformSettings(req.user._id);

    await logActivity({
      adminId: req.user._id,
      action: "RESET",
      entityType: "Settings",
      entityId: "platform-settings",
      description: "Reset platform settings to defaults.",
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    return res.status(200).json({
      success: true,
      message: "Platform settings restored.",
      settings,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAdminSettings,
  updateAdminSettings,
  resetAdminSettings,
};
