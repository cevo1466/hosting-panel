'use strict';

const domainService = require('../services/domainService');
const logger = require('../utils/logger');

async function list(req, res) {
  try {
    const isAdmin = req.user.role === 'admin';
    const domains = await domainService.listDomains(req.user.id, isAdmin);
    return res.json({ success: true, data: domains });
  } catch (err) {
    logger.error('Domain list error', { error: err.message });
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function create(req, res) {
  try {
    const { name, phpVersion } = req.body;
    const userId = req.user.role === 'admin' && req.body.userId ? req.body.userId : req.user.id;

    const domain = await domainService.createDomain(userId, name, phpVersion || '8.3');
    return res.status(201).json({ success: true, message: 'Domain created', data: domain });
  } catch (err) {
    logger.error('Domain create error', { error: err.message });
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function get(req, res) {
  try {
    const isAdmin = req.user.role === 'admin';
    const domain = await domainService.getDomainById(req.params.id, req.user.id, isAdmin);
    return res.json({ success: true, data: domain });
  } catch (err) {
    if (err.message === 'Access denied') return res.status(403).json({ success: false, message: err.message });
    if (err.message === 'Domain not found') return res.status(404).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function update(req, res) {
  try {
    const { phpVersion } = req.body;
    const isAdmin = req.user.role === 'admin';
    await domainService.getDomainById(req.params.id, req.user.id, isAdmin); // access check
    const updated = await domainService.updatePhpVersion(req.params.id, phpVersion);
    return res.json({ success: true, message: 'Domain updated', data: updated });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function suspend(req, res) {
  try {
    const isAdmin = req.user.role === 'admin';
    await domainService.getDomainById(req.params.id, req.user.id, isAdmin);
    const domain = await domainService.suspendDomain(req.params.id);
    return res.json({ success: true, message: 'Domain suspended', data: domain });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function unsuspend(req, res) {
  try {
    const isAdmin = req.user.role === 'admin';
    await domainService.getDomainById(req.params.id, req.user.id, isAdmin);
    const domain = await domainService.unsuspendDomain(req.params.id);
    return res.json({ success: true, message: 'Domain unsuspended', data: domain });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function deleteDomain(req, res) {
  try {
    const isAdmin = req.user.role === 'admin';
    await domainService.getDomainById(req.params.id, req.user.id, isAdmin);
    await domainService.deleteDomain(req.params.id);
    return res.json({ success: true, message: 'Domain deleted' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

module.exports = {
  list,
  create,
  get,
  update,
  updatePhp: update,
  suspend,
  unsuspend,
  delete: deleteDomain,
  remove: deleteDomain,
};
