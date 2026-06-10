'use strict';

const prisma = require('../config/database');
const systemService = require('../services/systemService');
const logger = require('../utils/logger');

async function getStats(req, res) {
  try {
    const isAdmin = req.user.role === 'admin';
    const userId = req.user.id;

    const [systemStats, domainCount, emailCount, ftpCount, dbCount, sslStats] = await Promise.all([
      systemService.getSystemStats(),
      prisma.domain.count(isAdmin ? {} : { where: { userId } }),
      prisma.emailAccount.count(isAdmin ? {} : { where: { userId } }),
      prisma.ftpAccount.count(isAdmin ? {} : { where: { userId } }),
      prisma.database.count(isAdmin ? {} : { where: { userId } }),
      prisma.sslCertificate.groupBy({
        by: ['status'],
        _count: { id: true },
        where: isAdmin ? {} : { domain: { userId } },
      }),
    ]);

    const sslStatusMap = {};
    sslStats.forEach(s => { sslStatusMap[s.status] = s._count.id; });

    const disk0 = Array.isArray(systemStats.disk) ? systemStats.disk[0] : null;
    const flatSystem = {
      cpuPercent: systemStats.cpu?.loadPercent ?? 0,
      ramPercent: systemStats.ram?.usedPercent ?? 0,
      ramUsedGb: (systemStats.ram?.usedMB ?? 0) / 1024,
      ramTotalGb: (systemStats.ram?.totalMB ?? 0) / 1024,
      diskPercent: disk0?.usedPercent ?? 0,
      diskUsedGb: (disk0?.usedMB ?? 0) / 1024,
      diskTotalGb: (disk0?.totalMB ?? 0) / 1024,
      uptime: systemStats.uptime?.uptimeFormatted ?? '',
    };

    return res.json({
      success: true,
      data: {
        system: flatSystem,
        resources: {
          domains: domainCount,
          emailAccounts: emailCount,
          ftpAccounts: ftpCount,
          databases: dbCount,
          ssl: sslStatusMap,
        },
      },
    });
  } catch (err) {
    logger.error('Dashboard stats error', { error: err.message });
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function getRecentActivity(req, res) {
  try {
    const where = req.user.role === 'admin' ? {} : { userId: req.user.id };
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        user: { select: { username: true, email: true } },
      },
    });
    return res.json({ success: true, data: logs });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function getAlerts(req, res) {
  try {
    const notifications = await prisma.notification.findMany({
      where: {
        userId: req.user.id,
        isRead: false,
        type: { in: ['error', 'warning'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return res.json({ success: true, data: notifications });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function getServiceStatus(req, res) {
  try {
    const statuses = await systemService.getAllServicesStatus();
    return res.json({ success: true, data: statuses });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { getStats, getRecentActivity, getAlerts, getServiceStatus };
