"use strict";

const jwt = require("jsonwebtoken");
const {
  createAuthToken,
  verifyAuthToken,
  tokenVersionMatches,
} = require("../server/utils/authToken");
const {
  containsUnsafeKey,
} = require("../server/middleware/requestSecurityMiddleware");
const {
  detectAvatarMimeType,
  inspectAvatarImage,
} = require("../server/middleware/uploadMiddleware");
const { validateEnvironment } = require("../server/config/env");
const {
  validateNotificationLink,
} = require("../server/utils/notificationLinkValidator");
const { escapeCsvCell } = require("../server/utils/csv");

describe("security utilities", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret-that-is-longer-than-thirty-two-bytes";
    delete process.env.JWT_ISSUER;
    delete process.env.JWT_AUDIENCE;
  });

  test("JWT pins algorithm, issuer, audience, expiry, and token version", () => {
    const token = createAuthToken({ userId: "user-1", tokenVersion: 3 });
    const decoded = verifyAuthToken(token);
    expect(decoded).toMatchObject({
      userId: "user-1",
      tokenVersion: 3,
      iss: "quizmaster-pro",
      aud: "quizmaster-pro-users",
    });
    expect(jwt.decode(token, { complete: true }).header.alg).toBe("HS256");
    expect(decoded.exp).toBeGreaterThan(decoded.iat);
    expect(tokenVersionMatches(decoded.tokenVersion, 3)).toBe(true);
    expect(tokenVersionMatches(decoded.tokenVersion, 4)).toBe(false);
  });

  test("rejects operator and dotted keys recursively", () => {
    expect(containsUnsafeKey({ profile: { $where: "x" } })).toBe(true);
    expect(containsUnsafeKey({ "profile.name": "x" })).toBe(true);
    expect(containsUnsafeKey({ profile: { name: "safe" } })).toBe(false);
  });

  test("validates avatar file signatures", () => {
    expect(detectAvatarMimeType(Buffer.from([0xff, 0xd8, 0xff, 0x00]))).toBe(
      "image/jpeg",
    );
    expect(detectAvatarMimeType(Buffer.from("not an image"))).toBeNull();
  });

  test("rejects truncated, disguised, and unreasonable avatar images", () => {
    const png = Buffer.alloc(45);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png);
    png.writeUInt32BE(13, 8);
    png.write("IHDR", 12, "ascii");
    png.writeUInt32BE(64, 16);
    png.writeUInt32BE(64, 20);
    png.writeUInt32BE(0, 33);
    png.write("IEND", 37, "ascii");

    expect(inspectAvatarImage(png, "image/png")).toMatchObject({
      width: 64,
      height: 64,
    });
    expect(inspectAvatarImage(png.subarray(0, 24), "image/png")).toBeNull();
    expect(inspectAvatarImage(png, "image/jpeg")).toBeNull();
    png.writeUInt32BE(5000, 16);
    expect(inspectAvatarImage(png, "image/png")).toBeNull();
    expect(
      inspectAvatarImage(Buffer.from("<html>not an image</html>"), "image/png"),
    ).toBeNull();
  });

  test("production environment requires strong secret and matching HTTPS origins", () => {
    const valid = {
      NODE_ENV: "production",
      MONGODB_URI: "mongodb://db/app",
      JWT_SECRET: "x".repeat(32),
      APP_ORIGIN: "https://quiz.example",
      CLIENT_ORIGIN: "https://quiz.example",
    };
    expect(validateEnvironment(valid)).toMatchObject({
      production: true,
      appOrigin: "https://quiz.example",
    });
    expect(() =>
      validateEnvironment({ ...valid, JWT_SECRET: "short" }),
    ).toThrow(/32 bytes/);
    expect(() =>
      validateEnvironment({ ...valid, CLIENT_ORIGIN: "https://evil.example" }),
    ).toThrow(/same origin/);
    expect(() =>
      validateEnvironment({
        ...valid,
        APP_ORIGIN: "http://quiz.example",
        CLIENT_ORIGIN: "http://quiz.example",
      }),
    ).toThrow(/HTTPS/);
  });

  test("notification links and CSV cells are neutralized", () => {
    expect(validateNotificationLink("/history?page=1").isValid).toBe(true);
    expect(validateNotificationLink("javascript:alert(1)").isValid).toBe(false);
    expect(escapeCsvCell("=1+1")).toBe("'=1+1");
  });

  test.each([
    "",
    "/dashboard",
    "/profile",
    "/settings",
    "/achievements",
    "/result/valid-id",
  ])("accepts safe notification link %p", (link) =>
    expect(validateNotificationLink(link).isValid).toBe(true),
  );

  test.each([
    "//evil.example",
    "https://evil.example",
    "javascript:alert(1)",
    "data:text/html,test",
    "file:///tmp/test",
    "vbscript:msgbox(1)",
    "/\\evil",
    "/%5cevil",
    "/%5Cevil",
    "/bad%escape",
    "/line\rbreak",
    "/line\nbreak",
    "/tab\tbreak",
    "/null\0break",
  ])("rejects unsafe notification link %p", (link) => {
    expect(validateNotificationLink(link).isValid).toBe(false);
  });

  test.each([
    ['=HYPERLINK("https://evil.example")', "'=HYPERLINK"],
    ["+SUM(1,1)", '"\'+SUM(1,1)"'],
    ["-10+20", "'-10+20"],
    ["@SUM(A1:A2)", "'@SUM(A1:A2)"],
    ["\t=SUM(A1:A2)", "'\t=SUM(A1:A2)"],
    ["\r=SUM(A1:A2)", '"\'\r=SUM(A1:A2)"'],
    ["normal, value", '"normal, value"'],
    ['a"b', '"a""b"'],
    [null, ""],
    [undefined, ""],
    [42, "42"],
    ["नमस्ते", "नमस्ते"],
  ])("safely encodes CSV cell %p", (value, expected) => {
    expect(escapeCsvCell(value)).toContain(expected);
  });
});
