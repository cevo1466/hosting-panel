'use strict';

const path = require('path');
const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const config = require('../config/config');
const { hostFtpExec } = require('../utils/shell');
const logger = require('../utils/logger');

const { bcryptRounds } = config;
const { ftpUserlistFile: FTP_USERLIST_FILE, ftpShell: FTP_SHELL, ftpWebGroup: FTP_WEB_GROUP } = config.hosting;
const USERNAME_RE = /^[a-z0-9_]{3,32}$/; // route ile aynı; sistem kullanıcı adı güvenliği

function validatePassword(password) {
  if (!password || password.length < 8) throw new Error('Password must be at least 8 characters');
  if (!/[A-Z]/.test(password)) throw new Error('Password must contain at least one uppercase letter');
  if (!/[a-z]/.test(password)) throw new Error('Password must contain at least one lowercase letter');
  if (!/[0-9]/.test(password)) throw new Error('Password must contain at least one number');
  // Route ile tutarlı: boşluk hariç en az bir özel karakter.
  if (!/[^A-Za-z0-9\s]/.test(password)) throw new Error('Password must contain at least one special character');
}

function assertValidUsername(username) {
  if (!USERNAME_RE.test(username)) throw new Error('Geçersiz kullanıcı adı');
}

async function userExistsOnHost(username) {
  const r = await hostFtpExec('getent', ['passwd', username]);
  return r.success && r.stdout.trim().length > 0;
}

// vsftpd userlist (allowlist) her girişte runtime'da okunur → düzenleyince reload gerekmez.
async function readUserlist() {
  const r = await hostFtpExec('cat', [FTP_USERLIST_FILE]);
  if (!r.success) return [];
  return r.stdout.split('\n').map((l) => l.trim()).filter(Boolean);
}

async function writeUserlist(lines) {
  const r = await hostFtpExec('tee', [FTP_USERLIST_FILE], { input: lines.join('\n') + '\n' });
  if (!r.success) throw new Error('vsftpd userlist güncellenemedi: ' + r.stderr);
}

async function addToUserlist(username) {
  const lines = await readUserlist();
  if (!lines.includes(username)) { lines.push(username); await writeUserlist(lines); }
}

async function removeFromUserlist(username) {
  const lines = await readUserlist();
  const filtered = lines.filter((u) => u !== username);
  if (filtered.length !== lines.length) await writeUserlist(filtered);
}

// Host'ta gerçek sistem kullanıcısı oluştur: nologin shell (SSH/SFTP yok), ev dizini =
// domain doküman kökü (vsftpd chroot_local_user ile oraya kilitlenir), parola /etc/shadow'da.
// Hata olursa yarım kalan kullanıcıyı geri alır (ev dizinini ASLA silmez).
async function provisionSystemFtpUser(username, password, homeDir) {
  assertValidUsername(username);
  if (await userExistsOnHost(username)) {
    throw new Error('Bu kullanıcı adı sunucuda zaten kullanılıyor; farklı bir ad seçin');
  }

  const mk = await hostFtpExec('mkdir', ['-p', homeDir]);
  if (!mk.success) throw new Error('Dizin oluşturulamadı: ' + mk.stderr);

  const add = await hostFtpExec('useradd', ['-M', '-d', homeDir, '-s', FTP_SHELL, username]);
  if (!add.success) throw new Error('Sistem kullanıcısı oluşturulamadı: ' + add.stderr);

  try {
    const pw = await hostFtpExec('chpasswd', [], { input: `${username}:${password}\n` });
    if (!pw.success) throw new Error('Parola ayarlanamadı: ' + pw.stderr);

    // Sahip = FTP kullanıcısı, grup = web grubu (nginx/php okusun/yazsın);
    // setgid'li kök dizinde yeni dosyalar grubu devralır. rwX, FTP hesabının
    // mevcut içerikleri silmesini/üzerine yazmasını sağlar.
    await hostFtpExec('chown', ['-R', `${username}:${FTP_WEB_GROUP}`, homeDir]);
    await hostFtpExec('chmod', ['-R', 'u+rwX,g+rwX', homeDir]);
    await hostFtpExec('chmod', ['2775', homeDir]);

    await addToUserlist(username);
  } catch (err) {
    await hostFtpExec('userdel', [username]).catch(() => {});   // ev dizinini SİLME (-r yok)
    await removeFromUserlist(username).catch(() => {});
    throw err;
  }
}

async function deprovisionSystemFtpUser(username) {
  assertValidUsername(username);
  await removeFromUserlist(username);
  const del = await hostFtpExec('userdel', [username]); // -r YOK: site dosyaları silinmesin
  if (!del.success && !/does not exist|no such user/i.test(del.stderr)) {
    logger.warn('userdel sorun çıkardı', { username, stderr: del.stderr });
  }
}

async function createFtpAccount(username, password, homeDir, domainId, userId, subdomainId, quota, isAdmin = false) {
  validatePassword(password);

  // Check domain ownership
  const domain = await prisma.domain.findUnique({ where: { id: domainId } });
  if (!domain) throw new Error('Domain not found');
  // Admin olmayan kullanıcı yalnızca kendi domaini için FTP hesabı açabilir (host'ta
  // sistem kullanıcısı oluşturulduğundan bu yetki kontrolü önemli).
  if (!isAdmin && domain.userId && domain.userId !== userId) {
    throw new Error('Bu domain size ait değil');
  }

  // Check username not already taken
  const existing = await prisma.ftpAccount.findUnique({ where: { username } });
  if (existing) throw new Error('FTP username already exists');

  // Resolve the home directory. For a subdomain account the path is derived
  // server-side from the (validated, ownership-checked) subdomain — it is never
  // trusted from the client. A custom homeDir, if supplied, must stay inside the
  // web root to prevent path traversal (chown/chmod run on this path).
  const webRoot = path.resolve(config.hosting.webRoot);
  let resolvedHomeDir;
  if (subdomainId) {
    const subdomain = await prisma.subdomain.findUnique({ where: { id: subdomainId } });
    if (!subdomain || subdomain.domainId !== domainId) {
      throw new Error('Subdomain not found for this domain');
    }
    resolvedHomeDir = path.join(subdomain.documentRoot, 'public_html');
  } else if (homeDir) {
    const normalized = path.resolve(homeDir);
    if (normalized !== webRoot && !normalized.startsWith(webRoot + path.sep)) {
      throw new Error('Home directory must be inside the web root');
    }
    resolvedHomeDir = normalized;
  } else {
    resolvedHomeDir = path.join(domain.documentRoot, 'public_html');
  }

  // Check package limits
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { package: true } });
  if (user?.package?.maxFtpAccounts) {
    const count = await prisma.ftpAccount.count({ where: { userId } });
    if (count >= user.package.maxFtpAccounts) {
      throw new Error(`FTP account limit reached (${user.package.maxFtpAccounts})`);
    }
  }

  const passwordHash = await bcrypt.hash(password, bcryptRounds); // DB kaydı için; gerçek auth /etc/shadow'dan

  // Host'ta gerçek sistem kullanıcısı aç (vsftpd local_enable + userlist modeli).
  await provisionSystemFtpUser(username, password, resolvedHomeDir);

  let account;
  try {
    account = await prisma.ftpAccount.create({
      data: {
        username,
        passwordHash,
        domainId,
        userId,
        homeDir: resolvedHomeDir,
        quota: Number.isInteger(quota) && quota >= 0 ? quota : 0,
        isActive: true,
      },
    });
  } catch (err) {
    await deprovisionSystemFtpUser(username).catch(() => {}); // DB kaydı oluşmadıysa sistem kullanıcısını geri al
    throw err;
  }

  logger.info('FTP account created', { username, domainId, userId, subdomainId: subdomainId || null });
  return account;
}

async function deleteFtpAccount(ftpAccountId) {
  const account = await prisma.ftpAccount.findUnique({ where: { id: ftpAccountId } });
  if (!account) throw new Error('FTP account not found');

  await deprovisionSystemFtpUser(account.username);

  await prisma.ftpAccount.delete({ where: { id: ftpAccountId } });

  logger.info('FTP account deleted', { ftpAccountId, username: account.username });
  return true;
}

async function changePassword(ftpAccountId, newPassword) {
  validatePassword(newPassword);

  const account = await prisma.ftpAccount.findUnique({ where: { id: ftpAccountId } });
  if (!account) throw new Error('FTP account not found');
  if (!(await userExistsOnHost(account.username))) {
    throw new Error('Sistem kullanıcısı bulunamadı (hesap eski sürümle oluşmuş olabilir; silip yeniden oluşturun)');
  }

  const pw = await hostFtpExec('chpasswd', [], { input: `${account.username}:${newPassword}\n` });
  if (!pw.success) throw new Error('Parola değiştirilemedi: ' + pw.stderr);

  const passwordHash = await bcrypt.hash(newPassword, bcryptRounds); // DB kaydı
  const updated = await prisma.ftpAccount.update({
    where: { id: ftpAccountId },
    data: { passwordHash },
  });

  logger.info('FTP password changed', { ftpAccountId, username: account.username });
  return updated;
}

async function toggleActive(ftpAccountId, isActive) {
  const account = await prisma.ftpAccount.findUnique({ where: { id: ftpAccountId } });
  if (!account) throw new Error('FTP account not found');

  // Frontend gövde göndermiyor → mevcut değeri tersine çevir.
  const next = typeof isActive === 'boolean' ? isActive : !account.isActive;

  // Sistemde uygula: pasif = parolayı kilitle (-L), aktif = aç (-U). Bir sonraki girişte etkili.
  if (await userExistsOnHost(account.username)) {
    const r = await hostFtpExec('usermod', [next ? '-U' : '-L', account.username]);
    if (!r.success) logger.warn('usermod lock/unlock sorunlu', { username: account.username, stderr: r.stderr });
  }

  const updated = await prisma.ftpAccount.update({
    where: { id: ftpAccountId },
    data: { isActive: next },
  });

  logger.info('FTP account toggled', { ftpAccountId, isActive: next });
  return updated;
}

async function listAccounts(domainId, userId, isAdmin = false) {
  const where = {};
  if (domainId) where.domainId = domainId;
  if (!isAdmin) where.userId = userId;

  return prisma.ftpAccount.findMany({
    where,
    select: {
      id: true,
      username: true,
      homeDir: true,
      quota: true,
      isActive: true,
      lastLogin: true,
      lastLoginIp: true,
      createdAt: true,
      domain: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function syncFtpAccounts(adminUserId) {
  const crypto = require('crypto');

  // Read vsftpd allowlist
  const r = await hostFtpExec('cat', [FTP_USERLIST_FILE]);
  if (!r.success) throw new Error('vsftpd userlist okunamadı: ' + r.stderr);

  const usernames = r.stdout.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

  // Get all domains for matching
  const domains = await prisma.domain.findMany({ select: { id: true, name: true, documentRoot: true, userId: true } });

  const imported = [];
  const skipped = [];

  for (const username of usernames) {
    const existing = await prisma.ftpAccount.findUnique({ where: { username } });
    if (existing) { skipped.push({ username, reason: 'zaten mevcut' }); continue; }

    const ge = await hostFtpExec('getent', ['passwd', username]);
    if (!ge.success || !ge.stdout.trim()) { skipped.push({ username, reason: 'sistem kullanıcısı bulunamadı' }); continue; }

    const parts = ge.stdout.trim().split(':');
    if (parts.length < 7) { skipped.push({ username, reason: 'geçersiz passwd girişi' }); continue; }
    const homeDir = parts[5];

    // Match homeDir to domain
    let matchedDomain = null;
    for (const d of domains) {
      if (homeDir === d.documentRoot || homeDir.startsWith(d.documentRoot + '/') || homeDir.startsWith(d.documentRoot + path.sep)) {
        matchedDomain = d;
        break;
      }
    }
    // Fallback: domain name in path
    if (!matchedDomain) {
      for (const d of domains) {
        if (homeDir.includes(d.name)) { matchedDomain = d; break; }
      }
    }

    if (!matchedDomain) { skipped.push({ username, reason: `eşleşen domain bulunamadı (homeDir: ${homeDir})` }); continue; }

    const placeholderHash = await bcrypt.hash(crypto.randomUUID(), 4);

    await prisma.ftpAccount.create({
      data: {
        username,
        passwordHash: placeholderHash,
        domainId: matchedDomain.id,
        userId: matchedDomain.userId || adminUserId,
        homeDir,
        quota: 0,
        isActive: true,
      },
    });

    imported.push(username);
    logger.info('FTP account synced from system', { username, domainId: matchedDomain.id, homeDir });
  }

  return { imported, skipped };
}

module.exports = {
  createFtpAccount,
  deleteFtpAccount,
  changePassword,
  toggleActive,
  listAccounts,
  syncFtpAccounts,
};
