'use strict';

const backupService = require('../services/backupService');
const { createAuditLog } = require('../middleware/audit');
const logger = require('../utils/logger');
const prisma = require('../config/database');

function isAdmin(req) {
  return req.user.role === 'admin';
}

async function assertDomainAccess(domainId, req) {
  const where = { id: domainId };
  if (!isAdmin(req)) where.userId = req.user.id;
  const domain = await prisma.domain.findFirst({ where, select: { id: true } });
  if (!domain) throw new Error('Domain not found or access denied');
}

async function assertBackupAccess(backupId, req) {
  const backup = await prisma.backup.findUnique({ where: { id: backupId } });
  if (!backup) throw new Error('Backup not found');
  if (!isAdmin(req) && backup.userId !== req.user.id) throw new Error('Access denied');
  return backup;
}

async function list(req, res) {
  try {
    const { domainId } = req.query;
    const backups = await backupService.listBackups(domainId, req.user.id, isAdmin(req));
    res.json({ success: true, data: backups });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function create(req, res) {
  try {
    const { domainId, type } = req.body;
    await assertDomainAccess(domainId, req);
    const backup = await backupService.createBackup(domainId, req.user.id, type);
    await createAuditLog({ userId: req.user.id, action: 'BACKUP_CREATE', resource: 'backup', resourceId: backup.id, ipAddress: req.ip });
    res.status(201).json({ success: true, message: 'Yedekleme başlatıldı', data: backup });
  } catch (err) {
    logger.error('Backup create error', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
}

async function restore(req, res) {
  try {
    const { id } = req.params;
    await assertBackupAccess(id, req);
    await backupService.restoreBackup(id);
    await createAuditLog({ userId: req.user.id, action: 'BACKUP_RESTORE', resource: 'backup', resourceId: id, ipAddress: req.ip });
    res.json({ success: true, message: 'Geri yükleme başlatıldı' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function schedule(req, res) {
  try {
    const { domainId, cronExpression, type } = req.body;
    await assertDomainAccess(domainId, req);
    const backup = await backupService.scheduleBackup(domainId, req.user.id, cronExpression, type);
    res.json({ success: true, message: 'Yedekleme planlandı', data: backup });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function remove(req, res) {
  try {
    const { id } = req.params;
    await assertBackupAccess(id, req);
    await backupService.deleteBackup(id);
    await createAuditLog({ userId: req.user.id, action: 'BACKUP_DELETE', resource: 'backup', resourceId: id, ipAddress: req.ip });
    res.json({ success: true, message: 'Yedek silindi' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { list, create, restore, schedule, remove };
