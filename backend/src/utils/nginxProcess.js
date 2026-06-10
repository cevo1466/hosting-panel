'use strict';

function parsePgrepOutput(output) {
  return String(output || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)(?:\s+(.*))?$/);
      if (!match) return null;
      return {
        pid: Number.parseInt(match[1], 10),
        command: match[2] || '',
      };
    })
    .filter((entry) => entry && Number.isInteger(entry.pid) && entry.pid > 1);
}

function selectNginxMasterPid(output) {
  const entries = parsePgrepOutput(output);
  if (entries.length === 0) return null;

  const dockerNginx = entries.find((entry) =>
    entry.command.includes('nginx: master process nginx -g daemon off')
    || entry.command.includes('nginx -g daemon off')
  );
  if (dockerNginx) return dockerNginx.pid;

  const nonHostNginx = entries.find((entry) =>
    entry.command.includes('nginx: master process')
    && !entry.command.includes('/usr/sbin/nginx')
  );
  if (nonHostNginx) return nonHostNginx.pid;

  return entries[0].pid;
}

module.exports = { parsePgrepOutput, selectNginxMasterPid };
