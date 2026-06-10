'use strict';

const ftpService = require('../services/ftpService');

async function list(req, res) {
  try {
    const isAdmin = req.user.role === 'admin';
    const accounts = await ftpService.listAccounts(req.query.domainId, req.user.id, isAdmin);
    const data = accounts.map(a => ({
      ...a,
      domain: a.domain?.name || '',
      status: a.isActive ? 'active' : 'disabled',
      quotaMb: a.quota,
      usedMb: 0,
    }));
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function create(req, res) {
  try {
    const { username, password, homeDir, domainId, subdomainId, quota } = req.body;
    const isAdmin = req.user.role === 'admin';
    const userId = isAdmin && req.body.userId ? req.body.userId : req.user.id;
    const account = await ftpService.createFtpAccount(username, password, homeDir, domainId, userId, subdomainId, quota, isAdmin);
    return res.status(201).json({ success: true, message: 'FTP account created', data: { id: account.id, username: account.username, homeDir: account.homeDir } });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function changePassword(req, res) {
  try {
    const updated = await ftpService.changePassword(req.params.id, req.body.password);
    return res.json({ success: true, message: 'Password changed', data: { id: updated.id } });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function toggleActive(req, res) {
  try {
    const updated = await ftpService.toggleActive(req.params.id, req.body.isActive);
    return res.json({
      success: true,
      message: 'FTP account updated',
      data: {
        id: updated.id,
        username: updated.username,
        isActive: updated.isActive,
        status: updated.isActive ? 'active' : 'disabled',
      },
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function deleteFtp(req, res) {
  try {
    await ftpService.deleteFtpAccount(req.params.id);
    return res.json({ success: true, message: 'FTP account deleted' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function syncAccounts(req, res) {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Sadece admin kullanabilir' });
    const result = await ftpService.syncFtpAccounts(req.user.id);
    return res.json({
      success: true,
      message: `${result.imported.length} hesap içe aktarıldı, ${result.skipped.length} atlandı`,
      data: result,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { list, create, changePassword, toggleActive, delete: deleteFtp, remove: deleteFtp, syncAccounts };
