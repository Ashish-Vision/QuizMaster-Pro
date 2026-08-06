"use strict";

function notFoundHandler(req, res) {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

function errorHandler(error, req, res, next) {
  let statusCode = error.statusCode || error.status || 500;
  let message = error.message;

  if (error.type === "entity.parse.failed" || error instanceof SyntaxError) {
    statusCode = 400;
    message = "The request body contains invalid JSON.";
  } else if (error.name === "ValidationError") {
    statusCode = 400;
    message =
      Object.values(error.errors || {})[0]?.message ||
      "The request contains invalid data.";
  } else if (error.name === "CastError") {
    statusCode = 400;
    message = "The request contains an invalid identifier.";
  } else if (error.code === 11000) {
    statusCode = 409;
    message = "A record with that value already exists.";
  }

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
    message: statusCode >= 500 ? "An internal server error occurred." : message,
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
