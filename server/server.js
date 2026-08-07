"use strict";

require("dotenv").config({ quiet: true });

const http = require("http");

const app = require("./app");
const connectDatabase = require("./config/database");
const { validateEnvironment } = require("./config/env");

const PORT = Number(process.env.PORT) || 5000;

async function startServer() {
  try {
    validateEnvironment();
    await connectDatabase();

    const server = http.createServer(app);

    server.listen(PORT, () => {
      console.info(`🚀 Server running on http://localhost:${PORT}`);
    });

    process.on("unhandledRejection", (error) => {
      console.error("Unhandled rejection:", error);

      server.close(() => {
        process.exit(1);
      });
    });

    process.on("uncaughtException", (error) => {
      console.error("Uncaught exception:", error);

      server.close(() => {
        process.exit(1);
      });
    });

    process.on("SIGTERM", () => {
      console.info("SIGTERM received. Closing server...");

      server.close(() => {
        console.info("Server closed.");
        process.exit(0);
      });
    });

    process.on("SIGINT", () => {
      console.info("SIGINT received. Closing server...");

      server.close(() => {
        console.info("Server closed.");
        process.exit(0);
      });
    });
  } catch (error) {
    console.error("❌ Server failed to start:", error.message);

    process.exit(1);
  }
}

startServer();
