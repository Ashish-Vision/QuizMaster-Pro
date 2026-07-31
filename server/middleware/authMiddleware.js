"use strict";

const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function protect(req, res, next) {
  try {
    let token = req.cookies?.quizmaster_token;

    const authorizationHeader = req.headers.authorization;

    if (
      !token &&
      authorizationHeader &&
      authorizationHeader.startsWith("Bearer ")
    ) {
      token = authorizationHeader.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required. Please log in.",
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is missing.");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "The user associated with this session is unavailable.",
      });
    }

    req.user = user;

    return next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        success: false,
        message: "Your session is invalid or has expired. Please log in again.",
      });
    }

    return next(error);
  }
}

function authorizeRoles(...allowedRoles) {
  return function roleMiddleware(req, res, next) {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
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
  