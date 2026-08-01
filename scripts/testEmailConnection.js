"use strict";

require("dotenv").config();

const { verifyEmailConnection } = require("../server/services/emailService");

async function testEmailConnection() {
  try {
    await verifyEmailConnection();

    console.log("✅ SMTP connection verified successfully.");
    process.exit(0);
  } catch (error) {
    console.error("❌ SMTP connection verification failed:", error.message);

    process.exit(1);
  }
}

testEmailConnection();
