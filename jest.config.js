"use strict";

module.exports = {
  clearMocks: true,
  collectCoverageFrom: [
    "server/**/*.js",
    "!server/server.js",
    "!server/database/**",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov"],
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.js"],
};
