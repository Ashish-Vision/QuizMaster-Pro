"use strict";

/* global jest */

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

  test("shared browser formatting and visibility helpers handle edge cases", () => {
    const context = { window: {} };
    vm.runInNewContext(read("client/js/shared.js"), context);
    const { formatDate, formatNumber, getInitials, toggleElement } =
      context.window.QuizMaster;
    const element = {
      classList: { toggle: jest.fn() },
    };

    expect(formatDate(null)).toBe("Unknown");
    expect(formatDate("invalid-date")).toBe("Unknown");
    expect(formatDate("2026-08-06T00:00:00.000Z")).toMatch(/06 Aug 2026/);
    expect(formatNumber("1200")).toMatch(/1,200/);
    expect(formatNumber("not-a-number")).toBe("0");
    expect(getInitials({ firstName: "ada", lastName: "lovelace" })).toBe("AL");
    expect(getInitials(null, "?")).toBe("?");

    toggleElement(element, true);
    toggleElement(element, false);
    expect(element.classList.toggle).toHaveBeenNthCalledWith(
      1,
      "hidden",
      false,
    );
    expect(element.classList.toggle).toHaveBeenNthCalledWith(2, "hidden", true);
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
