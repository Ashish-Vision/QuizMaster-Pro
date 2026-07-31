"use strict";

const jwt = require("jsonwebtoken");

function generateToken(userId) {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("JWT_SECRET is missing from the environment variables.");
  }

  return jwt.sign(
    {
      userId,
    },
    jwtSecret,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    },
  );
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

function sendAuthResponse(res, statusCode, message, user) {
  const token = generateToken(user._id);

  res.cookie("quizmaster_token", token, getAuthCookieOptions());

  return res.status(statusCode).json({
    success: true,
    message,
    user: user.toSafeObject(),
  });
}

module.exports = {
  generateToken,
  getAuthCookieOptions,
  sendAuthResponse,
};
