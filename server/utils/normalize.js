"use strict";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLowercaseText(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeEmail(value) {
  return normalizeLowercaseText(value);
}

module.exports = {
  normalizeEmail,
  normalizeLowercaseText,
  normalizeText,
};
