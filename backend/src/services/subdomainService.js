'use strict';

const fs = require('fs').promises;
const path = require('path');
const prisma = require('../config/database');
const config = require('../config/config');
const { runCommand, testNginxConfig, reloadNginx } = require('../utils/shell');
const { buildNginxVhost, hasSslCert } = require('./domainService');
const { addSubdomainRecord } = require('./dnsService');
const logger = require('../utils/logger');

const WEB_ROOT = config.hosting.webRoot;
const NGINX_AVAILABLE = config.hosting.nginxSitesAvailable;
const NGINX_ENABLED = config.hosting.nginxSitesEnabled;
const PHP_FPM_SOCK_DIR = config.hosting.phpFpmSockDir;

function buildSubdomainNginxVhost(fqdn, documentRoot, phpVersion) {
  const phpSock = `${PHP_FPM_SOCK_DIR}/php${phpVersion}-fpm.sock`;
  return `server {
    listen 80;
    listen [::]:80;
    server_name ${fqdn};

    root ${documentRoot}/public_html;
    index index.php index.html index.htm;

    access_log /var/log/nginx/${fqdn}.access.log;
    error_log  /var/log/nginx/${fqdn}.error.log;

    client_max_body_size 128M;

    location ^~ /.well-known/acme-challenge/ {
        root ${documentRoot}/public_html;
        try_files $uri =404;
    }

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

function buildSubdomainSslNginxVhost(fqdn, documentRoot, phpVersion, certPath, keyPath, chainPath) {
  const phpSock = `${PHP_FPM_SOCK_DIR}/php${phpVersion}-fpm.sock`;
  return `server {
    listen 80;
    listen [::]:80;
    server_name ${fqdn};

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
    server_name ${fqdn};

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

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;

    access_log /var/log/nginx/${fqdn}.access.log;
    error_log  /var/log/nginx/${fqdn}.error.log;

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

// Sertifika diskte varsa SSL'li, yoksa düz HTTP vhost üretir.
// PHP değişimi / yeniden yazımda daha önce kurulmuş SSL'in silinmesini önler.
function buildSubdomainVhostConfig(fqdn, documentRoot, phpVersion) {
  if (hasSslCert(fqdn)) {
    const certPath = `/etc/letsencrypt/live/${fqdn}/fullchain.pem`;
    const keyPath = `/etc/letsencrypt/live/${fqdn}/privkey.pem`;
    const chainPath = `/etc/letsencrypt/live/${fqdn}/chain.pem`;
    return buildSubdomainSslNginxVhost(fqdn, documentRoot, phpVersion, certPath, keyPath, chainPath);
  }
  return buildSubdomainNginxVhost(fqdn, documentRoot, phpVersion);
}

async function createSubdomain(domainId, name, phpVersion, userId, isAdmin = false) {
  const domain = await prisma.domain.findUnique({ where: { id: domainId } });
  if (!domain) throw new Error('Domain not found');
  if (!isAdmin && domain.userId !== userId) throw new Error('Access denied');

  const existing = await prisma.subdomain.findFirst({ where: { name, domainId } });
  if (existing) throw new Error('Subdomain already exists');

  const fqdn = `${name}.${domain.name}`;
  const documentRoot = path.join(WEB_ROOT, fqdn);
  const publicHtml = path.join(documentRoot, 'public_html');

  await runCommand('mkdir', ['-p', publicHtml]);
  await runCommand('chown', ['-R', 'www-data:www-data', documentRoot]);

  const nginxConfig = buildSubdomainNginxVhost(fqdn, documentRoot, phpVersion || '8.3');
  const configPath = path.join(NGINX_AVAILABLE, `${fqdn}.conf`);
  await fs.writeFile(configPath, nginxConfig, 'utf8');

  const enabledPath = path.join(NGINX_ENABLED, `${fqdn}.conf`);
  await fs.symlink(configPath, enabledPath).catch(() => {});

  const nginxTest = await testNginxConfig();
  if (!nginxTest.success) throw new Error(`Nginx config test failed: ${nginxTest.stderr}`);
  const nginxReload = await reloadNginx();
  if (!nginxReload.success) throw new Error(`Nginx reload failed: ${nginxReload.stderr || 'unknown error'}`);

  try {
    await addSubdomainRecord(domainId, name);
  } catch (err) {
    logger.error('Subdomain DNS setup failed; rolling back filesystem changes', {
      domainId,
      name,
      fqdn,
      error: err.message,
    });
    await fs.unlink(enabledPath).catch(() => {});
    await fs.unlink(configPath).catch(() => {});
    if (documentRoot.startsWith(WEB_ROOT)) {
      await runCommand('rm', ['-rf', documentRoot]).catch(() => {});
    }
    await reloadNginx().catch(() => {});
    throw new Error(`Subdomain DNS setup failed: ${err.message}`);
  }

  return prisma.subdomain.create({
    data: { name, domainId, documentRoot, phpVersion: phpVersion || '8.3' },
  });
}

async function deleteSubdomain(subdomainId, userId, isAdmin = false) {
  const sub = await prisma.subdomain.findUnique({
    where: { id: subdomainId },
    include: { domain: true },
  });
  if (!sub) throw new Error('Subdomain not found');
  if (!isAdmin && sub.domain.userId !== userId) throw new Error('Access denied');

  const fqdn = `${sub.name}.${sub.domain.name}`;
  await fs.unlink(path.join(NGINX_ENABLED, `${fqdn}.conf`)).catch(() => {});
  await fs.unlink(path.join(NGINX_AVAILABLE, `${fqdn}.conf`)).catch(() => {});
  await reloadNginx().catch(() => {});

  if (sub.documentRoot && sub.documentRoot.startsWith(WEB_ROOT)) {
    await runCommand('rm', ['-rf', sub.documentRoot]);
  }

  await prisma.subdomain.delete({ where: { id: subdomainId } });
  return true;
}

async function updateSubdomain(subdomainId, phpVersion, userId, isAdmin = false) {
  const sub = await prisma.subdomain.findUnique({
    where: { id: subdomainId },
    include: { domain: true },
  });
  if (!sub) throw new Error('Subdomain not found');
  if (!isAdmin && sub.domain.userId !== userId) throw new Error('Access denied');

  const fqdn = `${sub.name}.${sub.domain.name}`;
  // SSL kuruluysa koru: sertifika diskte varsa SSL'li vhost yeniden üretilir.
  const nginxConfig = buildSubdomainVhostConfig(fqdn, sub.documentRoot, phpVersion);
  const configPath = path.join(NGINX_AVAILABLE, `${fqdn}.conf`);
  await fs.writeFile(configPath, nginxConfig, 'utf8');
  await reloadNginx();

  return prisma.subdomain.update({
    where: { id: subdomainId },
    data: { phpVersion },
  });
}

async function listSubdomains(domainId, userId, isAdmin = false) {
  const domain = await prisma.domain.findUnique({ where: { id: domainId } });
  if (!domain) throw new Error('Domain not found');
  if (!isAdmin && domain.userId !== userId) throw new Error('Access denied');

  return prisma.subdomain.findMany({
    where: { domainId },
    include: { sslCertificate: { select: { status: true, expiresAt: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

// Kullanıcının tüm domainlerindeki subdomainleri (SSL durumu + parent domain ile) döner.
async function listAllSubdomains(userId, isAdmin = false) {
  const where = isAdmin ? {} : { domain: { userId } };
  return prisma.subdomain.findMany({
    where,
    include: {
      domain: { select: { id: true, name: true } },
      sslCertificate: { select: { id: true, status: true, expiresAt: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

module.exports = {
  createSubdomain,
  deleteSubdomain,
  updateSubdomain,
  listSubdomains,
  listAllSubdomains,
  buildSubdomainNginxVhost,
  buildSubdomainSslNginxVhost,
  buildSubdomainVhostConfig,
};
