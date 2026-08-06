"use strict";

const fs = require("fs");

const MONGODB_VERSION = "8.0.28";
const DEFAULT_SYSTEM_BINARY = "/usr/bin/mongod";

function getMongoBinaryOptions() {
  const systemBinary =
    process.env.MONGOMS_SYSTEM_BINARY || DEFAULT_SYSTEM_BINARY;

  return {
    version: MONGODB_VERSION,
    ...(fs.existsSync(systemBinary) && { systemBinary }),
  };
}

module.exports = {
  MONGODB_VERSION,
  getMongoBinaryOptions,
};
