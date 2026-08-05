"use strict";

const assert = require("node:assert/strict");

process.env.JWT_SECRET = "test-only-secret-that-is-long-enough-for-hs256";
process.env.JWT_EXPIRES_IN = "5m";
process.env.JWT_ISSUER = "quizmaster-pro-test";
process.env.JWT_AUDIENCE = "quizmaster-pro-test-users";

const {
  AUTH_TOKEN_ALGORITHM,
  createAuthToken,
  incrementUserTokenVersion,
  normalizeTokenVersion,
  tokenVersionMatches,
  verifyAuthToken,
} = require("../server/utils/authToken");

const userId = "507f1f77bcf86cd799439011";

const {
  getAuthCookieClearOptions,
  getAuthCookieOptions,
  sendAuthResponse,
} = require("../server/utils/helpers");

function issueToken(user) {
  return createAuthToken({
    userId,
    tokenVersion: user.tokenVersion,
  });
}

function assertTokenWorks(token, user) {
  const decoded = verifyAuthToken(token);

  assert.equal(decoded.userId, userId);
  assert.equal(decoded.tokenVersion, normalizeTokenVersion(user.tokenVersion));
  assert.equal(tokenVersionMatches(decoded.tokenVersion, user.tokenVersion), true);

  return decoded;
}

const existingUserWithoutVersion = {};
const initialToken = issueToken(existingUserWithoutVersion);
const initialDecoded = assertTokenWorks(initialToken, existingUserWithoutVersion);

let loginCookie = null;
const loginUser = {
  _id: userId,
  tokenVersion: 0,
  toSafeObject() {
    return { id: userId };
  },
};
const loginResponse = {
  cookie(name, value, options) {
    loginCookie = { name, value, options };
  },
  status(statusCode) {
    assert.equal(statusCode, 200);

    return this;
  },
  json(payload) {
    assert.equal(payload.success, true);

    return payload;
  },
};

sendAuthResponse(loginResponse, 200, "Login successful.", loginUser);
assert.equal(loginCookie.name, "quizmaster_token");
assert.deepEqual(loginCookie.options, getAuthCookieOptions());
assertTokenWorks(loginCookie.value, loginUser);

assert.equal(initialDecoded.tokenVersion, 0);
assert.equal(initialDecoded.iss, process.env.JWT_ISSUER);
assert.deepEqual(initialDecoded.aud, process.env.JWT_AUDIENCE);
assert.equal(AUTH_TOKEN_ALGORITHM, "HS256");

assert.deepEqual(getAuthCookieOptions(), {
  httpOnly: true,
  secure: false,
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
});
assert.deepEqual(getAuthCookieClearOptions(), {
  httpOnly: true,
  secure: false,
  sameSite: "lax",
  path: "/",
});

const passwordResetUser = { tokenVersion: 0 };
const tokenBeforeReset = issueToken(passwordResetUser);

incrementUserTokenVersion(passwordResetUser);

assert.equal(
  tokenVersionMatches(
    verifyAuthToken(tokenBeforeReset).tokenVersion,
    passwordResetUser.tokenVersion,
  ),
  false,
  "Password reset must invalidate the old token.",
);

const tokenAfterResetLogin = issueToken(passwordResetUser);
assertTokenWorks(tokenAfterResetLogin, passwordResetUser);

const passwordChangeUser = { tokenVersion: 7 };
const tokenBeforePasswordChange = issueToken(passwordChangeUser);

incrementUserTokenVersion(passwordChangeUser);

assert.equal(
  tokenVersionMatches(
    verifyAuthToken(tokenBeforePasswordChange).tokenVersion,
    passwordChangeUser.tokenVersion,
  ),
  false,
  "Password change must invalidate the old token.",
);

const rotatedPasswordChangeToken = issueToken(passwordChangeUser);
assertTokenWorks(rotatedPasswordChangeToken, passwordChangeUser);

assert.throws(
  () =>
    require("jsonwebtoken").verify(initialToken, process.env.JWT_SECRET, {
      algorithms: ["HS384"],
      audience: process.env.JWT_AUDIENCE,
      issuer: process.env.JWT_ISSUER,
    }),
  /invalid algorithm/,
);

assert.throws(
  () =>
    require("jsonwebtoken").verify(initialToken, process.env.JWT_SECRET, {
      algorithms: [AUTH_TOKEN_ALGORITHM],
      audience: "wrong-audience",
      issuer: process.env.JWT_ISSUER,
    }),
  /jwt audience invalid/,
);

assert.throws(
  () =>
    require("jsonwebtoken").verify(initialToken, process.env.JWT_SECRET, {
      algorithms: [AUTH_TOKEN_ALGORITHM],
      audience: process.env.JWT_AUDIENCE,
      issuer: "wrong-issuer",
    }),
  /jwt issuer invalid/,
);

console.log(
  "Authentication token tests passed: valid token, legacy user, reset invalidation, password-change invalidation, rotation, algorithm pinning, issuer, and audience.",
);
