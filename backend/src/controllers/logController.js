'use strict';

const fs = require('fs').promises;
const path = require('path');
const prisma = require('../config/database');
const logger = require('../utils/logger');

const LOG_DIRS = {
  access: '/var/log/nginx',
  error: '/var/log/nginx',
  mail: '/var/log/mail.log',
  ftp: '/var/log/vsftpd.log',
  dns: '/var/log/named',
};

async function readTailLines(filePath, lines = 200) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return content.split('\n').slice(-lines).join('\n');
  } catch {
    return '';
  }
}

async function getAccessLog(req, res) {
  try {
    const { domainId } = req.params;
    const { lines = 200 } = req.query;

    const domain = await prisma.domain.findFirst({
      where: { id: domainId, ...(req.user.role !== 'admin' ? { userId: req.user.id } : {}) },
    });
    if (!domain) return res.status(404).json({ success: false, message: 'Domain bulunamadı' });

    const logFile = path.join(LOG_DIRS.access, `${domain.name}.access.log`);
    const content = await readTailLines(logFile, parseInt(lines));
    res.json({ success: true, data: { log: content, file: logFile } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getErrorLog(req, res) {
  try {
    const { domainId } = req.params;
    const { lines = 200 } = req.query;

    const domain = await prisma.domain.findFirst({
      where: { id: domainId, ...(req.user.role !== 'admin' ? { userId: req.user.id } : {}) },
    });
    if (!domain) return res.status(404).json({ success: false, message: 'Domain bulunamadı' });

    const logFile = path.join(LOG_DIRS.error, `${domain.name}.error.log`);
    const content = await readTailLines(logFile, parseInt(lines));
    res.json({ success: true, data: { log: content, file: logFile } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getMailLog(req, res) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Yönetici yetkisi gerekli' });
    }
    const { lines = 200 } = req.query;
    const content = await readTailLines(LOG_DIRS.mail, parseInt(lines));
    res.json({ success: true, data: { log: content } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getFtpLog(req, res) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Yönetici yetkisi gerekli' });
    }
    const { lines = 200 } = req.query;
    const content = await readTailLines(LOG_DIRS.ftp, parseInt(lines));
    res.json({ success: true, data: { log: content } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getPanelLog(req, res) {
  try {
    const { page = 1, limit = 50, action, status } = req.query;
    const where = req.user.role !== 'admin' ? { userId: req.user.id } : {};
    if (action) where.action = { contains: action };
    if (status) where.status = status;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { username: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ success: true, data: { logs, total, page: parseInt(page) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getSslLog(req, res) {
  try {
    const logFile = '/var/log/letsencrypt/letsencrypt.log';
    const { lines = 100 } = req.query;
    const content = await readTailLines(logFile, parseInt(lines));
    res.json({ success: true, data: { log: content } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { getAccessLog, getErrorLog, getMailLog, getFtpLog, getPanelLog, getSslLog };
