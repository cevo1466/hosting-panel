'use strict';

const systemService = require('../services/systemService');
const { createAuditLog } = require('../middleware/audit');
const logger = require('../utils/logger');

// Single source of truth for the monitored set + correct, frontend-shaped
// status ({ name, displayName, status: 'running'|'stopped', ... }).
const SERVICES = systemService.MONITORED_SERVICES;

// Services managed by Docker containers — host `systemctl` cannot start/stop
// them, so panel actions on them are refused with a clear message instead of
// throwing a confusing systemd error.
const DOCKER_MANAGED = ['nginx', 'mysql', 'redis'];

async function list(req, res) {
  try {
    const services = await systemService.getAllServicesStatus();
    res.json({ success: true, data: services });
  } catch (err) {
    logger.error('Service list error', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
}

async function action(req, res) {
  try {
    const { service } = req.params;
    const { action: act } = req.body;

    if (!SERVICES.includes(service)) {
      return res.status(400).json({ success: false, message: 'Geçersiz servis' });
    }

    if (DOCKER_MANAGED.includes(service)) {
      return res.status(400).json({
        success: false,
        message: `${service} Docker konteyneri tarafından yönetiliyor; panelden başlatılıp durdurulamaz.`,
      });
    }

    const result = await systemService.performServiceAction(service, act);
    await createAuditLog({
      userId: req.user.id,
      action: `SERVICE_${String(act).toUpperCase()}`,
      resource: 'service',
      resourceId: service,
      details: { result: (result.stdout || '').slice(0, 200) },
      ipAddress: req.ip,
    });

    res.json({
      success: result.success !== false,
      message: `${service} ${act} işlemi tamamlandı`,
      data: { stdout: result.stdout || '' },
    });
  } catch (err) {
    logger.error('Service action error', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getLogs(req, res) {
  try {
    const { service } = req.params;

    if (!SERVICES.includes(service)) {
      return res.status(400).json({ success: false, message: 'Geçersiz servis' });
    }

    const logs = await systemService.getServiceLogs(service);
    // Frontend reads res.data.data directly as a string.
    res.json({ success: true, data: logs });
  } catch (err) {
    logger.error('Service logs error', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { list, action, getLogs };
