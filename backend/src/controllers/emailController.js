'use strict';

const emailService = require('../services/emailService');

async function list(req, res) {
  try {
    const isAdmin = req.user.role === 'admin';
    const accounts = await emailService.listEmailAccounts(req.query.domainId, req.user.id, isAdmin);
    return res.json({ success: true, data: accounts });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function create(req, res) {
  try {
    const { address, password, domainId, quotaMB } = req.body;
    const userId = req.user.role === 'admin' && req.body.userId ? req.body.userId : req.user.id;
    const account = await emailService.createEmailAccount(address, password, domainId, userId, quotaMB || 1024);
    return res.status(201).json({ success: true, message: 'Email account created', data: { id: account.id, address: account.address } });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function changePassword(req, res) {
  try {
    await emailService.changePassword(req.params.id, req.body.password);
    return res.json({ success: true, message: 'Password changed' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function setForward(req, res) {
  try {
    const updated = await emailService.setForward(req.params.id, req.body.forwardTo);
    return res.json({ success: true, message: 'Forward updated', data: { forwardTo: updated.forwardTo } });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function setAutoResponder(req, res) {
  try {
    const { message, enabled } = req.body;
    const updated = await emailService.setAutoResponder(req.params.id, message, enabled);
    return res.json({ success: true, message: 'Auto-responder updated', data: { autoResponderEnabled: updated.autoResponderEnabled } });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function setCatchAll(req, res) {
  try {
    const { domainId, emailAccountId } = req.body;
    await emailService.setCatchAll(domainId, emailAccountId);
    return res.json({ success: true, message: 'Catch-all set' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function toggleActive(req, res) {
  try {
    const prisma = require('../config/database');
    const existing = await prisma.emailAccount.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Email account not found' });
    if (req.user.role !== 'admin' && existing.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const updated = await prisma.emailAccount.update({
      where: { id: req.params.id },
      data: { isActive: typeof req.body.isActive === 'boolean' ? req.body.isActive : !existing.isActive },
    });
    return res.json({ success: true, message: 'Email account updated', data: updated });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function deleteEmail(req, res) {
  try {
    await emailService.deleteEmailAccount(req.params.id);
    return res.json({ success: true, message: 'Email account deleted' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

module.exports = {
  list,
  create,
  changePassword,
  setForward,
  setAutoResponder,
  setCatchAll,
  toggleActive,
  delete: deleteEmail,
  remove: deleteEmail,
};
