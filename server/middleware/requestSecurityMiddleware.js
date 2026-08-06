"use strict";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function containsUnsafeKey(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsUnsafeKey);
  return Object.entries(value).some(
    ([key, child]) =>
      key.startsWith("$") || key.includes(".") || containsUnsafeKey(child),
  );
}

function rejectUnsafeInput(req, res, next) {
  if (
    containsUnsafeKey(req.body) ||
    containsUnsafeKey(req.query) ||
    containsUnsafeKey(req.params)
  ) {
    return res.status(400).json({
      success: false,
      message: "The request contains an invalid field name.",
    });
  }
  return next();
}

function enforceSameOriginMutation(req, res, next) {
  if (
    process.env.NODE_ENV !== "production" ||
    SAFE_METHODS.has(req.method) ||
    !req.cookies?.quizmaster_token
  ) {
    return next();
  }

  const expectedOrigin = process.env.APP_ORIGIN;
  const suppliedOrigin = req.get("origin");
  if (suppliedOrigin === expectedOrigin) return next();

  return res
    .status(403)
    .json({ success: false, message: "The request origin is not allowed." });
}

module.exports = {
  containsUnsafeKey,
  enforceSameOriginMutation,
  rejectUnsafeInput,
};
