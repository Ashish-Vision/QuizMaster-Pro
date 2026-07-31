"use strict";

require("dotenv").config();

const http = require("http");

const app = require("./app");
const connectDatabase = require("./config/database");

const PORT = Number(process.env.PORT) || 5000;

async function startServer() {
  try {
    await connectDatabase();

    const server = http.createServer(app);

    server.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });

    process.on("unhandledRejection", (error) => {
      console.error("Unhandled rejection:", error);

      server.close(() => {
        process.exit(1);
      });
    });

    process.on("SIGTERM", () => {
      console.log("SIGTERM received. Closing server.");

      server.close(() => {
        process.exit(0);
      });
    });
  } catch (error) {
    console.error("❌ Server failed to start:", error.message);

    process.exit(1);
  }
}

startServer();
