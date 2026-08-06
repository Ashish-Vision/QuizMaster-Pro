"use strict";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const POSITIVE_INTEGER_QUERY_FIELDS = new Set(["page", "limit"]);
const BOOLEAN_QUERY_FIELDS = new Set(["unreadOnly"]);
const MAX_SEARCH_LENGTH = 100;

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

function validateCommonQueryValues(req, res, next) {
  for (const [name, value] of Object.entries(req.query || {})) {
    if (typeof value !== "string") {
      return res.status(400).json({
        success: false,
        message: `Query parameter "${name}" must be a single text value.`,
      });
    }
    if (
      POSITIVE_INTEGER_QUERY_FIELDS.has(name) &&
      (!/^[1-9]\d*$/u.test(value) || (name === "limit" && Number(value) > 100))
    ) {
      return res.status(400).json({
        success: false,
        message:
          name === "limit"
            ? 'Query parameter "limit" must be an integer between 1 and 100.'
            : 'Query parameter "page" must be a positive integer.',
      });
    }
    if (
      BOOLEAN_QUERY_FIELDS.has(name) &&
      !["true", "false"].includes(value.toLowerCase())
    ) {
      return res.status(400).json({
        success: false,
        message: `Query parameter "${name}" must be true or false.`,
      });
    }
    if (name === "search" && value.trim().length > MAX_SEARCH_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Search cannot exceed ${MAX_SEARCH_LENGTH} characters.`,
      });
    }
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
  validateCommonQueryValues,
  MAX_SEARCH_LENGTH,
};
