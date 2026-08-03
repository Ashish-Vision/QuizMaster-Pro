"use strict";

const { v2: cloudinary } = require("cloudinary");

function getRequiredEnvironmentVariable(name) {
  const value =
    typeof process.env[name] === "string" ? process.env[name].trim() : "";

  if (!value) {
    throw new Error(`${name} is missing from the environment variables.`);
  }

  return value;
}

function configureCloudinary() {
  const cloudName = getRequiredEnvironmentVariable("CLOUDINARY_CLOUD_NAME");

  const apiKey = getRequiredEnvironmentVariable("CLOUDINARY_API_KEY");

  const apiSecret = getRequiredEnvironmentVariable("CLOUDINARY_API_SECRET");

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  return cloudinary;
}

function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
    process.env.CLOUDINARY_API_KEY?.trim() &&
    process.env.CLOUDINARY_API_SECRET?.trim(),
  );
}

module.exports = {
  cloudinary,
  configureCloudinary,
  isCloudinaryConfigured,
};
