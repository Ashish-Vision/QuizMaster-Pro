"use strict";

const mongoose = require("mongoose");

const { logRequestActivity } = require("../services/activityLogService");

const Notification = require("../models/Notification");
const User = require("../models/User");

const ALLOWED_TYPES = new Set([
  "quiz",
  "achievement",
  "xp",
  "streak",
  "account",
  "system",
]);

const ALLOWED_RECIPIENT_GROUPS = new Set(["all", "users", "admins", "single"]);

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
    return 10;
  }

  return Math.min(parsed, 100);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeNotification(notification) {
  return {
    id: String(notification._id),

    user: notification.user
      ? {
          id: String(notification.user._id),
          firstName: notification.user.firstName || "",
          lastName: notification.user.lastName || "",
          fullName:
            `${notification.user.firstName || ""} ${
              notification.user.lastName || ""
            }`.trim() || "Unknown User",
          email: notification.user.email || "",
          role: notification.user.role || "user",
          avatar: notification.user.avatar || "",
        }
      : null,

    type: notification.type || "system",
    title: notification.title || "",
    message: notification.message || "",
    icon: notification.icon || "🔔",
    link: notification.link || "",
    metadata: notification.metadata || {},
    isRead: Boolean(notification.isRead),
    readAt: notification.readAt || null,
    createdAt: notification.createdAt || null,
  };
}

/**
 * GET /api/admin/notifications
 */
async function getAdminNotifications(req, res, next) {
  try {
    const page = normalizePage(req.query.page);
    const limit = normalizeLimit(req.query.limit);

    const search = normalizeText(req.query.search);
    const type = normalizeText(req.query.type).toLowerCase() || "all";
    const status = normalizeText(req.query.status).toLowerCase() || "all";

    if (type !== "all" && !ALLOWED_TYPES.has(type)) {
      return res.status(400).json({
        success: false,
        message: "Notification type filter is invalid.",
      });
    }

    if (!["all", "read", "unread"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Notification status filter is invalid.",
      });
    }

    const filter = {};

    if (type !== "all") {
      filter.type = type;
    }

    if (status === "read") {
      filter.isRead = true;
    }

    if (status === "unread") {
      filter.isRead = false;
    }

    if (search) {
      const safeSearch = escapeRegex(search);

      filter.$or = [
        {
          title: {
            $regex: safeSearch,
            $options: "i",
          },
        },
        {
          message: {
            $regex: safeSearch,
            $options: "i",
          },
        },
      ];
    }

    const skip = (page - 1) * limit;

    const [
      notifications,
      filteredCount,
      totalNotifications,
      unreadNotifications,
      readNotifications,
      users,
      totalRecipients,
    ] = await Promise.all([
      Notification.find(filter)
        .populate({
          path: "user",
          select: "firstName lastName email role avatar",
        })
        .sort({
          createdAt: -1,
          _id: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      Notification.countDocuments(filter),

      Notification.countDocuments(),

      Notification.countDocuments({
        isRead: false,
      }),

      Notification.countDocuments({
        isRead: true,
      }),

      User.find({
        isActive: {
          $ne: false,
        },
      })
        .select("firstName lastName email role avatar")
        .sort({
          firstName: 1,
          lastName: 1,
          _id: 1,
        })
        .lean(),

      User.countDocuments({
        isActive: {
          $ne: false,
        },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(filteredCount / limit));

    return res.status(200).json({
      success: true,

      summary: {
        totalNotifications,
        unreadNotifications,
        readNotifications,
        totalRecipients,
      },

      filters: {
        search,
        type,
        status,
      },

      notifications: notifications.map(normalizeNotification),

      users: users.map((user) => ({
        id: String(user._id),
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        fullName:
          `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
          "Unknown User",
        email: user.email || "",
        role: user.role || "user",
        avatar: user.avatar || "",
      })),

      pagination: {
        currentPage: page,
        totalPages,
        totalNotifications: filteredCount,
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
 * POST /api/admin/notifications
 */
async function createAdminNotification(req, res, next) {
  try {
    const recipientGroup =
      normalizeText(req.body.recipientGroup).toLowerCase() || "all";

    const userId = normalizeText(req.body.userId);
    const type = normalizeText(req.body.type).toLowerCase() || "system";
    const title = normalizeText(req.body.title);
    const message = normalizeText(req.body.message);
    const icon = normalizeText(req.body.icon) || "🔔";
    const link = normalizeText(req.body.link);

    if (!ALLOWED_RECIPIENT_GROUPS.has(recipientGroup)) {
      return res.status(400).json({
        success: false,
        message: "Recipient group is invalid.",
      });
    }

    if (!ALLOWED_TYPES.has(type)) {
      return res.status(400).json({
        success: false,
        message: "Notification type is invalid.",
      });
    }

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: "Notification title and message are required.",
      });
    }

    if (title.length > 120) {
      return res.status(400).json({
        success: false,
        message: "Title cannot exceed 120 characters.",
      });
    }

    if (message.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Message cannot exceed 500 characters.",
      });
    }

    if (icon.length > 20) {
      return res.status(400).json({
        success: false,
        message: "Notification icon cannot exceed 20 characters.",
      });
    }

    if (link.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Notification link cannot exceed 500 characters.",
      });
    }

    const recipientFilter = {
      isActive: {
        $ne: false,
      },
    };

    if (recipientGroup === "users") {
      recipientFilter.role = "user";
    }

    if (recipientGroup === "admins") {
      recipientFilter.role = "admin";
    }

    if (recipientGroup === "single") {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
          success: false,
          message: "A valid user must be selected.",
        });
      }

      recipientFilter._id = userId;
    }

    const recipients = await User.find(recipientFilter).select("_id").lean();

    if (recipients.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No eligible recipients were found.",
      });
    }

    const batchId = new mongoose.Types.ObjectId().toString();

    const documents = recipients.map((recipient) => ({
      user: recipient._id,
      type,
      title,
      message,
      icon,
      link,
      metadata: {
        source: "admin",
        batchId,
        recipientGroup,
        createdBy: String(req.user._id),
      },
    }));

    const createdNotifications = await Notification.insertMany(documents);

    await logRequestActivity({
      req,
      action: "SEND",
      entityType: "Notification",
      entityId: batchId,
      description: `Sent notification "${title}" to ${
        createdNotifications.length
      } recipient${createdNotifications.length === 1 ? "" : "s"}.`,
      metadata: {
        batchId,
        recipientGroup,
        recipientCount: createdNotifications.length,
        selectedUserId: recipientGroup === "single" ? userId : null,
        type,
        title,
        icon,
        link,
      },
    });

    return res.status(201).json({
      success: true,

      message: `Notification sent to ${
        createdNotifications.length
      } recipient${createdNotifications.length === 1 ? "" : "s"}.`,

      result: {
        batchId,
        recipientGroup,
        recipientCount: createdNotifications.length,
        type,
        title,
      },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * DELETE /api/admin/notifications/:notificationId
 */
async function deleteAdminNotification(req, res, next) {
  try {
    const { notificationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({
        success: false,
        message: "Notification ID is invalid.",
      });
    }

    const notification = await Notification.findByIdAndDelete(notificationId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification was not found.",
      });
    }

    await logRequestActivity({
      req,
      action: "DELETE",
      entityType: "Notification",
      entityId: notificationId,
      description: `Deleted notification "${notification.title}".`,
      metadata: {
        notificationId,
        title: notification.title,
        type: notification.type,
        recipientUserId: String(notification.user),
        batchId: notification.metadata?.batchId || null,
        source: notification.metadata?.source || null,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Notification deleted successfully.",
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * DELETE /api/admin/notifications/batch/:batchId
 */
async function deleteNotificationBatch(req, res, next) {
  try {
    const batchId = normalizeText(req.params.batchId);

    if (!batchId) {
      return res.status(400).json({
        success: false,
        message: "Notification batch ID is required.",
      });
    }

    const result = await Notification.deleteMany({
      "metadata.batchId": batchId,
      "metadata.source": "admin",
    });

    if (!result.deletedCount) {
      return res.status(404).json({
        success: false,
        message: "Notification batch was not found.",
      });
    }

    await logRequestActivity({
      req,
      action: "DELETE",
      entityType: "Notification",
      entityId: batchId,
      description: `Deleted notification broadcast containing ${
        result.deletedCount
      } notification${result.deletedCount === 1 ? "" : "s"}.`,
      metadata: {
        batchId,
        deletedCount: result.deletedCount,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Notification broadcast deleted successfully.",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getAdminNotifications,
  createAdminNotification,
  deleteAdminNotification,
  deleteNotificationBatch,
};
