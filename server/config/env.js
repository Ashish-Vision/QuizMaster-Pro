"use strict";

const MINIMUM_JWT_SECRET_BYTES = 32;

function parseOrigin(name, value, { required = false, https = false } = {}) {
  if (!value) {
    if (required) throw new Error(`${name} is required.`);
    return null;
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid absolute URL.`);
  }

  if (
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error(
      `${name} must contain only a scheme, host, and optional port.`,
    );
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`${name} must use HTTP or HTTPS.`);
  }
  if (https && url.protocol !== "https:") {
    throw new Error(`${name} must use HTTPS in production.`);
  }
  return url.origin;
}

function validateEnvironment(environment = process.env) {
  const production = environment.NODE_ENV === "production";
  const missing = ["MONGODB_URI", "JWT_SECRET"].filter(
    (name) => !environment[name],
  );
  if (missing.length)
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}.`,
    );

  if (
    Buffer.byteLength(environment.JWT_SECRET || "", "utf8") <
    MINIMUM_JWT_SECRET_BYTES
  ) {
    throw new Error(
      `JWT_SECRET must be at least ${MINIMUM_JWT_SECRET_BYTES} bytes.`,
    );
  }

  const appOrigin = parseOrigin("APP_ORIGIN", environment.APP_ORIGIN, {
    required: production,
    https: production,
  });
  const clientOrigin = parseOrigin("CLIENT_ORIGIN", environment.CLIENT_ORIGIN, {
    required: production,
    https: production,
  });

  if (production && appOrigin !== clientOrigin) {
    throw new Error(
      "APP_ORIGIN and CLIENT_ORIGIN must be the same origin in production.",
    );
  }

  return { appOrigin, clientOrigin, production };
}

module.exports = { MINIMUM_JWT_SECRET_BYTES, parseOrigin, validateEnvironment };
