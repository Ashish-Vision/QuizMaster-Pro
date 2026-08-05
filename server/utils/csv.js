"use strict";

const FORMULA_PREFIX_CHARACTERS = new Set(["=", "+", "-", "@"]);

function hasSpreadsheetFormulaPrefix(value) {
  const leadingWhitespace = value.match(/^\s*/u)?.[0] || "";

  if (leadingWhitespace.includes("\t") || leadingWhitespace.includes("\r")) {
    return true;
  }

  const firstMeaningfulCharacter = value.charAt(leadingWhitespace.length);

  return FORMULA_PREFIX_CHARACTERS.has(firstMeaningfulCharacter);
}

function escapeCsvCell(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);

  const neutralizedText = hasSpreadsheetFormulaPrefix(text) ? `'${text}` : text;

  if (
    neutralizedText.includes(",") ||
    neutralizedText.includes('"') ||
    neutralizedText.includes("\n") ||
    neutralizedText.includes("\r")
  ) {
    return `"${neutralizedText.replaceAll('"', '""')}"`;
  }

  return neutralizedText;
}

function createCsv(headers, rows) {
  const headerLine = headers.map(escapeCsvCell).join(",");

  const rowLines = rows.map((row) => row.map(escapeCsvCell).join(","));

  return [headerLine, ...rowLines].join("\n");
}

module.exports = {
  createCsv,
  escapeCsvCell,
  hasSpreadsheetFormulaPrefix,
};
