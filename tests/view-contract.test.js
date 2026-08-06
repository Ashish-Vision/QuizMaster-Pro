"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const VIEW_ROOT = path.join(ROOT, "client/views");
const CLIENT_ROOT = path.join(ROOT, "client");
const OPTIONAL_IDS = new Set([
  "menuButton",
  "navLinks",
  "formMessage",
  "recentAchievementsList",
  "recentAttemptsList",
  "dailyRewardBadgeIcon",
  "dailyRewardBadgeTitle",
  "dailyRewardBonusXp",
  "dailyRewardTotalXp",
  "dailyRewardScore",
  "dailyRewardAccuracy",
  "dailyRewardContinueButton",
]);

function filesBelow(directory, suffix) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const location = path.join(directory, entry.name);
    return entry.isDirectory()
      ? filesBelow(location, suffix)
      : entry.name.endsWith(suffix)
        ? [location]
        : [];
  });
}

describe("EJS asset and DOM contracts", () => {
  const views = filesBelow(VIEW_ROOT, ".ejs").filter(
    (file) => !file.includes(`${path.sep}partials${path.sep}`),
  );

  test.each(views.map((file) => [path.relative(VIEW_ROOT, file), file]))(
    "%s references existing local assets",
    (_name, file) => {
      const html = fs.readFileSync(file, "utf8");
      const assets = [
        ...html.matchAll(/(?:src|href)=["'](\/(?:css|js)\/[^"']+)["']/g),
      ].map((match) => match[1]);
      for (const asset of assets)
        expect(fs.existsSync(path.join(CLIENT_ROOT, asset))).toBe(true);
    },
  );

  test.each(views.map((file) => [path.relative(VIEW_ROOT, file), file]))(
    "%s contains IDs required by its scripts",
    (_name, file) => {
      const html = fs.readFileSync(file, "utf8");
      const ids = new Set(
        [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]),
      );
      const scripts = [...html.matchAll(/src=["'](\/js\/[^"']+)["']/g)].map(
        (match) => path.join(CLIENT_ROOT, match[1]),
      );
      const missing = [];
      for (const script of scripts) {
        const source = fs.readFileSync(script, "utf8");
        const requiredIds = [
          ...source.matchAll(/document\.getElementById\(["']([^"']+)["']\)/g),
        ].map((match) => match[1]);
        for (const id of requiredIds) {
          if (!ids.has(id) && !OPTIONAL_IDS.has(id))
            missing.push(`${path.basename(script)}:${id}`);
        }
      }
      expect(missing).toEqual([]);
    },
  );
});
