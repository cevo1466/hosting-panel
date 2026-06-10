'use strict';

const { execFile, spawn } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const logger = require('./logger');
const { selectNginxMasterPid } = require('./nginxProcess');

const ALLOWED_COMMANDS = {
  nginx:          { bin: 'nginx',           allowedArgs: ['-t', '-s'] },
  certbot:        { bin: 'certbot',         allowedArgs: ['certonly', 'renew', 'delete', 'certificates'] },
  mysql:          { bin: 'mysql',           allowedArgs: ['--execute', '--user', '--password', '--host', '--port'] },
  namedCheckconf: { bin: 'named-checkconf', allowedArgs: [] },
  namedCheckzone: { bin: 'named-checkzone', allowedArgs: [] },
  rndc:           { bin: 'rndc',            allowedArgs: ['reload', 'reconfig', 'flush', 'status'] },
  tar:            { bin: 'tar',             allowedArgs: ['-czf', '-xzf', '-tf'] },
  du:             { bin: 'du',              allowedArgs: ['-sh', '-s', '--bytes'] },
  df:             { bin: 'df',              allowedArgs: ['-h', '--output'] },
  chmod:          { bin: 'chmod',           allowedArgs: [] },
  chown:          { bin: 'chown',           allowedArgs: [] },
  mkdir:          { bin: 'mkdir',           allowedArgs: ['-p'] },
  rm:             { bin: 'rm',              allowedArgs: ['-rf', '-f', '-r'] },
  cp:             { bin: 'cp',              allowedArgs: ['-r', '-a'] },
  mv:             { bin: 'mv',              allowedArgs: [] },
  unzip:          { bin: 'unzip',           allowedArgs: ['-o', '-d', '-l'] },
  zip:            { bin: 'zip',             allowedArgs: ['-r', '-9'] },
};

const ALLOWED_SERVICES = [
  'nginx', 'apache2', 'mysql', 'mariadb', 'vsftpd', 'postfix', 'dovecot',
  'bind9', 'named', 'redis', 'docker', 'fail2ban', 'opendkim',
  'php8.1-fpm', 'php8.2-fpm', 'php8.3-fpm', 'php8.4-fpm',
];

const ALLOWED_ACTIONS = ['start', 'stop', 'restart', 'reload', 'status', 'enable', 'disable'];

function sanitizeArg(arg) {
  if (typeof arg !== 'string') throw new Error('Argument must be a string');
  if (/[;&|`$<>\\"\n]/.test(arg)) throw new Error(`Dangerous characters in argument: ${arg}`);
  return arg;
}

function validatePath(p) {
  if (!p || typeof p !== 'string') throw new Error('Invalid path');
  const normalized = require('path').normalize(p);
  if (normalized.includes('..')) throw new Error('Path traversal detected');
  return normalized;
}

async function runCommand(commandKey, args = [], options = {}) {
  const cmd = ALLOWED_COMMANDS[commandKey];
  if (!cmd) throw new Error(`Command not in whitelist: ${commandKey}`);

  const sanitizedArgs = args.map(sanitizeArg);
  logger.info('Running command', { command: commandKey, args: sanitizedArgs });

  try {
    const { stdout, stderr } = await execFileAsync(cmd.bin, sanitizedArgs, {
      timeout: options.timeout || 30000,
      maxBuffer: options.maxBuffer || 1024 * 1024 * 10,
    });
    return { success: true, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (err) {
    logger.error('Command failed', { command: commandKey, args: sanitizedArgs, error: err.message });
    return { success: false, stdout: '', stderr: err.message, code: err.code };
  }
}

// nsenter ile host'un PID 1 namespace'inde systemctl çalıştır
async function systemctlAction(service, action) {
  if (!ALLOWED_SERVICES.includes(service)) throw new Error(`Service not allowed: ${service}`);
  if (!ALLOWED_ACTIONS.includes(action)) throw new Error(`Action not allowed: ${action}`);

  logger.info('systemctlAction via nsenter', { service, action });

  return new Promise((resolve) => {
    execFile(
      'nsenter',
      ['--target', '1', '--mount', '--uts', '--ipc', '--net', '--pid', '--',
       'systemctl', action, service],
      { timeout: 30000 },
      (err, stdout, stderr) => {
        if (err) {
          logger.warn('systemctl via nsenter failed', { service, action, error: err.message });
          resolve({ success: false, stdout: '', stderr: err.message });
        } else {
          resolve({ success: true, stdout: stdout.trim(), stderr: stderr.trim() });
        }
      }
    );
  });
}

// fail2ban-client host'ta kurulu (container'da yok) → nsenter ile host namespace'inde çalıştır
const FAIL2BAN_SUBCOMMANDS = ['status', 'set', 'get', 'banned', 'ping', 'reload'];
async function fail2banClient(args = []) {
  const sub = args[0];
  if (!FAIL2BAN_SUBCOMMANDS.includes(sub)) {
    throw new Error(`fail2ban subcommand not allowed: ${sub}`);
  }
  const sanitized = args.map(sanitizeArg);
  logger.info('fail2ban-client via nsenter', { args: sanitized });
  return new Promise((resolve) => {
    execFile(
      'nsenter',
      ['--target', '1', '--mount', '--uts', '--ipc', '--net', '--pid', '--',
       'fail2ban-client', ...sanitized],
      { timeout: 15000 },
      (err, stdout, stderr) => {
        if (err) {
          logger.warn('fail2ban-client via nsenter failed', { args: sanitized, error: err.message });
          resolve({ success: false, stdout: '', stderr: err.message });
        } else {
          resolve({ success: true, stdout: stdout.trim(), stderr: stderr.trim() });
        }
      }
    );
  });
}

// Docker nginx'te nginx -t ile config test et
async function testNginxConfig() {
  return new Promise((resolve) => {
    execFile('pgrep', ['-af', 'nginx: master'], { timeout: 5000 }, (err, stdout) => {
      if (err || !stdout.trim()) {
        logger.warn('nginx master not found for config test, assuming OK');
        resolve({ success: true, stdout: 'skipped' });
        return;
      }
      const nginxPid = selectNginxMasterPid(stdout);
      if (!nginxPid) {
        logger.warn('nginx master pid could not be resolved for config test');
        resolve({ success: true, stdout: 'skipped' });
        return;
      }
      execFile(
        'nsenter',
        ['--target', String(nginxPid), '--mount', '--', 'nginx', '-t'],
        { timeout: 10000 },
        (e2, out2, err2) => {
          const combined = (out2 || '') + (err2 || '');
          // "syntax is ok" varsa başarılı say (log dosyası eksikliği gibi uyarıları geç)
          const syntaxOk = combined.includes('syntax is ok');
          resolve({ success: syntaxOk || !e2, stdout: out2 || '', stderr: err2 || (e2 ? e2.message : '') });
        }
      );
    });
  });
}

// Docker nginx container'ına reload sinyali gönder.
// ÖNEMLİ: `nsenter --mount -- nginx -s reload` KULLANMA. O yalnızca mount
// namespace'ine girer; `nginx -s reload` pidfile'daki PID'i (container içinde 1)
// çağıranın PID namespace'inde (host) sinyaller → SIGHUP host PID 1'e (systemd)
// gider, nginx master'a değil. Backend `pid:host` ile çalıştığı için master'ın
// host-görünür PID'ine doğrudan SIGHUP göndermek doğru ve güvenilir yöntemdir.
async function reloadNginx() {
  logger.info('Reloading Docker nginx');
  return new Promise((resolve) => {
    execFile('pgrep', ['-af', 'nginx: master'], { timeout: 5000 }, (err, stdout) => {
      if (err || !stdout.trim()) {
        logger.warn('nginx master process not found, skipping reload');
        resolve({ success: true, stdout: 'skipped' });
        return;
      }
      const nginxPid = selectNginxMasterPid(stdout);
      if (!Number.isInteger(nginxPid) || nginxPid <= 1) {
        logger.warn('invalid nginx master pid for reload', { nginxPid });
        resolve({ success: false, stderr: `invalid nginx master pid: ${nginxPid}` });
        return;
      }
      try {
        process.kill(nginxPid, 'SIGHUP');
        logger.info('Sent SIGHUP to nginx master', { nginxPid });
        resolve({ success: true, stdout: `reloaded (SIGHUP ${nginxPid})` });
      } catch (e2) {
        logger.warn('nginx reload (SIGHUP) failed', { nginxPid, error: e2.message });
        resolve({ success: false, stderr: e2.message });
      }
    });
  });
}

// Certbot runs on the HOST via nsenter (not inside the container)
const CERTBOT_ALLOWED_ARGS = ['certonly', 'renew', 'delete', 'certificates', '--webroot',
  '--webroot-path', '--non-interactive', '--agree-tos', '--email', '-d', '--quiet',
  '--cert-name', '--expand'];

async function certbotAction(args = []) {
  const sanitized = args.map(sanitizeArg);
  logger.info('certbotAction via nsenter', { args: sanitized });

  return new Promise((resolve) => {
    execFile(
      'nsenter',
      ['--target', '1', '--mount', '--uts', '--ipc', '--net', '--pid', '--',
       '/usr/bin/certbot', ...sanitized],
      { timeout: 120000 },
      (err, stdout, stderr) => {
        if (err) {
          logger.warn('certbot via nsenter failed', { error: err.message, stderr });
          resolve({ success: false, stdout: stdout || '', stderr: stderr || err.message });
        } else {
          resolve({ success: true, stdout: stdout.trim(), stderr: stderr.trim() });
        }
      }
    );
  });
}

// FTP hesapları host'ta gerçek sistem kullanıcısı olarak yönetilir (useradd/chpasswd/
// userdel + /etc/vsftpd.userlist). Bu araçlar container'da değil HOST'ta olduğundan,
// systemctl/certbot ile aynı şekilde nsenter --target 1 ile host namespace'inde çalışır.
// Parola/satır içeriği gibi özel karakter içerebilen veriler ARGV'ye değil STDIN'e verilir
// (chpasswd "user:pass", tee dosya içeriği) → ps'te görünmez ve enjeksiyon riski olmaz.
const HOST_FTP_BINS = {
  useradd:  '/usr/sbin/useradd',
  userdel:  '/usr/sbin/userdel',
  usermod:  '/usr/sbin/usermod',
  chpasswd: '/usr/sbin/chpasswd',
  getent:   'getent',
  mkdir:    'mkdir',
  chown:    'chown',
  chmod:    'chmod',
  cat:      'cat',
  tee:      'tee',
};

function hostFtpExec(binKey, args = [], { input, timeout = 30000 } = {}) {
  const bin = HOST_FTP_BINS[binKey];
  if (!bin) return Promise.reject(new Error(`Host FTP command not allowed: ${binKey}`));
  const sanitized = args.map(sanitizeArg); // argv güvenli (parola argv'ye girmez, stdin'den gelir)
  logger.info('hostFtpExec via nsenter', { bin: binKey, args: sanitized });
  return new Promise((resolve) => {
    const child = spawn(
      'nsenter',
      ['--target', '1', '--mount', '--uts', '--ipc', '--net', '--pid', '--', bin, ...sanitized],
      { timeout }
    );
    let stdout = '', stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (err) => resolve({ success: false, stdout, stderr: stderr || err.message }));
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, stdout: stdout.trim(), stderr: stderr.trim() });
      } else {
        logger.warn('hostFtpExec failed', { bin: binKey, code, stderr: stderr.trim() });
        resolve({ success: false, stdout: stdout.trim(), stderr: stderr.trim(), code });
      }
    });
    if (input != null) child.stdin.end(input);
    else child.stdin.end();
  });
}

module.exports = { runCommand, systemctlAction, fail2banClient, certbotAction, reloadNginx, testNginxConfig, hostFtpExec, sanitizeArg, validatePath };
