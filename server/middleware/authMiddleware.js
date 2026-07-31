"use strict";

const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function protect(req, res, next) {
  try {
    let token = req.cookies.quizmaster_token;

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
        message: "Authentication is required.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "User account is unavailable.",
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
        message: "Session expired or invalid.",
      });
    }

    return next(error);
  }
}

async function protectPage(req, res, next) {
  try {
    const token = req.cookies.quizmaster_token;

    if (!token) {
      return res.redirect("/login");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      res.clearCookie("quizmaster_token");
      return res.redirect("/login");
    }

    req.user = user;
    res.locals.user = user;

    return next();
  } catch (error) {
    res.clearCookie("quizmaster_token");
    return res.redirect("/login");
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
  protectPage,
  authorizeRoles,
};
