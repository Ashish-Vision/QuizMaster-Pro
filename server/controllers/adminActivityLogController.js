"use strict";

const ActivityLog = require("../models/ActivityLog");
const { createContainsSearch } = require("../utils/mongoSearch");
const { normalizeText } = require("../utils/normalize");
const {
  createPaginationMeta,
  parsePagination,
} = require("../utils/pagination");

function normalizeLog(log) {
  return {
    id: String(log._id),

    admin: log.admin
      ? {
          id: String(log.admin._id),
          firstName: log.admin.firstName || "",
          lastName: log.admin.lastName || "",
          fullName:
            `${log.admin.firstName || ""} ${log.admin.lastName || ""}`.trim() ||
            "Unknown Administrator",
          email: log.admin.email || "",
          avatar: log.admin.avatar || "",
        }
      : null,

    action: log.action || "",
    entityType: log.entityType || "",
    entityId: log.entityId || "",
    description: log.description || "",
    metadata: log.metadata || {},
    ipAddress: log.ipAddress || "",
    userAgent: log.userAgent || "",
    createdAt: log.createdAt || null,
  };
}

/**
 * GET /api/admin/activity-logs
 */
async function getActivityLogs(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 15,
    });

    const search = normalizeText(req.query.search);
    const action = normalizeText(req.query.action).toUpperCase();
    const entityType = normalizeText(req.query.entityType);

    const filter = {};

    if (action && action !== "ALL") {
      filter.action = action;
    }

    if (entityType && entityType !== "all") {
      filter.entityType = entityType;
    }

    Object.assign(
      filter,
      createContainsSearch(search, ["description", "entityId", "ipAddress"]),
    );

    const [logs, filteredCount] = await Promise.all([
      ActivityLog.find(filter)
        .populate({
          path: "admin",
          select: "firstName lastName email avatar",
        })
        .sort({
          createdAt: -1,
          _id: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      ActivityLog.countDocuments(filter),
    ]);

    const pagination = createPaginationMeta({
      page,
      limit,
      totalItems: filteredCount,
    });

    return res.status(200).json({
      success: true,

      filters: {
        search,
        action: action || "ALL",
        entityType: entityType || "all",
      },

      logs: logs.map(normalizeLog),

      pagination: {
        ...pagination,
        totalLogs: filteredCount,
      },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/admin/activity-logs/summary
 */
async function getActivityLogSummary(req, res, next) {
  try {
    const todayStart = new Date();

    todayStart.setUTCHours(0, 0, 0, 0);

    const [
      totalLogs,
      todayLogs,
      exportLogs,
      systemLogs,
      actionStatistics,
      entityStatistics,
    ] = await Promise.all([
      ActivityLog.countDocuments(),

      ActivityLog.countDocuments({
        createdAt: {
          $gte: todayStart,
        },
      }),

      ActivityLog.countDocuments({
        action: "EXPORT",
      }),

      ActivityLog.countDocuments({
        entityType: "System",
      }),

      ActivityLog.aggregate([
        {
          $group: {
            _id: "$action",
            count: {
              $sum: 1,
            },
          },
        },
        {
          $sort: {
            count: -1,
            _id: 1,
          },
        },
      ]),

      ActivityLog.aggregate([
        {
          $group: {
            _id: "$entityType",
            count: {
              $sum: 1,
            },
          },
        },
        {
          $sort: {
            count: -1,
            _id: 1,
          },
        },
      ]),
    ]);

    return res.status(200).json({
      success: true,

      summary: {
        totalLogs,
        todayLogs,
        exportLogs,
        systemLogs,
      },

      actionStatistics: actionStatistics.map((item) => ({
        action: item._id || "UNKNOWN",
        count: Number(item.count) || 0,
      })),

      entityStatistics: entityStatistics.map((item) => ({
        entityType: item._id || "Unknown",
        count: Number(item.count) || 0,
      })),
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getActivityLogs,
  getActivityLogSummary,
};
