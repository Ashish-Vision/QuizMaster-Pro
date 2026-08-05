"use strict";

const { createAuthToken } = require("./authToken");

function generateToken(userId, tokenVersion = 0) {
  return createAuthToken({
    userId,
    tokenVersion,
  });
}

function getAuthCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

function getAuthCookieClearOptions() {
  const clearOptions = getAuthCookieOptions();

  delete clearOptions.maxAge;

  return clearOptions;
}

function sendAuthResponse(res, statusCode, message, user) {
  const token = generateToken(user._id, user.tokenVersion);

  res.cookie("quizmaster_token", token, getAuthCookieOptions());

  return res.status(statusCode).json({
    success: true,
    message,
    user: user.toSafeObject(),
  });
}

module.exports = {
  generateToken,
  getAuthCookieClearOptions,
  getAuthCookieOptions,
  sendAuthResponse,
};
