"use strict";

const mongoose = require("mongoose");

const Notification = require("../models/Notification");

function getUserId(req) {
  return req.user?._id || req.user?.id;
}

function normalizeLimit(value, fallback = 20, maximum = 100) {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    return fallback;
  }

  return Math.min(parsedValue, maximum);
}

function normalizePage(value) {
  const parsedValue = Number.parseInt(value, 10);

  return Number.isInteger(parsedValue) && parsedValue >= 1 ? parsedValue : 1;
}

async function getNotifications(req, res, next) {
  try {
    const userId = getUserId(req);

    const page = normalizePage(req.query.page);
    const limit = normalizeLimit(req.query.limit);

    const unreadOnly = String(req.query.unreadOnly).toLowerCase() === "true";

    const filter = {
      user: userId,
    };

    if (unreadOnly) {
      filter.isRead = false;
    }

    const skip = (page - 1) * limit;

    const [notifications, totalNotifications, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({
          createdAt: -1,
          _id: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      Notification.countDocuments(filter),

      Notification.countDocuments({
        user: userId,
        isRead: false,
      }),
    ]);

    const totalPages = Math.max(Math.ceil(totalNotifications / limit), 1);

    return res.status(200).json({
      success: true,

      unreadCount,

      notifications: notifications.map((notification) => ({
        id: notification._id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        icon: notification.icon,
        link: notification.link,
        metadata: notification.metadata || {},
        isRead: notification.isRead,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
      })),

      pagination: {
        currentPage: page,
        totalPages,
        totalNotifications,
        limit,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function getUnreadCount(req, res, next) {
  try {
    const unreadCount = await Notification.countDocuments({
      user: getUserId(req),
      isRead: false,
    });

    return res.status(200).json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    return next(error);
  }
}

async function markNotificationAsRead(req, res, next) {
  try {
    const { notificationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({
        success: false,
        message: "The notification ID is invalid.",
      });
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: notificationId,
        user: getUserId(req),
      },
      {
        isRead: true,
        readAt: new Date(),
      },
      {
        returnDocument: "after",
      },
    ).lean();

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as read.",
      notification: {
        id: notification._id,
        isRead: notification.isRead,
        readAt: notification.readAt,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function markAllNotificationsAsRead(req, res, next) {
  try {
    const result = await Notification.updateMany(
      {
        user: getUserId(req),
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      },
    );

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read.",
      modifiedCount: result.modifiedCount || 0,
    });
  } catch (error) {
    return next(error);
  }
}

async function deleteNotification(req, res, next) {
  try {
    const { notificationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({
        success: false,
        message: "The notification ID is invalid.",
      });
    }

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      user: getUserId(req),
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification deleted successfully.",
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
};
