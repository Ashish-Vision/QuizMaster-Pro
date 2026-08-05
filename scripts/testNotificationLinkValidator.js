"use strict";

const assert = require("node:assert/strict");

const {
  validateNotificationLink,
} = require("../server/utils/notificationLinkValidator");

const allowedLinks = [
  "",
  "/",
  "/dashboard",
  "/achievements",
  "/settings",
  "/result/507f1f77bcf86cd799439011",
  "/dashboard?tab=recent#activity",
  "/search?q=quiz%20master",
];

const rejectedLinks = [
  "dashboard",
  "//evil.example/phishing",
  "///evil.example/phishing",
  "/\\evil.example/phishing",
  "/safe\\path",
  "/safe path",
  "/safe\npath",
  "/safe\u0000path",
  "/%5cevil.example/phishing",
  "/%2f%2fevil.example/phishing",
  "/%0aevil",
  "/bad%escape",
  "/bad%E0%A4%A",
  "javascript:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "file:///etc/passwd",
  "https://evil.example/phishing",
  "http://evil.example/phishing",
  "https:\\evil.example\\phishing",
];

for (const link of allowedLinks) {
  assert.equal(
    validateNotificationLink(link).isValid,
    true,
    `Expected link to be allowed: ${JSON.stringify(link)}`,
  );
}

for (const link of rejectedLinks) {
  assert.equal(
    validateNotificationLink(link).isValid,
    false,
    `Expected link to be rejected: ${JSON.stringify(link)}`,
  );
}

assert.equal(validateNotificationLink(null).isValid, false);
assert.equal(validateNotificationLink({}).isValid, false);

console.log(
  `Notification link validation passed: ${allowedLinks.length} allowed and ${rejectedLinks.length + 2} rejected cases.`,
);
