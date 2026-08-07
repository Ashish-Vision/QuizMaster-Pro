"use strict";

const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./e2e",
  testMatch: "screenshot-capture.spec.js",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5000",
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
    reducedMotion: "reduce",
    deviceScaleFactor: 1,
  },
  webServer: {
    command: "node e2e/support/server.js",
    url: "http://127.0.0.1:5000/api/health",
    reuseExistingServer: true,
  },
});
