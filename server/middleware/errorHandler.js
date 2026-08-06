"use strict";

function notFoundHandler(req, res) {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || 500;

  if (statusCode >= 500) {
    if (process.env.NODE_ENV === "development") {
      console.error(error);
    } else {
      console.error({
        message: "Request failed with an internal error.",
        method: req.method,
        path: req.path,
        statusCode,
      });
    }
  }

  if (res.headersSent) {
    return next(error);
  }

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
