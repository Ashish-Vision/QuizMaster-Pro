"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const projectRoot = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

describe("frontend accessibility foundation", () => {
  test("shared browser escaping safely renders representative untrusted text", () => {
    const context = { window: {} };
    vm.runInNewContext(read("client/js/shared.js"), context);

    expect(
      context.window.QuizMaster.escapeHtml(
        `<script title="x">'A&B' — 你好 ${"x".repeat(500)}</script>`,
      ),
    ).toBe(
      `&lt;script title=&quot;x&quot;&gt;&#039;A&amp;B&#039; — 你好 ${"x".repeat(500)}&lt;/script&gt;`,
    );
  });

  test("modal pages load the shared dialog behavior after shared helpers", () => {
    const modalViews = [
      "client/views/profile.ejs",
      "client/views/quiz.ejs",
      "client/views/result.ejs",
      "client/views/admin/achievements.ejs",
      "client/views/admin/activity-logs.ejs",
      "client/views/admin/attempts.ejs",
      "client/views/admin/categories.ejs",
      "client/views/admin/notifications.ejs",
      "client/views/admin/questions.ejs",
      "client/views/admin/settings.ejs",
      "client/views/admin/users.ejs",
    ];

    for (const view of modalViews) {
      expect(read(view)).toContain("/js/dialogs.js");
    }

    for (const view of [
      "client/views/admin/attempts.ejs",
      "client/views/admin/categories.ejs",
      "client/views/admin/questions.ejs",
      "client/views/admin/users.ejs",
    ]) {
      const markup = read(view);
      expect(markup.indexOf("/js/shared.js")).toBeLessThan(
        markup.indexOf("/js/dialogs.js"),
      );
    }
  });

  test("shared focus and reduced-motion rules are available to page styles", () => {
    const foundation = read("client/css/foundation.css");
    expect(foundation).toContain(":focus-visible");
    expect(foundation).toContain("prefers-reduced-motion: reduce");
    expect(foundation).toContain("min-height: 44px");

    const pageStyles = [
      "client/css/style.css",
      "client/css/auth.css",
      "client/css/dashboard.css",
      "client/css/quiz.css",
      "client/css/admin/dashboard.css",
      "client/css/admin/questions.css",
    ];
    for (const stylesheet of pageStyles) {
      expect(read(stylesheet)).toContain('@import url("/css/foundation.css")');
    }
  });
});
