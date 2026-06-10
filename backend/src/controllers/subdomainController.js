'use strict';

const subdomainService = require('../services/subdomainService');

async function list(req, res) {
  try {
    const isAdmin = req.user.role === 'admin';
    const subdomains = await subdomainService.listSubdomains(req.params.domainId, req.user.id, isAdmin);
    return res.json({ success: true, data: subdomains });
  } catch (err) {
    const code = err.message === 'Access denied' ? 403 : err.message === 'Domain not found' ? 404 : 500;
    return res.status(code).json({ success: false, message: err.message });
  }
}

async function listAll(req, res) {
  try {
    const isAdmin = req.user.role === 'admin';
    const subdomains = await subdomainService.listAllSubdomains(req.user.id, isAdmin);
    return res.json({ success: true, data: subdomains });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function create(req, res) {
  try {
    const { name, phpVersion } = req.body;
    const isAdmin = req.user.role === 'admin';
    const subdomain = await subdomainService.createSubdomain(req.params.domainId, name, phpVersion, req.user.id, isAdmin);
    return res.status(201).json({ success: true, message: 'Subdomain created', data: subdomain });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function update(req, res) {
  try {
    const { phpVersion } = req.body;
    const isAdmin = req.user.role === 'admin';
    const updated = await subdomainService.updateSubdomain(req.params.id, phpVersion, req.user.id, isAdmin);
    return res.json({ success: true, message: 'Subdomain updated', data: updated });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function deleteSubdomain(req, res) {
  try {
    const isAdmin = req.user.role === 'admin';
    await subdomainService.deleteSubdomain(req.params.id, req.user.id, isAdmin);
    return res.json({ success: true, message: 'Subdomain deleted' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

module.exports = {
  list,
  listAll,
  create,
  update,
  updatePhp: update,
  delete: deleteSubdomain,
  remove: deleteSubdomain,
};
