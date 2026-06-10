'use strict';

const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const config = require('../config/config');
const { runCommand } = require('../utils/shell');
const logger = require('../utils/logger');

const { bcryptRounds } = config;
const MAIL_BASE = config.hosting.mailBase;

function validatePassword(password) {
  if (!password || password.length < 8) throw new Error('Password must be at least 8 characters');
  if (!/[A-Z]/.test(password)) throw new Error('Password must contain an uppercase letter');
  if (!/[0-9]/.test(password)) throw new Error('Password must contain a number');
}

async function ensureMailbox(domainName, localPart) {
  const mailboxPath = path.join(MAIL_BASE, domainName, localPart);
  await runCommand('mkdir', ['-p', mailboxPath]);
  await runCommand('chown', ['-R', 'vmail:vmail', path.join(MAIL_BASE, domainName)]);
  return mailboxPath;
}

async function writePasswdEntry(address, passwordHash, quotaMB) {
  // Dovecot userdb/passwd-file format:
  // user@domain:password:uid:gid:gecos:home:shell:extra
  // - password is prefixed with {BLF-CRYPT} so Dovecot verifies it as bcrypt
  //   regardless of the passdb default scheme (auth-passwdfile.conf.ext = SHA512-CRYPT).
  //   bcryptjs emits $2a$/$2b$ hashes, which Dovecot BLF-CRYPT accepts.
  // - uid/gid/gecos left empty so Dovecot default_fields apply
  //   (uid=vmail gid=mail home=/var/mail/vhosts/%d/%n). Hardcoding 5000:5000 here
  //   previously broke mailbox access (mailboxes are owned by vmail:mail).
  const passwdFile = '/etc/dovecot/users';
  const quota = `userdb_quota_rule=*:bytes=${quotaMB * 1024 * 1024}`;
  const entry = `${address}:{BLF-CRYPT}${passwordHash}::::${path.join(MAIL_BASE, address.split('@')[1], address.split('@')[0])}::${quota}\n`;

  const current = await fs.readFile(passwdFile, 'utf8').catch(() => '');
  const filtered = current.split('\n').filter(l => !l.startsWith(`${address}:`)).join('\n');
  await fs.writeFile(passwdFile, filtered + '\n' + entry, 'utf8');
}

async function removePasswdEntry(address) {
  const passwdFile = '/etc/dovecot/users';
  const current = await fs.readFile(passwdFile, 'utf8').catch(() => '');
  const filtered = current.split('\n').filter(l => !l.startsWith(`${address}:`)).join('\n');
  await fs.writeFile(passwdFile, filtered, 'utf8');
}

async function createEmailAccount(address, password, domainId, userId, quotaMB = 1024) {
  validatePassword(password);

  const domain = await prisma.domain.findUnique({ where: { id: domainId } });
  if (!domain) throw new Error('Domain not found');

  const [localPart, domainPart] = address.split('@');
  if (domainPart !== domain.name) throw new Error('Email domain does not match');

  const existing = await prisma.emailAccount.findUnique({ where: { address } });
  if (existing) throw new Error('Email address already exists');

  // Check package limits
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { package: true } });
  if (user?.package?.maxEmailAccounts) {
    const count = await prisma.emailAccount.count({ where: { userId } });
    if (count >= user.package.maxEmailAccounts) {
      throw new Error(`Email account limit reached (${user.package.maxEmailAccounts})`);
    }
  }

  const passwordHash = await bcrypt.hash(password, bcryptRounds);
  await ensureMailbox(domain.name, localPart);
  await writePasswdEntry(address, passwordHash, quotaMB);

  const account = await prisma.emailAccount.create({
    data: {
      address,
      passwordHash,
      domainId,
      userId,
      quotaMB,
      isActive: true,
    },
  });

  logger.info('Email account created', { address, domainId, userId });
  return account;
}

async function deleteEmailAccount(emailAccountId) {
  const account = await prisma.emailAccount.findUnique({ where: { id: emailAccountId } });
  if (!account) throw new Error('Email account not found');

  await removePasswdEntry(account.address);

  const [localPart, domainPart] = account.address.split('@');
  const mailboxPath = path.join(MAIL_BASE, domainPart, localPart);
  await runCommand('rm', ['-rf', mailboxPath]);

  await prisma.emailAccount.delete({ where: { id: emailAccountId } });

  logger.info('Email account deleted', { emailAccountId, address: account.address });
  return true;
}

async function changePassword(emailAccountId, newPassword) {
  validatePassword(newPassword);

  const account = await prisma.emailAccount.findUnique({ where: { id: emailAccountId } });
  if (!account) throw new Error('Email account not found');

  const passwordHash = await bcrypt.hash(newPassword, bcryptRounds);
  await writePasswdEntry(account.address, passwordHash, account.quotaMB);

  const updated = await prisma.emailAccount.update({
    where: { id: emailAccountId },
    data: { passwordHash },
  });

  logger.info('Email password changed', { emailAccountId });
  return updated;
}

async function setForward(emailAccountId, forwardTo) {
  const account = await prisma.emailAccount.findUnique({ where: { id: emailAccountId } });
  if (!account) throw new Error('Email account not found');

  // Validate email addresses
  const emails = forwardTo ? forwardTo.split(',').map(e => e.trim()) : [];
  for (const email of emails) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error(`Invalid forward address: ${email}`);
    }
  }

  const updated = await prisma.emailAccount.update({
    where: { id: emailAccountId },
    data: { forwardTo: emails.join(',') },
  });

  logger.info('Email forward set', { emailAccountId, forwardTo });
  return updated;
}

async function setAutoResponder(emailAccountId, message, enabled) {
  const account = await prisma.emailAccount.findUnique({ where: { id: emailAccountId } });
  if (!account) throw new Error('Email account not found');

  const updated = await prisma.emailAccount.update({
    where: { id: emailAccountId },
    data: {
      autoResponder: message || null,
      autoResponderEnabled: enabled,
    },
  });

  logger.info('Auto-responder updated', { emailAccountId, enabled });
  return updated;
}

async function setCatchAll(domainId, emailAccountId) {
  // Clear existing catch-all
  await prisma.emailAccount.updateMany({
    where: { domainId, isCatchAll: true },
    data: { isCatchAll: false },
  });

  if (emailAccountId) {
    const account = await prisma.emailAccount.findFirst({
      where: { id: emailAccountId, domainId },
    });
    if (!account) throw new Error('Email account not found in this domain');

    await prisma.emailAccount.update({
      where: { id: emailAccountId },
      data: { isCatchAll: true },
    });
  }

  logger.info('Catch-all set', { domainId, emailAccountId });
  return true;
}

async function getMailboxUsage(emailAccountId) {
  const account = await prisma.emailAccount.findUnique({ where: { id: emailAccountId } });
  if (!account) throw new Error('Email account not found');

  const [localPart, domainPart] = account.address.split('@');
  const mailboxPath = path.join(MAIL_BASE, domainPart, localPart);

  const result = await runCommand('du', ['-s', '--bytes', mailboxPath]);
  const bytes = parseInt(result.stdout.split('\t')[0]) || 0;
  const usedMB = parseFloat((bytes / 1024 / 1024).toFixed(2));

  await prisma.emailAccount.update({
    where: { id: emailAccountId },
    data: { usedMB },
  });

  return { usedMB, quotaMB: account.quotaMB, bytes };
}

async function listEmailAccounts(domainId, userId, isAdmin = false) {
  const where = { domainId };
  if (!isAdmin) where.userId = userId;

  return prisma.emailAccount.findMany({
    where,
    select: {
      id: true,
      address: true,
      quotaMB: true,
      usedMB: true,
      isActive: true,
      isCatchAll: true,
      forwardTo: true,
      autoResponderEnabled: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

module.exports = {
  createEmailAccount,
  deleteEmailAccount,
  changePassword,
  setForward,
  setAutoResponder,
  setCatchAll,
  getMailboxUsage,
  listEmailAccounts,
};
