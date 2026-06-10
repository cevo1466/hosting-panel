'use strict';

// ============================================================================
// Webmail (Roundcube) — OTOMATIK per-domain provisioning.
// Her domain için `webmail.<domain>` host'u otomatik kurulur: nginx vhost
// (Roundcube paylaşımlı kuruluma bakar) + best-effort Let's Encrypt SSL.
// Domain'in e-posta hesapları kendi `webmail.<domain>` adresine tam e-posta +
// şifre ile girer (Roundcube çok-domainli: username_domain boş).
// DNS `webmail` A kaydı domainService.setupDomainDns içinde eklenir.
// ============================================================================

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const config = require('../config/config');
const { certbotAction, testNginxConfig, reloadNginx } = require('../utils/shell');
const logger = require('../utils/logger');

const NGINX_DIR = config.hosting.nginxSitesAvailable;          // /var/www/nginx-vhosts
const PHP_FPM_SOCK_DIR = config.hosting.phpFpmSockDir;         // /var/run/php
const LE_EMAIL = config.hosting.letsEncryptEmail;
const LE_LIVE = '/etc/letsencrypt/live';

// Roundcube tek fiziksel kurulum; tüm webmail.<domain> host'ları buna bakar.
const ROUNDCUBE_ROOT = process.env.ROUNDCUBE_ROOT || '/var/lib/roundcube/public_html';
const WEBMAIL_PHP_VERSION = process.env.WEBMAIL_PHP_VERSION || '8.3';

function lePaths(fqdn) {
  return {
    certPath: `${LE_LIVE}/${fqdn}/fullchain.pem`,
    keyPath: `${LE_LIVE}/${fqdn}/privkey.pem`,
  };
}

function hasCert(fqdn) {
  const { certPath, keyPath } = lePaths(fqdn);
  try {
    return fsSync.existsSync(certPath) && fsSync.existsSync(keyPath);
  } catch {
    return false;
  }
}

function vhostPath(fqdn) {
  return path.join(NGINX_DIR, `${fqdn}.conf`);
}

// Cert diskte varsa SSL'li (80→443 redirect + 443), yoksa düz HTTP vhost üretir.
// HTTP halinde ACME challenge location'ı korunur → DNS hazır olunca certbot tamamlar.
function buildWebmailVhost(fqdn) {
  const phpSock = `${PHP_FPM_SOCK_DIR}/php${WEBMAIL_PHP_VERSION}-fpm.sock`;
  const phpBlock = `    location ~ \\.php$ {
        include fastcgi_params;
        fastcgi_pass unix:${phpSock};
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        fastcgi_param HTTP_HOST $host;
        fastcgi_read_timeout 60;
    }`;

  if (!hasCert(fqdn)) {
    return `# OTOMATIK webmail vhost (${fqdn}) — Roundcube paylaşımlı kurulum.
# SSL henüz yok; DNS bu sunucuya baktığında certbot otomatik tamamlar.
server {
    listen 80;
    listen [::]:80;
    server_name ${fqdn};

    root ${ROUNDCUBE_ROOT};
    index index.php;
    client_max_body_size 25M;

    location ^~ /.well-known/acme-challenge/ { root ${ROUNDCUBE_ROOT}; try_files $uri =404; }

    location / { try_files $uri $uri/ /index.php?$query_string; }
${phpBlock}
    location ~ /\\.(ht|git) { deny all; }
}
`;
  }

  const { certPath, keyPath } = lePaths(fqdn);
  return `# OTOMATIK webmail vhost (${fqdn}) — Roundcube paylaşımlı kurulum.
server {
    listen 80;
    listen [::]:80;
    server_name ${fqdn};
    location ^~ /.well-known/acme-challenge/ { root ${ROUNDCUBE_ROOT}; try_files $uri =404; }
    location / { return 301 https://$host$request_uri; }
}
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name ${fqdn};

    root ${ROUNDCUBE_ROOT};
    index index.php;

    ssl_certificate ${certPath};
    ssl_certificate_key ${keyPath};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    client_max_body_size 25M;

    location / { try_files $uri $uri/ /index.php?$query_string; }
${phpBlock.replace('fastcgi_read_timeout 60;', 'fastcgi_param HTTPS on;\n        fastcgi_read_timeout 60;')}
    location ~ /\\.(ht|git) { deny all; }
}
`;
}

// Bu fqdn'i BAŞKA bir vhost dosyası zaten sunuyor mu? (örn. elle yazılmış
// webmail.conf melihcevirim için). Varsa otomatik üretimi atlar (çakışmayı önler).
async function fqdnAlreadyServed(fqdn, selfFile) {
  const selfBase = path.basename(selfFile);
  const files = await fs.readdir(NGINX_DIR).catch(() => []);
  const token = new RegExp(`server_name[^;]*(^|\\s)${fqdn.replace(/\./g, '\\.')}(\\s|;)`, 'm');
  for (const f of files) {
    if (!f.endsWith('.conf') || f === selfBase) continue;
    const content = await fs.readFile(path.join(NGINX_DIR, f), 'utf8').catch(() => '');
    if (token.test(content)) return f;
  }
  return null;
}

// Sertifikayı arka planda dener; başarılıysa vhost'u SSL'e yükseltir.
async function issueWebmailSsl(fqdn, email) {
  if (hasCert(fqdn)) return false;
  const leEmail = email || LE_EMAIL;
  if (!leEmail) {
    logger.warn('Webmail SSL skipped: no Let\'s Encrypt email', { fqdn });
    return false;
  }
  const res = await certbotAction([
    'certonly', '--webroot', '--webroot-path', ROUNDCUBE_ROOT,
    '--non-interactive', '--agree-tos', '--email', leEmail,
    '-d', fqdn,
  ]);
  if (res.success && hasCert(fqdn)) {
    await fs.writeFile(vhostPath(fqdn), buildWebmailVhost(fqdn), 'utf8');
    const test = await testNginxConfig();
    if (test.success) await reloadNginx();
    logger.info('Webmail SSL issued', { fqdn });
    return true;
  }
  logger.warn('Webmail SSL deferred (DNS bu sunucuya bakmıyor olabilir)', { fqdn, stderr: (res.stderr || '').slice(0, 300) });
  return false;
}

// Idempotent: webmail.<domain> vhost'u yaz + nginx reload, sonra SSL dene.
// background=true (varsayılan): SSL fire-and-forget → domain oluşturmayı bloklamaz.
async function provisionWebmail(domainName, opts = {}) {
  const { background = true, email } = opts;
  const fqdn = `webmail.${domainName}`;

  // Roundcube kurulu değilse webmail provision'ı atla (taze/webmail'siz kurulumlarda
  // bozuk vhost üretmeyi önler; domain oluşturma akışını etkilemez).
  if (!fsSync.existsSync(ROUNDCUBE_ROOT)) {
    logger.info('Roundcube kurulu değil; webmail provision atlandı', { fqdn, root: ROUNDCUBE_ROOT });
    return { fqdn, ssl: false, skipped: 'no-roundcube' };
  }

  const served = await fqdnAlreadyServed(fqdn, vhostPath(fqdn));
  if (served) {
    logger.info('Webmail zaten mevcut bir vhost tarafından sunuluyor; atlanıyor', { fqdn, file: served });
    return { fqdn, ssl: hasCert(fqdn), skipped: served };
  }

  await fs.writeFile(vhostPath(fqdn), buildWebmailVhost(fqdn), 'utf8');
  const test = await testNginxConfig();
  if (!test.success) {
    await fs.unlink(vhostPath(fqdn)).catch(() => {});
    throw new Error(`Nginx config test failed (webmail ${fqdn}): ${test.stderr}`);
  }
  await reloadNginx();
  logger.info('Webmail vhost kuruldu', { fqdn, ssl: hasCert(fqdn) });

  if (!hasCert(fqdn)) {
    const p = issueWebmailSsl(fqdn, email).catch((err) =>
      logger.warn('Webmail SSL hata (non-fatal)', { fqdn, error: err.message }));
    if (!background) await p;
  }

  return { fqdn, ssl: hasCert(fqdn) };
}

// Domain silinince webmail vhost + cert'i temizler (best-effort, non-fatal).
async function deprovisionWebmail(domainName) {
  const fqdn = `webmail.${domainName}`;
  await fs.unlink(vhostPath(fqdn)).catch(() => {});
  await reloadNginx().catch(() => {});
  await certbotAction(['delete', '--cert-name', fqdn, '--non-interactive']).catch(() => {});
  logger.info('Webmail kaldırıldı', { fqdn });
  return true;
}

module.exports = {
  provisionWebmail,
  deprovisionWebmail,
  issueWebmailSsl,
  buildWebmailVhost,
};
