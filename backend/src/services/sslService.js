'use strict';

const fs = require('fs').promises;
const path = require('path');
const prisma = require('../config/database');
const config = require('../config/config');
const { certbotAction, testNginxConfig, reloadNginx } = require('../utils/shell');
const logger = require('../utils/logger');

const WEB_ROOT = config.hosting.webRoot;
const LE_EMAIL = config.hosting.letsEncryptEmail;

async function installSsl(domainId, email) {
  const domain = await prisma.domain.findUnique({ where: { id: domainId } });
  if (!domain) throw new Error('Domain not found');

  const webroot = path.join(domain.documentRoot, 'public_html');
  const leEmail = email || LE_EMAIL;
  if (!leEmail) throw new Error('Email required for SSL installation');

  // Run certbot on host via nsenter
  const result = await certbotAction([
    'certonly',
    '--webroot',
    '--webroot-path', webroot,
    '--non-interactive',
    '--agree-tos',
    '--email', leEmail,
    '-d', domain.name,
    '-d', `www.${domain.name}`,
  ]);

  if (!result.success) throw new Error(`Certbot failed: ${result.stderr}`);

  const certPath = `/etc/letsencrypt/live/${domain.name}/fullchain.pem`;
  const keyPath = `/etc/letsencrypt/live/${domain.name}/privkey.pem`;
  const chainPath = `/etc/letsencrypt/live/${domain.name}/chain.pem`;

  // Read cert expiry
  const expiresAt = await getCertExpiry(certPath);

  // Update nginx config with SSL (builder domainService'te merkezi tutulur)
  const { buildSslNginxVhost } = require('./domainService');
  const nginxConfig = buildSslNginxVhost(domain.name, domain.documentRoot, domain.phpVersion, certPath, keyPath, chainPath);
  const configPath = path.join(config.hosting.nginxSitesAvailable, `${domain.name}.conf`);
  await fs.writeFile(configPath, nginxConfig, 'utf8');

  const nginxTest = await testNginxConfig();
  if (!nginxTest.success) throw new Error(`Nginx config test failed: ${nginxTest.stderr}`);
  await reloadNginx();

  // Save to DB
  const existing = await prisma.sslCertificate.findUnique({ where: { domainId } });
  let ssl;
  if (existing) {
    ssl = await prisma.sslCertificate.update({
      where: { id: existing.id },
      data: {
        provider: 'letsencrypt',
        commonName: domain.name,
        issuedAt: new Date(),
        expiresAt,
        status: 'active',
        certPath,
        keyPath,
        chainPath,
        autoRenew: true,
      },
    });
  } else {
    ssl = await prisma.sslCertificate.create({
      data: {
        domainId,
        provider: 'letsencrypt',
        commonName: domain.name,
        issuedAt: new Date(),
        expiresAt,
        status: 'active',
        certPath,
        keyPath,
        chainPath,
        autoRenew: true,
      },
    });
  }

  logger.info('SSL installed', { domainId, domain: domain.name });
  return ssl;
}

async function installSslForSubdomain(subdomainId, email) {
  const sub = await prisma.subdomain.findUnique({
    where: { id: subdomainId },
    include: { domain: true },
  });
  if (!sub) throw new Error('Subdomain not found');

  const fqdn = `${sub.name}.${sub.domain.name}`;
  const webroot = path.join(sub.documentRoot, 'public_html');
  const leEmail = email || LE_EMAIL;
  if (!leEmail) throw new Error('Email required for SSL installation');

  // Subdomain için tek host (-d fqdn); www yok.
  const result = await certbotAction([
    'certonly',
    '--webroot',
    '--webroot-path', webroot,
    '--non-interactive',
    '--agree-tos',
    '--email', leEmail,
    '-d', fqdn,
  ]);

  if (!result.success) throw new Error(`Certbot failed: ${result.stderr}`);

  const certPath = `/etc/letsencrypt/live/${fqdn}/fullchain.pem`;
  const keyPath = `/etc/letsencrypt/live/${fqdn}/privkey.pem`;
  const chainPath = `/etc/letsencrypt/live/${fqdn}/chain.pem`;

  const expiresAt = await getCertExpiry(certPath);

  const { buildSubdomainSslNginxVhost } = require('./subdomainService');
  const nginxConfig = buildSubdomainSslNginxVhost(fqdn, sub.documentRoot, sub.phpVersion, certPath, keyPath, chainPath);
  const configPath = path.join(config.hosting.nginxSitesAvailable, `${fqdn}.conf`);
  await fs.writeFile(configPath, nginxConfig, 'utf8');

  const nginxTest = await testNginxConfig();
  if (!nginxTest.success) throw new Error(`Nginx config test failed: ${nginxTest.stderr}`);
  await reloadNginx();

  const data = {
    provider: 'letsencrypt',
    commonName: fqdn,
    issuedAt: new Date(),
    expiresAt,
    status: 'active',
    certPath,
    keyPath,
    chainPath,
    autoRenew: true,
  };

  const existing = await prisma.sslCertificate.findUnique({ where: { subdomainId } });
  const ssl = existing
    ? await prisma.sslCertificate.update({ where: { id: existing.id }, data })
    : await prisma.sslCertificate.create({ data: { subdomainId, ...data } });

  logger.info('SSL installed (subdomain)', { subdomainId, fqdn });
  return ssl;
}

async function renewSsl(domainId) {
  const domain = await prisma.domain.findUnique({ where: { id: domainId } });
  if (!domain) throw new Error('Domain not found');

  const result = await certbotAction([
    'renew',
    '--cert-name', domain.name,
    '--non-interactive',
    '--quiet',
  ]);

  if (!result.success) throw new Error(`Certbot renew failed: ${result.stderr}`);

  const certPath = `/etc/letsencrypt/live/${domain.name}/fullchain.pem`;
  const expiresAt = await getCertExpiry(certPath);

  await reloadNginx();

  const ssl = await prisma.sslCertificate.update({
    where: { domainId },
    data: { expiresAt, status: 'active', issuedAt: new Date() },
  });

  logger.info('SSL renewed', { domainId, domain: domain.name });
  return ssl;
}

async function revokeSsl(domainId) {
  const domain = await prisma.domain.findUnique({ where: { id: domainId } });
  if (!domain) throw new Error('Domain not found');

  const result = await certbotAction([
    'delete',
    '--cert-name', domain.name,
    '--non-interactive',
  ]);

  if (!result.success) throw new Error(`Certbot delete failed: ${result.stderr}`);

  // Rewrite nginx config without SSL
  const { buildNginxVhost } = require('./domainService');
  const nginxConfig = buildNginxVhost(domain.name, domain.documentRoot, domain.phpVersion);
  const configPath = path.join(config.hosting.nginxSitesAvailable, `${domain.name}.conf`);
  await fs.writeFile(configPath, nginxConfig, 'utf8');
  await reloadNginx();

  await prisma.sslCertificate.update({
    where: { domainId },
    data: { status: 'revoked', certPath: null, keyPath: null, chainPath: null },
  });

  logger.info('SSL revoked', { domainId, domain: domain.name });
  return true;
}

async function renewSslForSubdomain(subdomainId) {
  const sub = await prisma.subdomain.findUnique({
    where: { id: subdomainId },
    include: { domain: true },
  });
  if (!sub) throw new Error('Subdomain not found');

  const fqdn = `${sub.name}.${sub.domain.name}`;
  const result = await certbotAction([
    'renew',
    '--cert-name', fqdn,
    '--non-interactive',
    '--quiet',
  ]);

  if (!result.success) throw new Error(`Certbot renew failed: ${result.stderr}`);

  const certPath = `/etc/letsencrypt/live/${fqdn}/fullchain.pem`;
  const expiresAt = await getCertExpiry(certPath);

  await reloadNginx();

  const ssl = await prisma.sslCertificate.update({
    where: { subdomainId },
    data: { expiresAt, status: 'active', issuedAt: new Date() },
  });

  logger.info('SSL renewed (subdomain)', { subdomainId, fqdn });
  return ssl;
}

async function revokeSslForSubdomain(subdomainId) {
  const sub = await prisma.subdomain.findUnique({
    where: { id: subdomainId },
    include: { domain: true },
  });
  if (!sub) throw new Error('Subdomain not found');

  const fqdn = `${sub.name}.${sub.domain.name}`;
  const result = await certbotAction([
    'delete',
    '--cert-name', fqdn,
    '--non-interactive',
  ]);

  if (!result.success) throw new Error(`Certbot delete failed: ${result.stderr}`);

  // SSL'siz düz subdomain vhost'una geri dön
  const { buildSubdomainNginxVhost } = require('./subdomainService');
  const nginxConfig = buildSubdomainNginxVhost(fqdn, sub.documentRoot, sub.phpVersion);
  const configPath = path.join(config.hosting.nginxSitesAvailable, `${fqdn}.conf`);
  await fs.writeFile(configPath, nginxConfig, 'utf8');
  await reloadNginx();

  await prisma.sslCertificate.update({
    where: { subdomainId },
    data: { status: 'revoked', certPath: null, keyPath: null, chainPath: null },
  });

  logger.info('SSL revoked (subdomain)', { subdomainId, fqdn });
  return true;
}

async function checkCertExpiry(domainId) {
  const ssl = await prisma.sslCertificate.findUnique({ where: { domainId } });
  return checkCertStatus(ssl);
}

// Bir sertifika kaydının (domain ya da subdomain) kalan gün/expiry durumunu hesaplar.
async function checkCertStatus(ssl) {
  if (!ssl) return null;

  if (ssl.certPath) {
    try {
      const expiresAt = await getCertExpiry(ssl.certPath);
      const daysLeft = Math.floor((expiresAt - Date.now()) / 1000 / 86400);
      return { ...ssl, daysLeft, expiresAt };
    } catch {
      // fall back to DB value
    }
  }

  const daysLeft = ssl.expiresAt
    ? Math.floor((new Date(ssl.expiresAt) - Date.now()) / 1000 / 86400)
    : null;

  return { ...ssl, daysLeft };
}

async function getCertExpiry(certPath) {
  // Read PEM and parse validity - we use fs since openssl is not in whitelist
  // Parse the NOT AFTER line from PEM cert via Node crypto
  const crypto = require('crypto');
  const certPem = await fs.readFile(certPath, 'utf8');
  const cert = new crypto.X509Certificate(certPem);
  return new Date(cert.validTo);
}

async function autoRenewCheck() {
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const expiringSoon = await prisma.sslCertificate.findMany({
    where: {
      status: 'active',
      autoRenew: true,
      expiresAt: { lte: thirtyDaysFromNow },
    },
    include: { domain: true, subdomain: true },
  });

  const results = [];
  for (const ssl of expiringSoon) {
    try {
      if (ssl.domainId) {
        await renewSsl(ssl.domainId);
        results.push({ domainId: ssl.domainId, status: 'renewed' });
      } else if (ssl.subdomainId) {
        await renewSslForSubdomain(ssl.subdomainId);
        results.push({ subdomainId: ssl.subdomainId, status: 'renewed' });
      }
    } catch (err) {
      logger.error('Auto-renew failed', { sslId: ssl.id, error: err.message });
      results.push({ domainId: ssl.domainId, subdomainId: ssl.subdomainId, status: 'failed', error: err.message });

      // Update status to show failure
      await prisma.sslCertificate.update({
        where: { id: ssl.id },
        data: { status: 'failed' },
      }).catch(() => {});
    }
  }

  return results;
}

async function listSslCertificates(userId, isAdmin = false) {
  // Subdomain sertifikalarında `domain` null olur; sahipliği subdomain.domain üzerinden de eşle.
  const where = isAdmin
    ? {}
    : { OR: [{ domain: { userId } }, { subdomain: { domain: { userId } } }] };

  return prisma.sslCertificate.findMany({
    where,
    include: {
      domain: { select: { id: true, name: true, userId: true } },
      subdomain: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

module.exports = {
  installSsl,
  installSslForSubdomain,
  renewSsl,
  renewSslForSubdomain,
  revokeSsl,
  revokeSslForSubdomain,
  checkCertExpiry,
  checkCertStatus,
  autoRenewCheck,
  listSslCertificates,
};
