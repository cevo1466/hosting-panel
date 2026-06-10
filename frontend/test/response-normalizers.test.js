const assert = require('node:assert/strict');
const test = require('node:test');

const {
  normalizeAuditLogs,
  normalizeLoginAttempts,
  normalizeLogContent,
  resolveWebmailHref,
} = require('../lib/response-normalizers');

test('normalizes paginated audit-log responses to an array with username', () => {
  const logs = normalizeAuditLogs({
    logs: [
      {
        id: '1',
        action: 'login',
        resource: 'auth',
        status: 'success',
        createdAt: '2026-06-10T05:08:24.036Z',
        user: { username: 'melihcevirim', email: 'melih@example.com' },
      },
    ],
    total: 1,
  });

  assert.equal(logs.length, 1);
  assert.equal(logs[0].username, 'melihcevirim');
});

test('keeps security lists as arrays even when API shape changes', () => {
  assert.deepEqual(normalizeAuditLogs(null), []);
  assert.deepEqual(normalizeLoginAttempts({ attempts: 'bad-shape' }), []);
});

test('normalizes log endpoint payloads to plain text', () => {
  assert.equal(normalizeLogContent({ log: 'line one\nline two' }), 'line one\nline two');
  assert.match(
    normalizeLogContent({
      logs: [
        {
          action: 'login',
          resource: 'auth',
          status: 'success',
          ipAddress: '127.0.0.1',
          createdAt: '2026-06-10T05:08:24.036Z',
          user: { username: 'admin' },
        },
      ],
    }),
    /login auth success admin 127\.0\.0\.1/
  );
});

test('uses configured shared webmail URL and falls back to email page', () => {
  assert.equal(resolveWebmailHref(' https://webmail.sitestudyo.com '), 'https://webmail.sitestudyo.com');
  assert.equal(resolveWebmailHref(''), '/email');
});
