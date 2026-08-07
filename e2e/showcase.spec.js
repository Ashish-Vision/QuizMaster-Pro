"use strict";

const path = require("path");
const { pathToFileURL } = require("url");
const { test, expect } = require("@playwright/test");

const showcaseUrl = pathToFileURL(
  path.resolve(__dirname, "../docs/index.html"),
).href;

test("static showcase filters screenshots and opens the lightbox", async ({
  page,
}) => {
  await page.goto(showcaseUrl);

  const learnerCards = page.locator('[data-category="learner"]');
  const adminCards = page.locator('[data-category="admin"]');
  await expect(learnerCards).toHaveCount(14);
  await expect(adminCards).toHaveCount(11);

  await page.getByRole("button", { name: "Admin", exact: true }).click();
  await expect(learnerCards.first()).toBeHidden();
  await expect(adminCards.first()).toBeVisible();

  await page.getByRole("button", { name: "Learner", exact: true }).click();
  await expect(learnerCards.first()).toBeVisible();
  await expect(adminCards.first()).toBeHidden();

  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(learnerCards.first()).toBeVisible();
  await expect(adminCards.first()).toBeVisible();

  await learnerCards.first().locator("[data-lightbox]").click();
  await expect(page.locator("[data-lightbox-dialog]")).toBeVisible();
  await expect(page.locator("[data-lightbox-image]")).toHaveAttribute(
    "alt",
    /login page/i,
  );
  await page.locator("[data-lightbox-close]").click();
  await expect(page.locator("[data-lightbox-dialog]")).toBeHidden();
});
