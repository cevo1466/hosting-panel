'use strict';

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const prisma = require('../config/database');
const config = require('../config/config');
const { runCommand, systemctlAction, reloadNginx, testNginxConfig } = require('../utils/shell');
const logger = require('../utils/logger');

const WEB_ROOT = config.hosting.webRoot;
const NGINX_AVAILABLE = config.hosting.nginxSitesAvailable;
const NGINX_ENABLED = config.hosting.nginxSitesEnabled;
const PHP_FPM_SOCK_DIR = config.hosting.phpFpmSockDir;
const SERVER_IP = config.hosting.serverIp;

function buildNginxVhost(domainName, documentRoot, phpVersion) {
  const phpSock = `${PHP_FPM_SOCK_DIR}/php${phpVersion}-fpm.sock`;
  return `server {
    listen 80;
    listen [::]:80;
    server_name ${domainName} www.${domainName};

    root ${documentRoot}/public_html;
    index index.php index.html index.htm;

    client_max_body_size 128M;

    location ^~ /.well-known/acme-challenge/ {
        root ${documentRoot}/public_html;
        try_files $uri =404;
    }

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \\.php$ {
        fastcgi_split_path_info ^(.+\\.php)(/.+)$;
        fastcgi_pass unix:${phpSock};
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        fastcgi_param DOCUMENT_ROOT $document_root;
        include fastcgi_params;
    }

    location ~ /\\.ht {
        deny all;
    }

    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
`;
}

const LE_LIVE = '/etc/letsencrypt/live';

function sslPathsFor(domainName) {
  return {
    certPath: `${LE_LIVE}/${domainName}/fullchain.pem`,
    keyPath: `${LE_LIVE}/${domainName}/privkey.pem`,
    chainPath: `${LE_LIVE}/${domainName}/chain.pem`,
  };
}

// Bu domain için geçerli bir Let's Encrypt sertifikası diskte var mı?
function hasSslCert(domainName) {
  const { certPath, keyPath } = sslPathsFor(domainName);
  try {
    return fsSync.existsSync(certPath) && fsSync.existsSync(keyPath);
  } catch {
    return false;
  }
}

function buildSslNginxVhost(domainName, documentRoot, phpVersion, certPath, keyPath, chainPath) {
  const phpSock = `${PHP_FPM_SOCK_DIR}/php${phpVersion}-fpm.sock`;
  return `server {
    listen 80;
    listen [::]:80;
    server_name ${domainName} www.${domainName};

    location ^~ /.well-known/acme-challenge/ {
        root ${documentRoot}/public_html;
        try_files $uri =404;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name ${domainName} www.${domainName};

    root ${documentRoot}/public_html;
    index index.php index.html index.htm;

    ssl_certificate ${certPath};
    ssl_certificate_key ${keyPath};
    ssl_trusted_certificate ${chainPath};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # OCSP stapling (tarayıcının CA'ya iptal sorgusu yapmasına gerek kalmaz)
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 1.1.1.1 8.8.8.8 valid=300s;
    resolver_timeout 5s;

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    access_log /var/log/nginx/${domainName}.access.log;
    error_log  /var/log/nginx/${domainName}.error.log;

    client_max_body_size 128M;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \\.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:${phpSock};
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\\.ht {
        deny all;
    }
}
`;
}

// Sertifika varsa SSL'li vhost, yoksa düz HTTP vhost üretir.
// Domain düzenleme/PHP değişimi sırasında daha önce verilmiş SSL'in silinmesini önler.
function buildVhostConfig(domainName, documentRoot, phpVersion) {
  if (hasSslCert(domainName)) {
    const { certPath, keyPath, chainPath } = sslPathsFor(domainName);
    return buildSslNginxVhost(domainName, documentRoot, phpVersion, certPath, keyPath, chainPath);
  }
  return buildNginxVhost(domainName, documentRoot, phpVersion);
}

async function createDomain(userId, name, phpVersion = '8.3') {
  const documentRoot = path.join(WEB_ROOT, name);
  const publicHtml = path.join(documentRoot, 'public_html');
  const logsDir = path.join(documentRoot, 'logs');
  const tmpDir = path.join(documentRoot, 'tmp');

  // Create directory structure
  await runCommand('mkdir', ['-p', publicHtml]);
  await runCommand('mkdir', ['-p', logsDir]);
  await runCommand('mkdir', ['-p', tmpDir]);

  // Write default index.html
  const indexContent = `<!DOCTYPE html>
<html>
<head><title>Welcome to ${name}</title></head>
<body><h1>${name} is working!</h1></body>
</html>`;
  await fs.writeFile(path.join(publicHtml, 'index.html'), indexContent, 'utf8');

  // Set ownership
  await runCommand('chown', ['-R', 'www-data:www-data', documentRoot]);
  await runCommand('chmod', ['-R', '755', documentRoot]);

  // Write nginx vhost config (sertifika varsa SSL'li üretir)
  const nginxConfig = buildVhostConfig(name, documentRoot, phpVersion);
  const configPath = path.join(NGINX_AVAILABLE, `${name}.conf`);
  await fs.writeFile(configPath, nginxConfig, 'utf8');

  // Enable site (symlink)
  const enabledPath = path.join(NGINX_ENABLED, `${name}.conf`);
  try {
    await fs.symlink(configPath, enabledPath);
  } catch (e) {
    // symlink may already exist
  }

  // Test nginx config
  const nginxTest = await testNginxConfig();
  if (!nginxTest.success) {
    // Rollback
    await fs.unlink(configPath).catch(() => {});
    await fs.unlink(enabledPath).catch(() => {});
    throw new Error(`Nginx config test failed: ${nginxTest.stderr}`);
  }

  // Reload nginx
  await reloadNginx();

  // Save to DB
  const domain = await prisma.domain.create({
    data: {
      name,
      userId,
      documentRoot,
      phpVersion,
      webServerConfig: configPath,
    },
  });

  logger.info('Domain created', { domainId: domain.id, name, userId });

  // Auto-create DNS zone with full mail records
  try {
    const dnsService = require('./dnsService');
    await setupDomainDns(domain.id, name, dnsService);
  } catch (err) {
    logger.warn('Auto DNS setup failed (non-fatal)', { domainId: domain.id, error: err.message });
  }

  return domain;
}

async function setupDomainDns(domainId, domainName, dnsService) {
  // Create zone (idempotent - returns existing if already present)
  let zone = await prisma.dnsZone.findUnique({ where: { domainId } });
  if (!zone) {
    zone = await dnsService.createZone(domainId);
  }

  // Records that should exist: A, www, mail, MX, SPF, DMARC, DKIM placeholder.
  // Webmail is intentionally shared at the panel-wide WEBMAIL_URL, not per-domain.
  const needed = [
    { type: 'A',   name: '@',             value: SERVER_IP,                                ttl: 3600 },
    { type: 'A',   name: 'www',           value: SERVER_IP,                                ttl: 3600 },
    { type: 'A',   name: 'mail',          value: SERVER_IP,                                ttl: 3600 },
    { type: 'A',   name: 'ftp',           value: SERVER_IP,                                ttl: 3600 },
    { type: 'MX',  name: '@',             value: `mail.${domainName}.`,                   ttl: 3600, priority: 10 },
    { type: 'TXT', name: '@',             value: `v=spf1 mx a ip4:${SERVER_IP} ~all`,     ttl: 3600 },
    { type: 'TXT', name: '_dmarc',        value: `v=DMARC1; p=quarantine; rua=mailto:postmaster@${domainName}; pct=100`, ttl: 3600 },
    { type: 'TXT', name: 'mail._domainkey', value: `v=DKIM1; k=rsa; p=`, ttl: 3600 },
  ];

  // Get existing records to avoid duplicates
  const existing = await prisma.dnsRecord.findMany({ where: { zoneId: zone.id } });
  const existingKeys = new Set(existing.map(r => `${r.type}:${r.name}`));

  let added = 0;
  for (const rec of needed) {
    const key = `${rec.type}:${rec.name}`;
    if (!existingKeys.has(key)) {
      await prisma.dnsRecord.create({ data: { zoneId: zone.id, ...rec, priority: rec.priority || null } });
      added++;
    }
  }

  if (added > 0) {
    // Bump serial and rewrite zone file
    const newSerial = (zone.serial || 1) + 1;
    await prisma.dnsZone.update({ where: { id: zone.id }, data: { serial: newSerial } });
    const allRecords = await prisma.dnsRecord.findMany({ where: { zoneId: zone.id } });
    const domain = await prisma.domain.findUnique({ where: { id: domainId } });
    const { writeZoneFile, reloadBind } = require('./dnsService');
    // writeZoneFile and reloadBind are not exported — call via dnsService indirectly
    // Reload zone through addRecord which handles the write
    await dnsService.reloadZone(domainId).catch(() => {});
    logger.info(`Auto DNS: added ${added} records for ${domainName}`);
  }
}

async function deleteDomain(domainId) {
  const domain = await prisma.domain.findUnique({ where: { id: domainId } });
  if (!domain) throw new Error('Domain not found');

  // Remove nginx config files
  const configPath = path.join(NGINX_AVAILABLE, `${domain.name}.conf`);
  const enabledPath = path.join(NGINX_ENABLED, `${domain.name}.conf`);

  await fs.unlink(enabledPath).catch(() => {});
  await fs.unlink(configPath).catch(() => {});

  // Reload nginx
  await reloadNginx().catch(() => {});

  // Remove document root
  if (domain.documentRoot && domain.documentRoot.startsWith(WEB_ROOT)) {
    await runCommand('rm', ['-rf', domain.documentRoot]);
  }

  // Delete from DB (cascades subdomains, ssl, ftp, email, dns, db, backups)
  await prisma.domain.delete({ where: { id: domainId } });

  logger.info('Domain deleted', { domainId, name: domain.name });
  return true;
}

async function suspendDomain(domainId) {
  const domain = await prisma.domain.findUnique({ where: { id: domainId } });
  if (!domain) throw new Error('Domain not found');

  // Disable nginx site by removing symlink
  const enabledPath = path.join(NGINX_ENABLED, `${domain.name}.conf`);
  await fs.unlink(enabledPath).catch(() => {});

  // Write suspended config
  const suspendedConfig = `server {
    listen 80;
    server_name ${domain.name} www.${domain.name};
    return 503;
}
`;
  const suspendedPath = path.join(NGINX_AVAILABLE, `${domain.name}_suspended.conf`);
  await fs.writeFile(suspendedPath, suspendedConfig, 'utf8');
  await fs.symlink(suspendedPath, enabledPath).catch(() => {});

  await reloadNginx();

  const updated = await prisma.domain.update({
    where: { id: domainId },
    data: { isSuspended: true, isActive: false },
  });

  logger.info('Domain suspended', { domainId, name: domain.name });
  return updated;
}

async function unsuspendDomain(domainId) {
  const domain = await prisma.domain.findUnique({ where: { id: domainId } });
  if (!domain) throw new Error('Domain not found');

  const enabledPath = path.join(NGINX_ENABLED, `${domain.name}.conf`);
  const suspendedPath = path.join(NGINX_AVAILABLE, `${domain.name}_suspended.conf`);

  await fs.unlink(enabledPath).catch(() => {});
  await fs.unlink(suspendedPath).catch(() => {});

  // Restore normal config symlink
  const configPath = path.join(NGINX_AVAILABLE, `${domain.name}.conf`);
  await fs.symlink(configPath, enabledPath).catch(() => {});

  await reloadNginx();

  const updated = await prisma.domain.update({
    where: { id: domainId },
    data: { isSuspended: false, isActive: true },
  });

  logger.info('Domain unsuspended', { domainId, name: domain.name });
  return updated;
}

async function getDomainStats(domainId) {
  const domain = await prisma.domain.findUnique({ where: { id: domainId } });
  if (!domain) throw new Error('Domain not found');

  const [diskResult, logResult] = await Promise.all([
    runCommand('du', ['-sh', '--bytes', domain.documentRoot]),
    runCommand('du', ['-sh', '--bytes', `/var/log/nginx/${domain.name}.access.log`]),
  ]);

  const diskBytes = parseInt(diskResult.stdout.split('\t')[0]) || 0;
  const logBytes = parseInt(logResult.stdout.split('\t')[0]) || 0;

  return {
    domainId,
    name: domain.name,
    diskUsageBytes: diskBytes,
    diskUsageMB: parseFloat((diskBytes / 1024 / 1024).toFixed(2)),
    logSizeBytes: logBytes,
    logSizeMB: parseFloat((logBytes / 1024 / 1024).toFixed(2)),
  };
}

async function updatePhpVersion(domainId, phpVersion) {
  const domain = await prisma.domain.findUnique({ where: { id: domainId } });
  if (!domain) throw new Error('Domain not found');

  const nginxConfig = buildVhostConfig(domain.name, domain.documentRoot, phpVersion);
  const configPath = path.join(NGINX_AVAILABLE, `${domain.name}.conf`);
  await fs.writeFile(configPath, nginxConfig, 'utf8');

  const nginxTest = await testNginxConfig();
  if (!nginxTest.success) throw new Error(`Nginx config test failed: ${nginxTest.stderr}`);

  await reloadNginx();

  const phpService = `php${phpVersion}-fpm`;
  await systemctlAction(phpService, 'reload').catch(() => {});

  const updated = await prisma.domain.update({
    where: { id: domainId },
    data: { phpVersion },
  });

  logger.info('PHP version updated', { domainId, phpVersion });
  return updated;
}

async function listDomains(userId, isAdmin = false) {
  const where = isAdmin ? {} : { userId };
  return prisma.domain.findMany({
    where,
    include: {
      user: { select: { id: true, username: true, email: true } },
      sslCertificate: { select: { status: true, expiresAt: true } },
      _count: {
        select: {
          subdomains: true,
          emailAccounts: true,
          ftpAccounts: true,
          databases: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function getDomainById(domainId, userId, isAdmin = false) {
  const domain = await prisma.domain.findUnique({
    where: { id: domainId },
    include: {
      user: { select: { id: true, username: true, email: true } },
      sslCertificate: true,
      subdomains: true,
      _count: {
        select: {
          emailAccounts: true,
          ftpAccounts: true,
          databases: true,
          backups: true,
        },
      },
    },
  });
  if (!domain) throw new Error('Domain not found');
  if (!isAdmin && domain.userId !== userId) throw new Error('Access denied');
  return domain;
}

module.exports = {
  createDomain,
  deleteDomain,
  suspendDomain,
  unsuspendDomain,
  getDomainStats,
  updatePhpVersion,
  listDomains,
  getDomainById,
  buildNginxVhost,
  buildSslNginxVhost,
  buildVhostConfig,
  hasSslCert,
};
