"use strict";

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createContainsSearch(search, fields) {
  if (!search || !Array.isArray(fields) || fields.length === 0) return {};

  const pattern = escapeRegex(search);
  return {
    $or: fields.map((field) => ({
      [field]: { $regex: pattern, $options: "i" },
    })),
  };
}

module.exports = {
  createContainsSearch,
  escapeRegex,
};
