function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeAuditLogs(payload) {
  const logs = Array.isArray(payload) ? payload : asArray(payload && payload.logs);

  return logs.map((log) => ({
    ...log,
    action: String(log.action || ''),
    resource: String(log.resource || ''),
    status: log.status === 'failed' ? 'failed' : 'success',
    username: log.username || (log.user && log.user.username) || undefined,
    ipAddress: log.ipAddress || log.ip || undefined,
  }));
}

function normalizeLoginAttempts(payload) {
  const attempts = Array.isArray(payload) ? payload : asArray(payload && payload.attempts);

  return attempts.map((attempt) => ({
    ...attempt,
    ip: attempt.ip || attempt.ipAddress || '',
    email: attempt.email || (attempt.user && attempt.user.email) || '',
    success: typeof attempt.success === 'boolean' ? attempt.success : attempt.status !== 'failed',
  }));
}

function normalizeFail2banStatus(payload) {
  if (!payload || typeof payload !== 'object') return null;

  return {
    ...payload,
    enabled: Boolean(payload.enabled),
    jails: asArray(payload.jails),
  };
}

function formatAuditLogLine(log) {
  const username = log.username || (log.user && log.user.username) || 'system';
  const ip = log.ipAddress || log.ip || '-';
  const createdAt = log.createdAt ? new Date(log.createdAt).toISOString() : '';
  return [createdAt, log.action || '-', log.resource || '-', log.status || '-', username, ip].filter(Boolean).join(' ');
}

function normalizeLogContent(payload) {
  if (typeof payload === 'string') return payload;
  if (!payload || typeof payload !== 'object') return '';
  if (typeof payload.log === 'string') return payload.log;
  if (Array.isArray(payload.logs)) return payload.logs.map(formatAuditLogLine).join('\n');
  return '';
}

function resolveWebmailHref(configuredUrl) {
  const trimmed = typeof configuredUrl === 'string' ? configuredUrl.trim() : '';
  return trimmed || '/email';
}

module.exports = {
  normalizeAuditLogs,
  normalizeFail2banStatus,
  normalizeLoginAttempts,
  normalizeLogContent,
  resolveWebmailHref,
};
