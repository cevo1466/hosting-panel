'use strict';

const { execFile } = require('child_process');
const si = require('systeminformation');
const { systemctlAction, runCommand } = require('../utils/shell');
const logger = require('../utils/logger');

async function getCpuInfo() {
  const [load, cpu, temp] = await Promise.all([
    si.currentLoad(),
    si.cpu(),
    si.cpuTemperature().catch(() => ({ main: null })),
  ]);
  return {
    model: `${cpu.manufacturer} ${cpu.brand}`,
    cores: cpu.cores,
    physicalCores: cpu.physicalCores,
    speed: cpu.speed,
    loadPercent: parseFloat(load.currentLoad.toFixed(2)),
    coresLoad: load.cpus.map(c => parseFloat(c.load.toFixed(2))),
    temperature: temp.main,
  };
}

async function getRamInfo() {
  const mem = await si.mem();
  // Use active (process memory) not used (which includes Linux buff/cache)
  const activeMB = Math.round(mem.active / 1024 / 1024);
  const totalMB = Math.round(mem.total / 1024 / 1024);
  return {
    totalMB,
    usedMB: activeMB,
    freeMB: Math.round(mem.available / 1024 / 1024),
    usedPercent: parseFloat(((mem.active / mem.total) * 100).toFixed(2)),
    swapTotalMB: Math.round(mem.swaptotal / 1024 / 1024),
    swapUsedMB: Math.round(mem.swapused / 1024 / 1024),
  };
}

async function getDiskInfo() {
  const disks = await si.fsSize();
  return disks
    .filter(d => d.mount && !d.mount.startsWith('/boot'))
    .map(d => ({
      fs: d.fs,
      mount: d.mount,
      type: d.type,
      totalMB: Math.round(d.size / 1024 / 1024),
      usedMB: Math.round(d.used / 1024 / 1024),
      usedPercent: parseFloat(d.use.toFixed(2)),
    }));
}

async function getNetworkInfo() {
  const [stats, ifaces] = await Promise.all([
    si.networkStats(),
    si.networkInterfaces(),
  ]);
  return stats
    .filter(s => s.iface !== 'lo')
    .map(s => {
      const iface = (Array.isArray(ifaces) ? ifaces : [ifaces]).find(i => i.iface === s.iface);
      return {
        interface: s.iface,
        ip4: iface?.ip4 || null,
        rxMBs: parseFloat((s.rx_sec / 1024 / 1024).toFixed(4)),
        txMBs: parseFloat((s.tx_sec / 1024 / 1024).toFixed(4)),
        rxTotalMB: Math.round(s.rx_bytes / 1024 / 1024),
        txTotalMB: Math.round(s.tx_bytes / 1024 / 1024),
      };
    });
}

async function getUptimeInfo() {
  const time = await si.time();
  const uptimeSec = time.uptime;
  const days = Math.floor(uptimeSec / 86400);
  const hours = Math.floor((uptimeSec % 86400) / 3600);
  const minutes = Math.floor((uptimeSec % 3600) / 60);
  return {
    uptimeSeconds: uptimeSec,
    uptimeFormatted: `${days}d ${hours}h ${minutes}m`,
    bootTime: new Date(Date.now() - uptimeSec * 1000).toISOString(),
  };
}

async function getSystemStats() {
  try {
    const [cpu, ram, disk, network, uptime] = await Promise.all([
      getCpuInfo(),
      getRamInfo(),
      getDiskInfo(),
      getNetworkInfo(),
      getUptimeInfo(),
    ]);
    return { cpu, ram, disk, network, uptime };
  } catch (err) {
    logger.error('Failed to get system stats', { error: err.message });
    throw err;
  }
}

async function checkProcessRunning(pattern) {
  return new Promise((resolve) => {
    execFile('pgrep', ['-f', pattern], { timeout: 5000 }, (err, stdout) => {
      resolve(!err && stdout.trim().length > 0);
    });
  });
}

async function checkPortListening(host, port) {
  return new Promise((resolve) => {
    const net = require('net');
    const socket = net.createConnection({ host, port, timeout: 3000 });
    socket.on('connect', () => { socket.destroy(); resolve(true); });
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
  });
}

const SERVICE_DISPLAY_NAMES = {
  nginx: 'Nginx',
  mysql: 'MySQL',
  redis: 'Redis',
  'php8.3-fpm': 'PHP 8.3-FPM',
  postfix: 'Postfix',
  dovecot: 'Dovecot',
  vsftpd: 'vsftpd',
  named: 'BIND DNS',
  opendkim: 'OpenDKIM',
  fail2ban: 'Fail2ban',
};

// Services that run as Docker containers (not host systemd units). They are
// checked via TCP reachability, since `systemctl status` on the host has no
// unit for them and would otherwise be reported as "stopped".
const DOCKER_SERVICES = {
  mysql: { host: 'hosting_mysql', port: 3306 },
  redis: { host: 'hosting_redis', port: 6379 },
};

async function getServiceStatus(serviceName) {
  const displayName = SERVICE_DISPLAY_NAMES[serviceName] || serviceName;
  // nginx: check Docker nginx master process
  if (serviceName === 'nginx') {
    const running = await checkProcessRunning('nginx: master');
    return { name: 'nginx', displayName, status: running ? 'running' : 'stopped', running, enabled: true };
  }
  // Docker-container services (mysql, redis): check TCP reachability
  if (DOCKER_SERVICES[serviceName]) {
    const { host, port } = DOCKER_SERVICES[serviceName];
    const running = await checkPortListening(host, port);
    return { name: serviceName, displayName, status: running ? 'running' : 'stopped', running, enabled: true };
  }
  try {
    const result = await systemctlAction(serviceName, 'status');
    // postfix uses 'active (exited)' — master daemon runs outside systemd
    const isRunning = result.stdout.includes('active (running)') || result.stdout.includes('active (exited)');
    const isEnabled = result.stdout.includes('enabled');
    return {
      name: serviceName,
      displayName: SERVICE_DISPLAY_NAMES[serviceName] || serviceName,
      status: isRunning ? 'running' : 'stopped',
      running: isRunning,
      enabled: isEnabled,
      output: result.stdout.substring(0, 500),
    };
  } catch (err) {
    return { name: serviceName, displayName: SERVICE_DISPLAY_NAMES[serviceName] || serviceName, status: 'error', running: false, enabled: false, error: err.message };
  }
}

// Real services on THIS host. nginx/mysql/redis run as Docker containers
// (checked by process/TCP); the rest are host systemd units reached via
// nsenter. apache2/mariadb/php8.4-fpm are intentionally excluded — they are
// replaced by the Docker nginx / Docker mysql / php8.3 and would otherwise be
// reported as "stopped" and alarm the user.
const MONITORED_SERVICES = [
  'nginx', 'mysql', 'redis', 'php8.3-fpm',
  'postfix', 'dovecot', 'vsftpd', 'named', 'opendkim', 'fail2ban',
];

async function getAllServicesStatus() {
  const statuses = await Promise.all(MONITORED_SERVICES.map(s => getServiceStatus(s)));
  return statuses;
}

// Recent log lines for a service. systemd `status` output includes the last
// ~10 journal lines, which is enough for the panel's inline log view without
// widening the shell whitelist to journalctl. Docker services fall back to a
// short note (their logs live in `docker logs`).
async function getServiceLogs(serviceName) {
  if (serviceName === 'nginx' || DOCKER_SERVICES[serviceName]) {
    const { status } = await getServiceStatus(serviceName);
    return `${SERVICE_DISPLAY_NAMES[serviceName] || serviceName}: ${status} (Docker konteyneri — ayrıntılı log için "docker logs").`;
  }
  try {
    const result = await systemctlAction(serviceName, 'status');
    return result.stdout || result.stderr || 'Log bulunamadı.';
  } catch (err) {
    return `Log alınamadı: ${err.message}`;
  }
}

async function performServiceAction(serviceName, action) {
  const result = await systemctlAction(serviceName, action);
  return result;
}

module.exports = {
  getSystemStats,
  getCpuInfo,
  getRamInfo,
  getDiskInfo,
  getNetworkInfo,
  getUptimeInfo,
  getServiceStatus,
  getAllServicesStatus,
  getServiceLogs,
  performServiceAction,
  MONITORED_SERVICES,
};
