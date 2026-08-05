"use strict";

const User = require("../models/User");
const {
  tokenVersionMatches,
  verifyAuthToken,
} = require("../utils/authToken");
const { getAuthCookieClearOptions } = require("../utils/helpers");

/**
 * Determines whether the current request expects an HTML page.
 */
function requestExpectsHtml(req) {
  return req.accepts(["html", "json"]) === "html";
}

/**
 * Removes an invalid authentication cookie.
 */
function clearAuthenticationCookie(res) {
  res.clearCookie("quizmaster_token", getAuthCookieClearOptions());
}

/**
 * Protects routes that require authentication.
 */
async function protect(req, res, next) {
  try {
    let token = req.cookies?.quizmaster_token;

    const authorizationHeader = req.headers.authorization;

    if (
      !token &&
      typeof authorizationHeader === "string" &&
      authorizationHeader.startsWith("Bearer ")
    ) {
      token = authorizationHeader.slice(7).trim();
    }

    if (!token) {
      if (requestExpectsHtml(req)) {
        return res.redirect("/login");
      }

      return res.status(401).json({
        success: false,
        message: "Authentication is required. Please log in.",
      });
    }

    const decoded = verifyAuthToken(token);

    if (!decoded?.userId) {
      clearAuthenticationCookie(res);

      if (requestExpectsHtml(req)) {
        return res.redirect("/login");
      }

      return res.status(401).json({
        success: false,
        message: "The authentication token is invalid.",
      });
    }

    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      clearAuthenticationCookie(res);

      if (requestExpectsHtml(req)) {
        return res.redirect("/login");
      }

      return res.status(401).json({
        success: false,
        message: "The user associated with this session was not found.",
      });
    }

    if (!tokenVersionMatches(decoded.tokenVersion, user.tokenVersion)) {
      clearAuthenticationCookie(res);

      if (requestExpectsHtml(req)) {
        return res.redirect("/login");
      }

      return res.status(401).json({
        success: false,
        message: "Your session has been invalidated. Please log in again.",
      });
    }

    if (!user.isActive) {
      clearAuthenticationCookie(res);

      if (requestExpectsHtml(req)) {
        return res.redirect("/login");
      }

      return res.status(403).json({
        success: false,
        message: "This account has been disabled.",
      });
    }

    /*
     * The complete authenticated user is now available
     * to all following middleware and route handlers.
     *
     * This includes:
     * - firstName
     * - lastName
     * - email
     * - role
     * - totalXp
     * - statistics
     */
    req.user = user;

    return next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      clearAuthenticationCookie(res);

      if (requestExpectsHtml(req)) {
        return res.redirect("/login");
      }

      return res.status(401).json({
        success: false,
        message: "Your session is invalid or expired. Please log in again.",
      });
    }

    return next(error);
  }
}

/**
 * Allows only users whose role is included in allowedRoles.
 *
 * Example:
 * authorizeRoles("admin")
 */
function authorizeRoles(...allowedRoles) {
  return function authorize(req, res, next) {
    if (!req.user) {
      if (requestExpectsHtml(req)) {
        return res.redirect("/login");
      }

      return res.status(401).json({
        success: false,
        message: "Authentication is required.",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      if (requestExpectsHtml(req)) {
        return res.redirect("/dashboard");
      }

      return res.status(403).json({
        success: false,
        message: "You do not have permission to access this resource.",
      });
    }

    return next();
  };
}

module.exports = {
  protect,
  authorizeRoles,
};
