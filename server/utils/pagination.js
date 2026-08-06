"use strict";

function parsePositiveInteger(value, fallback) {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isInteger(parsedValue) && parsedValue > 0
    ? parsedValue
    : fallback;
}

function parsePagination(
  query = {},
  {
    defaultPage = 1,
    defaultLimit = 20,
    maxLimit = 100,
    clampLimit = true,
  } = {},
) {
  const page = parsePositiveInteger(query.page, defaultPage);
  const requestedLimit = parsePositiveInteger(query.limit, defaultLimit);
  const limit =
    requestedLimit <= maxLimit
      ? requestedLimit
      : clampLimit
        ? maxLimit
        : defaultLimit;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

function createPaginationMeta({ page, limit, totalItems }) {
  const totalPages = Math.max(Math.ceil(totalItems / limit), 1);

  return {
    currentPage: page,
    totalPages,
    limit,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
  };
}

module.exports = {
  createPaginationMeta,
  parsePagination,
  parsePositiveInteger,
};
