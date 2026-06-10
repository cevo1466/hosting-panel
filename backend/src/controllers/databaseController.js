'use strict';

const databaseService = require('../services/databaseService');
const { createAuditLog } = require('../middleware/audit');
const logger = require('../utils/logger');

async function list(req, res) {
  try {
    const { domainId } = req.query;
    const databases = await databaseService.listDatabases(
      { userId: req.user.id, domainId },
      req.user.role === 'admin'
    );
    res.json({ success: true, data: databases });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function create(req, res) {
  try {
    const { name, dbUser, password, domainId } = req.body;
    const db = await databaseService.createDatabase(name, dbUser, password, domainId, req.user.id);
    await createAuditLog({ userId: req.user.id, action: 'DB_CREATE', resource: 'database', resourceId: db.id, ipAddress: req.ip });
    res.status(201).json({ success: true, message: 'Veritabanı oluşturuldu', data: db });
  } catch (err) {
    logger.error('DB create error', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
}

async function changePassword(req, res) {
  try {
    const { password } = req.body;
    await databaseService.changePassword(req.params.id, password);
    res.json({ success: true, message: 'Veritabanı şifresi güncellendi' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getSize(req, res) {
  try {
    const size = await databaseService.getDatabaseSize(req.params.id);
    res.json({ success: true, data: { sizeMB: size } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function remove(req, res) {
  try {
    await databaseService.deleteDatabase(req.params.id);
    await createAuditLog({ userId: req.user.id, action: 'DB_DELETE', resource: 'database', resourceId: req.params.id, ipAddress: req.ip });
    res.json({ success: true, message: 'Veritabanı silindi' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { list, create, changePassword, getSize, remove };
