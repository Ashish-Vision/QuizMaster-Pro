"use strict";

const assert = require("node:assert/strict");

const {
  createCsv,
  escapeCsvCell,
  hasSpreadsheetFormulaPrefix,
} = require("../server/utils/csv");

const normalCases = [
  [null, ""],
  [undefined, ""],
  [42, "42"],
  ["QuizMaster Pro", "QuizMaster Pro"],
  ["hello,world", '"hello,world"'],
  ['He said "hello"', '"He said ""hello"""'],
  ["first\nsecond", '"first\nsecond"'],
  ["first\rsecond", '"first\rsecond"'],
];

const maliciousCases = [
  ['=HYPERLINK("https://evil.example")', '"\'=HYPERLINK(""https://evil.example"")"'],
  ["+SUM(1,1)", '"\'+SUM(1,1)"'],
  ["-10+20", "'-10+20"],
  ["@SUM(A1:A2)", "'@SUM(A1:A2)"],
  ["  =1+1", "'  =1+1"],
  ["\t=1+1", "'\t=1+1"],
  ["\r=1+1", '"\'\r=1+1"'],
];

for (const [input, expected] of [...normalCases, ...maliciousCases]) {
  assert.equal(
    escapeCsvCell(input),
    expected,
    `Unexpected CSV encoding for ${JSON.stringify(input)}`,
  );
}

assert.equal(hasSpreadsheetFormulaPrefix("normal"), false);
assert.equal(hasSpreadsheetFormulaPrefix(" =1+1"), true);
assert.equal(hasSpreadsheetFormulaPrefix("\tordinary text"), true);
assert.equal(hasSpreadsheetFormulaPrefix("\rordinary text"), true);

assert.equal(
  createCsv(
    ["Name", "Payload"],
    [
      ["Alice", "normal"],
      ["Mallory", "=2+2"],
    ],
  ),
  "Name,Payload\nAlice,normal\nMallory,'=2+2",
);

console.log(
  `CSV validation passed: ${normalCases.length} normal and ${maliciousCases.length} malicious cell cases.`,
);
