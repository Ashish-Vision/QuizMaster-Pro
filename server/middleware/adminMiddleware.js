"use strict";

/**
 * Allows access only to administrators.
 *
 * This middleware must be used after protect.
 */
function adminOnly(req, res, next) {
  if (!req.user) {
    const expectsHtml = req.accepts(["html", "json"]) === "html";

    if (expectsHtml) {
      return res.redirect("/login");
    }

    return res.status(401).json({
      success: false,
      message: "Authentication is required.",
    });
  }

  if (req.user.role !== "admin") {
    const expectsHtml = req.accepts(["html", "json"]) === "html";

    if (expectsHtml) {
      return res.redirect("/dashboard");
    }

    return res.status(403).json({
      success: false,
      message: "Administrator access is required for this resource.",
    });
  }

  return next();
}

module.exports = {
  adminOnly,
};
