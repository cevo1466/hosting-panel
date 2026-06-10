const prisma = require('../config/database');
const logger = require('../utils/logger');

async function createAuditLog({ userId, action, resource, resourceId, details, ipAddress, userAgent, status = 'success' }) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        resource,
        resourceId,
        details: details ? JSON.stringify(details) : null,
        ipAddress,
        userAgent,
        status,
      },
    });
  } catch (err) {
    logger.error('Failed to create audit log', { err: err.message });
  }
}

function audit(action, resource) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function (data) {
      const status = res.statusCode >= 400 ? 'failed' : 'success';
      createAuditLog({
        userId: req.user?.id,
        action,
        resource,
        resourceId: req.params?.id || data?.data?.id,
        details: { body: req.body, query: req.query },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        status,
      });
      return originalJson(data);
    };
    next();
  };
}

module.exports = { audit, createAuditLog };
