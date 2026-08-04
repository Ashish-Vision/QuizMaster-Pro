"use strict";

const PlatformSetting = require("../models/PlatformSetting");

const DEFAULT_PLATFORM_SETTINGS = [
  {
    key: "platform_name",
    value: "QuizMaster Pro",
    category: "general",
    label: "Platform Name",
    description: "The public name displayed across the application.",
    valueType: "string",
    isPublic: true,
  },
  {
    key: "platform_description",
    value: "Learn, compete and grow with interactive quizzes.",
    category: "general",
    label: "Platform Description",
    description: "A short description of the quiz platform.",
    valueType: "string",
    isPublic: true,
  },
  {
    key: "registration_enabled",
    value: true,
    category: "authentication",
    label: "Registration Enabled",
    description: "Allow new users to create accounts.",
    valueType: "boolean",
    isPublic: true,
  },
  {
    key: "google_authentication_enabled",
    value: true,
    category: "authentication",
    label: "Google Authentication Enabled",
    description: "Allow users to sign in using Google.",
    valueType: "boolean",
    isPublic: true,
  },
  {
    key: "default_quiz_time_minutes",
    value: 10,
    category: "quiz",
    label: "Default Quiz Time",
    description: "Default quiz duration in minutes.",
    valueType: "number",
    isPublic: true,
  },
  {
    key: "questions_per_quiz",
    value: 5,
    category: "quiz",
    label: "Questions Per Quiz",
    description: "Default number of questions in a quiz.",
    valueType: "number",
    isPublic: true,
  },
  {
    key: "default_xp_multiplier",
    value: 1,
    category: "quiz",
    label: "Default XP Multiplier",
    description: "Multiplier applied when calculating earned quiz XP.",
    valueType: "number",
    isPublic: false,
  },
  {
    key: "daily_challenge_enabled",
    value: true,
    category: "features",
    label: "Daily Challenge Enabled",
    description: "Enable the daily challenge feature.",
    valueType: "boolean",
    isPublic: true,
  },
  {
    key: "leaderboard_enabled",
    value: true,
    category: "features",
    label: "Leaderboard Enabled",
    description: "Enable leaderboard pages and ranking APIs.",
    valueType: "boolean",
    isPublic: true,
  },
  {
    key: "email_notifications_enabled",
    value: true,
    category: "email",
    label: "Email Notifications Enabled",
    description: "Allow the system to send notification emails.",
    valueType: "boolean",
    isPublic: false,
  },
  {
    key: "maintenance_mode",
    value: false,
    category: "maintenance",
    label: "Maintenance Mode",
    description: "Temporarily restrict normal user access.",
    valueType: "boolean",
    isPublic: true,
  },
  {
    key: "maintenance_message",
    value: "QuizMaster Pro is temporarily unavailable for maintenance.",
    category: "maintenance",
    label: "Maintenance Message",
    description: "Message shown when maintenance mode is active.",
    valueType: "string",
    isPublic: true,
  },
];

function cloneDefaultSetting(setting) {
  return {
    ...setting,
  };
}

function getDefaultPlatformSettings() {
  return DEFAULT_PLATFORM_SETTINGS.map(cloneDefaultSetting);
}

async function initializePlatformSettings() {
  const operations = DEFAULT_PLATFORM_SETTINGS.map((setting) => ({
    updateOne: {
      filter: {
        key: setting.key,
      },
      update: {
        $setOnInsert: setting,
      },
      upsert: true,
    },
  }));

  if (operations.length > 0) {
    await PlatformSetting.bulkWrite(operations);
  }

  return PlatformSetting.find()
    .sort({
      category: 1,
      key: 1,
    })
    .lean();
}

async function getPlatformSettings({ publicOnly = false } = {}) {
  await initializePlatformSettings();

  const filter = publicOnly
    ? {
        isPublic: true,
      }
    : {};

  return PlatformSetting.find(filter)
    .sort({
      category: 1,
      key: 1,
    })
    .lean();
}

async function getPlatformSettingsObject({ publicOnly = false } = {}) {
  const settings = await getPlatformSettings({
    publicOnly,
  });

  return settings.reduce((result, setting) => {
    result[setting.key] = setting.value;

    return result;
  }, {});
}

function castSettingValue(value, valueType) {
  if (valueType === "boolean") {
    if (typeof value === "boolean") {
      return value;
    }

    if (String(value).toLowerCase() === "true") {
      return true;
    }

    if (String(value).toLowerCase() === "false") {
      return false;
    }

    throw new Error("Boolean setting values must be true or false.");
  }

  if (valueType === "number") {
    const numberValue = Number(value);

    if (!Number.isFinite(numberValue)) {
      throw new Error("Number setting values must contain a valid number.");
    }

    return numberValue;
  }

  if (valueType === "string") {
    return typeof value === "string"
      ? value.trim()
      : String(value ?? "").trim();
  }

  throw new Error("Unsupported platform setting type.");
}

async function updatePlatformSettings(values, adminId) {
  await initializePlatformSettings();

  if (!values || typeof values !== "object" || Array.isArray(values)) {
    throw new Error("Settings must be provided as an object.");
  }

  const existingSettings = await PlatformSetting.find({
    key: {
      $in: Object.keys(values),
    },
  });

  const existingMap = new Map(
    existingSettings.map((setting) => [setting.key, setting]),
  );

  const unknownKeys = Object.keys(values).filter(
    (key) => !existingMap.has(key),
  );

  if (unknownKeys.length > 0) {
    throw new Error(`Unknown platform setting: ${unknownKeys.join(", ")}`);
  }

  const updatedSettings = [];

  for (const [key, rawValue] of Object.entries(values)) {
    const setting = existingMap.get(key);

    setting.value = castSettingValue(rawValue, setting.valueType);

    setting.updatedBy = adminId || null;

    await setting.save();

    updatedSettings.push(setting.toObject());
  }

  return updatedSettings;
}

async function resetPlatformSettings(adminId) {
  const defaults = getDefaultPlatformSettings();

  for (const setting of defaults) {
    await PlatformSetting.findOneAndUpdate(
      {
        key: setting.key,
      },
      {
        $set: {
          value: setting.value,
          category: setting.category,
          label: setting.label,
          description: setting.description,
          valueType: setting.valueType,
          isPublic: setting.isPublic,
          updatedBy: adminId || null,
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
      },
    );
  }

  return getPlatformSettings();
}

module.exports = {
  getDefaultPlatformSettings,
  initializePlatformSettings,
  getPlatformSettings,
  getPlatformSettingsObject,
  updatePlatformSettings,
  resetPlatformSettings,
  castSettingValue,
};
