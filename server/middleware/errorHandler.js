"use strict";

function notFoundHandler(req, res) {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

function errorHandler(error, req, res, next) {
  console.error(error);

  if (res.headersSent) {
    return next(error);
  }

  const statusCode = error.statusCode || 500;

  return res.status(statusCode).json({
    success: false,
    message:
      statusCode === 500 ? "An internal server error occurred." : error.message,
    ...(process.env.NODE_ENV === "development" && {
      stack: error.stack,
    }),
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
