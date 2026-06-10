'use strict';

const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

async function list(req, res) {
  try {
    const prisma = require('../config/database');
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ success: true, data: notifications });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getUnread(req, res) {
  try {
    const prisma = require('../config/database');
    const [notifications, count] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user.id, isRead: false },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      notificationService.getUnreadCount(req.user.id),
    ]);
    res.json({ success: true, data: { notifications, count } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function markRead(req, res) {
  try {
    await notificationService.markRead(req.params.id, req.user.id);
    res.json({ success: true, message: 'Bildirim okundu olarak işaretlendi' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function markAllRead(req, res) {
  try {
    await notificationService.markAllRead(req.user.id);
    res.json({ success: true, message: 'Tüm bildirimler okundu' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function remove(req, res) {
  try {
    await notificationService.deleteNotification(req.params.id, req.user.id);
    res.json({ success: true, message: 'Bildirim silindi' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { list, getUnread, markRead, markAllRead, remove };
