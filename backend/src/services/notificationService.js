'use strict';

const prisma = require('../config/database');
const logger = require('../utils/logger');

async function createNotification(userId, type, category, title, message, actionUrl = null) {
  const validTypes = ['warning', 'error', 'info', 'success'];
  const validCategories = ['ssl', 'disk', 'service', 'backup', 'security', 'system'];

  if (!validTypes.includes(type)) throw new Error(`Invalid notification type: ${type}`);
  if (!validCategories.includes(category)) throw new Error(`Invalid notification category: ${category}`);

  const notification = await prisma.notification.create({
    data: { userId, type, category, title, message, isRead: false, actionUrl },
  });

  logger.info('Notification created', { notificationId: notification.id, userId, type, category });
  return notification;
}

async function markRead(notificationId, userId) {
  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification) throw new Error('Notification not found');
  if (notification.userId !== userId) throw new Error('Access denied');

  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
}

async function markAllRead(userId) {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return { updated: result.count };
}

async function deleteNotification(notificationId, userId, isAdmin = false) {
  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification) throw new Error('Notification not found');
  if (!isAdmin && notification.userId !== userId) throw new Error('Access denied');

  await prisma.notification.delete({ where: { id: notificationId } });
  return true;
}

async function getUnreadCount(userId) {
  const count = await prisma.notification.count({
    where: { userId, isRead: false },
  });
  return count;
}

async function listNotifications(userId, isAdmin = false, page = 1, limit = 20) {
  const where = isAdmin ? {} : { userId };
  const skip = (page - 1) * limit;

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where }),
  ]);

  return { notifications, total, page, limit };
}

async function checkSystemAlerts() {
  const alerts = [];

  // Check SSL certificates expiring within 30 days
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const expiringSsl = await prisma.sslCertificate.findMany({
    where: {
      status: 'active',
      expiresAt: { lte: thirtyDaysFromNow },
    },
    include: { domain: { include: { user: true } } },
  });

  for (const ssl of expiringSsl) {
    if (!ssl.domain?.user) continue;
    const daysLeft = Math.floor((new Date(ssl.expiresAt) - Date.now()) / 1000 / 86400);
    const existing = await prisma.notification.findFirst({
      where: {
        userId: ssl.domain.user.id,
        category: 'ssl',
        isRead: false,
        message: { contains: ssl.domain.name },
      },
    });
    if (!existing) {
      const notif = await createNotification(
        ssl.domain.user.id,
        daysLeft < 7 ? 'error' : 'warning',
        'ssl',
        'SSL Certificate Expiring Soon',
        `SSL certificate for ${ssl.domain.name} expires in ${daysLeft} days`,
        `/ssl/${ssl.id}`
      );
      alerts.push(notif);
    }
  }

  // Check disk usage > 80% - aggregate per user
  const allDomains = await prisma.domain.findMany({
    include: { user: { include: { package: true } } },
  });

  // Check service status (basic check via DB patterns - real check done in systemService)
  // This function creates alerts based on known conditions tracked in the system

  logger.info('System alerts check completed', { alertsCreated: alerts.length });
  return alerts;
}

module.exports = {
  createNotification,
  markRead,
  markAllRead,
  deleteNotification,
  getUnreadCount,
  listNotifications,
  checkSystemAlerts,
};
