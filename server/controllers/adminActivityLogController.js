"use strict";

const ActivityLog = require("../models/ActivityLog");

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePage(value) {
  const parsed = Number.parseInt(value, 10);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeLimit(value) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return 15;
  }

  return Math.min(parsed, 100);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
    const page = normalizePage(req.query.page);
    const limit = normalizeLimit(req.query.limit);

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

    if (search) {
      const safeSearch = escapeRegex(search);

      filter.$or = [
        {
          description: {
            $regex: safeSearch,
            $options: "i",
          },
        },
        {
          entityId: {
            $regex: safeSearch,
            $options: "i",
          },
        },
        {
          ipAddress: {
            $regex: safeSearch,
            $options: "i",
          },
        },
      ];
    }

    const skip = (page - 1) * limit;

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

    const totalPages = Math.max(1, Math.ceil(filteredCount / limit));

    return res.status(200).json({
      success: true,

      filters: {
        search,
        action: action || "ALL",
        entityType: entityType || "all",
      },

      logs: logs.map(normalizeLog),

      pagination: {
        currentPage: page,
        totalPages,
        totalLogs: filteredCount,
        limit,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
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
