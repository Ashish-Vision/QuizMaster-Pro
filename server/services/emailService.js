"use strict";

const nodemailer = require("nodemailer");

let transporter = null;

function parseBoolean(value) {
  return String(value).trim().toLowerCase() === "true";
}

function getEmailConfiguration() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number.parseInt(process.env.SMTP_PORT, 10);
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  const fromName = process.env.EMAIL_FROM_NAME?.trim() || "QuizMaster Pro";
  const fromAddress = process.env.EMAIL_FROM_ADDRESS?.trim() || user;

  if (!host) {
    throw new Error("SMTP_HOST is not configured.");
  }

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("SMTP_PORT must be a valid port number.");
  }

  if (!user) {
    throw new Error("SMTP_USER is not configured.");
  }

  if (!password) {
    throw new Error("SMTP_PASSWORD is not configured.");
  }

  if (!fromAddress) {
    throw new Error("EMAIL_FROM_ADDRESS is not configured.");
  }

  return {
    host,
    port,
    secure: parseBoolean(process.env.SMTP_SECURE),
    user,
    password,
    fromName,
    fromAddress,
  };
}

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const config = getEmailConfiguration();

  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,

    auth: {
      user: config.user,
      pass: config.password,
    },

    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });

  return transporter;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function verifyEmailConnection() {
  const mailTransporter = getTransporter();

  await mailTransporter.verify();

  return true;
}

async function sendPasswordResetEmail({
  to,
  firstName,
  resetUrl,
  expiresInMinutes = 15,
}) {
  if (!to || !resetUrl) {
    throw new Error("Recipient email and reset URL are required.");
  }

  const config = getEmailConfiguration();
  const mailTransporter = getTransporter();

  const safeName = escapeHtml(firstName || "QuizMaster");
  const safeResetUrl = escapeHtml(resetUrl);
  const safeExpiry = Number(expiresInMinutes) || 15;

  const subject = "Reset your QuizMaster Pro password";

  const text = [
    `Hello ${firstName || "QuizMaster"},`,
    "",
    "We received a request to reset your QuizMaster Pro password.",
    "",
    `Reset your password using this link: ${resetUrl}`,
    "",
    `This link expires in ${safeExpiry} minutes.`,
    "",
    "If you did not request a password reset, you can ignore this email.",
    "",
    "QuizMaster Pro",
  ].join("\n");

  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        >
        <title>Password Reset</title>
      </head>

      <body
        style="
          margin: 0;
          padding: 32px 16px;
          background: #07111f;
          color: #f6f8fc;
          font-family: Arial, Helvetica, sans-serif;
        "
      >
        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          border="0"
        >
          <tr>
            <td align="center">
              <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                border="0"
                style="
                  max-width: 600px;
                  border: 1px solid rgba(255,255,255,0.12);
                  border-radius: 20px;
                  background: #0d1b2d;
                  overflow: hidden;
                "
              >
                <tr>
                  <td
                    style="
                      padding: 28px;
                      background: linear-gradient(
                        135deg,
                        #7c5cff,
                        #14c8e8
                      );
                    "
                  >
                    <h1
                      style="
                        margin: 0;
                        color: #ffffff;
                        font-size: 25px;
                      "
                    >
                      QuizMaster Pro
                    </h1>

                    <p
                      style="
                        margin: 8px 0 0;
                        color: rgba(255,255,255,0.86);
                      "
                    >
                      Password recovery
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 32px 28px;">
                    <h2
                      style="
                        margin: 0;
                        color: #f6f8fc;
                      "
                    >
                      Hello ${safeName},
                    </h2>

                    <p
                      style="
                        margin: 18px 0 0;
                        color: #9cabbe;
                        line-height: 1.7;
                      "
                    >
                      We received a request to reset your QuizMaster Pro
                      password. Use the button below to create a new password.
                    </p>

                    <table
                      role="presentation"
                      cellspacing="0"
                      cellpadding="0"
                      border="0"
                      style="margin-top: 26px;"
                    >
                      <tr>
                        <td
                          style="
                            border-radius: 12px;
                            background: #7c5cff;
                          "
                        >
                          <a
                            href="${safeResetUrl}"
                            style="
                              display: inline-block;
                              padding: 14px 22px;
                              color: #ffffff;
                              text-decoration: none;
                              font-weight: bold;
                            "
                          >
                            Reset Password
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p
                      style="
                        margin: 24px 0 0;
                        color: #9cabbe;
                        line-height: 1.7;
                      "
                    >
                      This link expires in
                      <strong style="color: #f6f8fc;">
                        ${safeExpiry} minutes
                      </strong>.
                    </p>

                    <p
                      style="
                        margin: 16px 0 0;
                        color: #9cabbe;
                        line-height: 1.7;
                      "
                    >
                      If you did not request this change, no action is required.
                    </p>

                    <div
                      style="
                        margin-top: 24px;
                        padding-top: 20px;
                        border-top: 1px solid rgba(255,255,255,0.1);
                      "
                    >
                      <p
                        style="
                          margin: 0;
                          color: #9cabbe;
                          font-size: 13px;
                          line-height: 1.6;
                          word-break: break-all;
                        "
                      >
                        If the button does not work, copy this URL:
                        <br>
                        ${safeResetUrl}
                      </p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const info = await mailTransporter.sendMail({
    from: {
      name: config.fromName,
      address: config.fromAddress,
    },

    to,
    subject,
    text,
    html,
  });

  return {
    messageId: info.messageId,
    accepted: info.accepted || [],
    rejected: info.rejected || [],
  };
}

module.exports = {
  verifyEmailConnection,
  sendPasswordResetEmail,
};
