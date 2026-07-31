"use strict";

const jwt = require("jsonwebtoken");

const User = require("../models/User");

async function protect(req, res, next) {
  try {
    let token = req.cookies?.quizmaster_token;

    const authorizationHeader = req.headers.authorization;

    if (!token && authorizationHeader?.startsWith("Bearer ")) {
      token = authorizationHeader.split(" ")[1];
    }

    if (!token) {
      const acceptsHtml = req.accepts(["html", "json"]) === "html";

      if (acceptsHtml) {
        return res.redirect("/login");
      }

      return res.status(401).json({
        success: false,
        message: "Authentication is required. Please log in.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      const acceptsHtml = req.accepts(["html", "json"]) === "html";

      if (acceptsHtml) {
        return res.redirect("/login");
      }

      return res.status(401).json({
        success: false,
        message: "The user associated with this session was not found.",
      });
    }

    req.user = user;

    return next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      const acceptsHtml = req.accepts(["html", "json"]) === "html";

      if (acceptsHtml) {
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

function authorizeRoles(...allowedRoles) {
  return function authorize(req, res, next) {
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
