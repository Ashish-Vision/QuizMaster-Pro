"use strict";

const {
  normalizeEmail,
  normalizeLowercaseText,
  normalizeText,
} = require("../server/utils/normalize");
const {
  createPaginationMeta,
  parsePagination,
} = require("../server/utils/pagination");
const {
  createContainsSearch,
  escapeRegex,
} = require("../server/utils/mongoSearch");

describe("maintainability utilities", () => {
  test("normalizes scalar text without coercing objects", () => {
    expect(normalizeText("  Quiz Master  ")).toBe("Quiz Master");
    expect(normalizeText({ value: "unsafe" })).toBe("");
    expect(normalizeLowercaseText("  ADMIN ")).toBe("admin");
    expect(normalizeEmail("  User@Example.COM ")).toBe("user@example.com");
  });

  test("parses pagination with explicit endpoint defaults and limits", () => {
    expect(
      parsePagination(
        { page: "3", limit: "250" },
        { defaultLimit: 10, maxLimit: 100 },
      ),
    ).toEqual({ page: 3, limit: 100, skip: 200 });
    expect(parsePagination({}, { defaultLimit: 15 })).toEqual({
      page: 1,
      limit: 15,
      skip: 0,
    });
    expect(
      parsePagination(
        { limit: "75" },
        { defaultLimit: 10, maxLimit: 50, clampLimit: false },
      ).limit,
    ).toBe(10);
  });

  test("creates backward-compatible pagination metadata", () => {
    expect(
      createPaginationMeta({ page: 2, limit: 10, totalItems: 21 }),
    ).toEqual({
      currentPage: 2,
      totalPages: 3,
      limit: 10,
      hasPreviousPage: true,
      hasNextPage: true,
    });
  });

  test("builds escaped multi-field MongoDB contains filters", () => {
    expect(escapeRegex("a+b@example.com")).toBe("a\\+b@example\\.com");
    expect(createContainsSearch("a+b", ["email", "firstName"])).toEqual({
      $or: [
        { email: { $regex: "a\\+b", $options: "i" } },
        { firstName: { $regex: "a\\+b", $options: "i" } },
      ],
    });
    expect(createContainsSearch("", ["email"])).toEqual({});
  });
});
