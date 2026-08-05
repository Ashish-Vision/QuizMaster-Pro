"use strict";

const jwt = require("jsonwebtoken");

const AUTH_TOKEN_ALGORITHM = "HS256";
const DEFAULT_AUTH_TOKEN_ISSUER = "quizmaster-pro";
const DEFAULT_AUTH_TOKEN_AUDIENCE = "quizmaster-pro-users";

function getJwtSecret() {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("JWT_SECRET is missing from the environment variables.");
  }

  return jwtSecret;
}

function getAuthTokenIssuer() {
  return process.env.JWT_ISSUER || DEFAULT_AUTH_TOKEN_ISSUER;
}

function getAuthTokenAudience() {
  return process.env.JWT_AUDIENCE || DEFAULT_AUTH_TOKEN_AUDIENCE;
}

function normalizeTokenVersion(value) {
  const version = Number(value);

  return Number.isSafeInteger(version) && version >= 0 ? version : 0;
}

function incrementUserTokenVersion(user) {
  if (!user) {
    throw new Error("A user is required to increment the token version.");
  }

  user.tokenVersion = normalizeTokenVersion(user.tokenVersion) + 1;

  return user.tokenVersion;
}

function tokenVersionMatches(tokenVersion, userTokenVersion) {
  return (
    normalizeTokenVersion(tokenVersion) ===
    normalizeTokenVersion(userTokenVersion)
  );
}

function createAuthToken({ userId, tokenVersion = 0 }) {
  if (!userId) {
    throw new Error("A user ID is required to create an authentication token.");
  }

  return jwt.sign(
    {
      userId,
      tokenVersion: normalizeTokenVersion(tokenVersion),
    },
    getJwtSecret(),
    {
      algorithm: AUTH_TOKEN_ALGORITHM,
      audience: getAuthTokenAudience(),
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
      issuer: getAuthTokenIssuer(),
    },
  );
}

function verifyAuthToken(token) {
  return jwt.verify(token, getJwtSecret(), {
    algorithms: [AUTH_TOKEN_ALGORITHM],
    audience: getAuthTokenAudience(),
    issuer: getAuthTokenIssuer(),
  });
}

module.exports = {
  AUTH_TOKEN_ALGORITHM,
  createAuthToken,
  incrementUserTokenVersion,
  normalizeTokenVersion,
  tokenVersionMatches,
  verifyAuthToken,
};
