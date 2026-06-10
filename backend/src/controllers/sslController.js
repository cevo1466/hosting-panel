'use strict';

const sslService = require('../services/sslService');

async function list(req, res) {
  try {
    const isAdmin = req.user.role === 'admin';
    const certs = await sslService.listSslCertificates(req.user.id, isAdmin);
    return res.json({ success: true, data: certs });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function install(req, res) {
  try {
    const { domainId, subdomainId, email } = req.body;
    if (!domainId && !subdomainId) {
      return res.status(400).json({ success: false, message: 'domainId veya subdomainId gerekli' });
    }
    const ssl = subdomainId
      ? await sslService.installSslForSubdomain(subdomainId, email)
      : await sslService.installSsl(domainId, email);
    return res.json({ success: true, message: 'SSL installed successfully', data: ssl });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function renew(req, res) {
  try {
    const cert = await require('../config/database').sslCertificate.findUnique({ where: { id: req.params.id } });
    if (!cert) return res.status(404).json({ success: false, message: 'Certificate not found' });
    const updated = cert.subdomainId
      ? await sslService.renewSslForSubdomain(cert.subdomainId)
      : await sslService.renewSsl(cert.domainId);
    return res.json({ success: true, message: 'SSL renewed', data: updated });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function revoke(req, res) {
  try {
    const cert = await require('../config/database').sslCertificate.findUnique({ where: { id: req.params.id } });
    if (!cert) return res.status(404).json({ success: false, message: 'Certificate not found' });
    if (cert.subdomainId) {
      await sslService.revokeSslForSubdomain(cert.subdomainId);
    } else {
      await sslService.revokeSsl(cert.domainId);
    }
    return res.json({ success: true, message: 'SSL revoked' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function getStatus(req, res) {
  try {
    const cert = await require('../config/database').sslCertificate.findUnique({ where: { id: req.params.id } });
    if (!cert) return res.status(404).json({ success: false, message: 'Certificate not found' });
    const status = await sslService.checkCertStatus(cert);
    return res.json({ success: true, data: status });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { list, install, renew, revoke, getStatus };
