'use strict';

const dnsService = require('../services/dnsService');
const { createAuditLog } = require('../middleware/audit');
const logger = require('../utils/logger');
const prisma = require('../config/database');

function isAdmin(req) {
  return req.user.role === 'admin';
}

async function getAccessibleDomain(domainId, req) {
  const where = { id: domainId };
  if (!isAdmin(req)) where.userId = req.user.id;
  const domain = await prisma.domain.findFirst({ where, include: { dnsZone: true } });
  if (!domain) throw new Error('Domain not found or access denied');
  return domain;
}

async function getAccessibleRecord(recordId, req) {
  const record = await prisma.dnsRecord.findUnique({
    where: { id: recordId },
    include: { zone: { include: { domain: true } } },
  });
  if (!record) throw new Error('DNS record not found');
  if (!isAdmin(req) && record.zone.domain.userId !== req.user.id) throw new Error('Access denied');
  return record;
}

async function getZone(req, res) {
  try {
    const { domainId } = req.params;
    await getAccessibleDomain(domainId, req);
    let zone = await dnsService.getZone(domainId);
    if (!zone) {
      await dnsService.createZone(domainId);
      zone = await dnsService.getZone(domainId);
    }
    res.json({ success: true, data: zone });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function addRecord(req, res) {
  try {
    const { domainId } = req.params;
    const { type, name, value, ttl, priority } = req.body;
    const domain = await getAccessibleDomain(domainId, req);
    const zone = domain.dnsZone || await dnsService.createZone(domainId);
    const record = await dnsService.addRecord(zone.id, type, name, value, ttl, priority);
    await createAuditLog({ userId: req.user.id, action: 'DNS_RECORD_ADD', resource: 'dns', resourceId: record.id, ipAddress: req.ip });
    res.status(201).json({ success: true, message: 'DNS kaydı eklendi', data: record });
  } catch (err) {
    logger.error('DNS add record error', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
}

async function updateRecord(req, res) {
  try {
    const { recordId } = req.params;
    const { type, name, value, ttl, priority } = req.body;
    await getAccessibleRecord(recordId, req);
    const record = await dnsService.updateRecord(recordId, { type, name, value, ttl, priority });
    res.json({ success: true, message: 'DNS kaydı güncellendi', data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteRecord(req, res) {
  try {
    const { recordId } = req.params;
    await getAccessibleRecord(recordId, req);
    await dnsService.deleteRecord(recordId);
    await createAuditLog({ userId: req.user.id, action: 'DNS_RECORD_DELETE', resource: 'dns', resourceId: recordId, ipAddress: req.ip });
    res.json({ success: true, message: 'DNS kaydı silindi' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function reloadZone(req, res) {
  try {
    const { domainId } = req.params;
    await getAccessibleDomain(domainId, req);
    await dnsService.reloadZone(domainId);
    res.json({ success: true, message: 'DNS zone yenilendi' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { getZone, addRecord, updateRecord, deleteRecord, reloadZone };
