"use strict";

/* global jest */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const projectRoot = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function findFiles(relativeDirectory, extension) {
  const directory = path.join(projectRoot, relativeDirectory);

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDirectory, entry.name);

    if (entry.isDirectory()) {
      return findFiles(relativePath, extension);
    }

    return entry.isFile() && entry.name.endsWith(extension)
      ? [relativePath]
      : [];
  });
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

  test("every rendered page links the foundation before page styles", () => {
    const foundation = read("client/css/foundation.css");
    expect(foundation).toContain(":focus-visible");
    expect(foundation).toContain(
      "outline: 3px solid var(--focus-color) !important",
    );
    expect(foundation).toContain("prefers-reduced-motion: reduce");
    expect(foundation).toContain("min-height: 44px");

    const views = findFiles("client/views", ".ejs");
    const completePages = views.filter((view) => /<html\b/iu.test(read(view)));
    const partials = views.filter((view) => !completePages.includes(view));

    expect(completePages.length).toBeGreaterThan(0);
    expect(partials.length).toBeGreaterThan(0);

    for (const view of completePages) {
      const markup = read(view);
      const head = markup.match(/<head\b[^>]*>([\s\S]*?)<\/head>/iu)?.[1];
      expect(head).toBeDefined();

      const foundationReferences = markup.match(/\/css\/foundation\.css/gu);
      expect(foundationReferences).toHaveLength(1);

      const stylesheetLinks = [
        ...head.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/giu),
      ];
      const foundationLinkIndex = stylesheetLinks.findIndex((match) =>
        match[0].includes("/css/foundation.css"),
      );

      expect(foundationLinkIndex).toBe(0);
      expect(head.match(/\/css\/foundation\.css/gu)).toHaveLength(1);
    }

    for (const partial of partials) {
      expect(read(partial)).not.toMatch(/<html\b/iu);
    }

    for (const view of completePages) {
      const markup = read(view);
      expect(markup).not.toMatch(/<script\b(?![^>]*\bsrc=)[^>]*>/iu);
      expect(markup).not.toMatch(/\sstyle=/iu);
    }

    for (const stylesheet of findFiles("client/css", ".css")) {
      expect(read(stylesheet)).not.toContain(
        '@import url("/css/foundation.css");',
      );
    }
  });
});
