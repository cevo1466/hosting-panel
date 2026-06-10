'use strict';

const prisma = require('../config/database');
const { runCommand, fail2banClient } = require('../utils/shell');
const { createAuditLog } = require('../middleware/audit');
const logger = require('../utils/logger');

async function getAuditLogs(req, res) {
  try {
    const { page = 1, limit = 50, userId, action, status, from, to } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (req.user.role !== 'admin') where.userId = req.user.id;
    else if (userId) where.userId = userId;
    if (action) where.action = { contains: action };
    if (status) where.status = status;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { username: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ success: true, data: { logs, total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) {
    logger.error('Audit log error', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getLoginAttempts(req, res) {
  try {
    const attempts = await prisma.auditLog.findMany({
      where: { action: 'LOGIN', status: 'failed' },
      include: { user: { select: { username: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ success: true, data: attempts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getFail2banStatus(req, res) {
  try {
    const status = await fail2banClient(['status']);
    if (!status.success) {
      return res.json({ success: true, data: { enabled: false, jails: [] } });
    }
    const m = status.stdout.match(/Jail list:\s*(.*)/);
    const jailNames = m ? m[1].split(',').map(s => s.trim()).filter(Boolean) : [];
    const jails = await Promise.all(jailNames.map(async (name) => {
      const js = await fail2banClient(['status', name]);
      const cb = js.success ? js.stdout.match(/Currently banned:\s*(\d+)/) : null;
      const tb = js.success ? js.stdout.match(/Total banned:\s*(\d+)/) : null;
      return {
        name,
        status: 'active',
        currentlyBanned: cb ? parseInt(cb[1], 10) : 0,
        totalBanned: tb ? parseInt(tb[1], 10) : 0,
      };
    }));
    res.json({ success: true, data: { enabled: true, jails } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function blockIp(req, res) {
  try {
    const { ip } = req.body;
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
      return res.status(400).json({ success: false, message: 'Geçersiz IP adresi' });
    }

    const result = await fail2banClient(['set', 'ssh', 'banip', ip]);
    await createAuditLog({ userId: req.user.id, action: 'IP_BLOCK', resource: 'security', resourceId: ip, ipAddress: req.ip });
    res.json({ success: result.success, message: `${ip} engellendi` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function unblockIp(req, res) {
  try {
    const { ip } = req.params;
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
      return res.status(400).json({ success: false, message: 'Geçersiz IP adresi' });
    }

    const result = await fail2banClient(['set', 'ssh', 'unbanip', ip]);
    await createAuditLog({ userId: req.user.id, action: 'IP_UNBLOCK', resource: 'security', resourceId: ip, ipAddress: req.ip });
    res.json({ success: result.success, message: `${ip} engeli kaldırıldı` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { getAuditLogs, getLoginAttempts, getFail2banStatus, blockIp, unblockIp };
