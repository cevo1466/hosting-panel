'use strict';

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const prisma = require('../config/database');
const config = require('../config/config');
const { runCommand } = require('../utils/shell');
const logger = require('../utils/logger');

const WEB_ROOT = config.hosting.webRoot;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function resolveSecurePath(domainRoot, relativePath) {
  if (!relativePath) relativePath = '/';
  // Normalize and prevent path traversal
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
  const fullPath = path.join(domainRoot, normalized);
  if (!fullPath.startsWith(domainRoot)) {
    throw new Error('Path traversal detected');
  }
  return fullPath;
}

async function getDomainRoot(domainId, userId, isAdmin = false) {
  const domain = await prisma.domain.findUnique({ where: { id: domainId } });
  if (!domain) throw new Error('Domain not found');
  if (!isAdmin && domain.userId !== userId) throw new Error('Access denied');
  return domain.documentRoot;
}

async function getSubdomainRoot(subdomainId, userId, isAdmin = false) {
  const subdomain = await prisma.subdomain.findUnique({
    where: { id: subdomainId },
    include: { domain: true },
  });
  if (!subdomain) throw new Error('Subdomain not found');
  if (!isAdmin && subdomain.domain.userId !== userId) throw new Error('Access denied');
  return subdomain.documentRoot;
}

async function getFileRoot(targetId, userId, isAdmin = false, targetType = 'domain') {
  if (targetType === 'subdomain') {
    return getSubdomainRoot(targetId, userId, isAdmin);
  }
  return getDomainRoot(targetId, userId, isAdmin);
}

async function listFiles(targetId, relativePath, userId, isAdmin = false, targetType = 'domain') {
  const domainRoot = await getFileRoot(targetId, userId, isAdmin, targetType);
  const fullPath = resolveSecurePath(domainRoot, relativePath || '/');

  const stat = await fsPromises.stat(fullPath);
  if (!stat.isDirectory()) throw new Error('Not a directory');

  const entries = await fsPromises.readdir(fullPath, { withFileTypes: true });
  const result = [];

  for (const entry of entries) {
    const entryPath = path.join(fullPath, entry.name);
    const entryStat = await fsPromises.stat(entryPath).catch(() => null);
    if (!entryStat) continue;

    result.push({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file',
      size: entryStat.size,
      modified: entryStat.mtime.toISOString(),
      permissions: (entryStat.mode & 0o777).toString(8),
      path: path.join(relativePath || '/', entry.name).replace(/\\/g, '/'),
    });
  }

  return result.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

async function readFile(targetId, relativePath, userId, isAdmin = false, targetType = 'domain') {
  const domainRoot = await getFileRoot(targetId, userId, isAdmin, targetType);
  const fullPath = resolveSecurePath(domainRoot, relativePath);

  const stat = await fsPromises.stat(fullPath);
  if (stat.isDirectory()) throw new Error('Cannot read a directory');
  if (stat.size > MAX_FILE_SIZE) throw new Error('File too large (max 5MB)');

  const content = await fsPromises.readFile(fullPath, 'utf8');
  return { content, size: stat.size, path: relativePath };
}

async function writeFile(targetId, relativePath, content, userId, isAdmin = false, targetType = 'domain') {
  const domainRoot = await getFileRoot(targetId, userId, isAdmin, targetType);
  const fullPath = resolveSecurePath(domainRoot, relativePath);

  await fsPromises.mkdir(path.dirname(fullPath), { recursive: true });
  await fsPromises.writeFile(fullPath, content, 'utf8');

  logger.info('File written', { targetId, targetType, path: relativePath });
  return true;
}

async function deleteFile(targetId, relativePath, userId, isAdmin = false, targetType = 'domain') {
  const domainRoot = await getFileRoot(targetId, userId, isAdmin, targetType);
  const fullPath = resolveSecurePath(domainRoot, relativePath);

  const stat = await fsPromises.stat(fullPath);
  if (stat.isDirectory()) {
    await runCommand('rm', ['-rf', fullPath]);
  } else {
    await fsPromises.unlink(fullPath);
  }

  logger.info('File deleted', { targetId, targetType, path: relativePath });
  return true;
}

async function createDirectory(targetId, relativePath, userId, isAdmin = false, targetType = 'domain') {
  const domainRoot = await getFileRoot(targetId, userId, isAdmin, targetType);
  const fullPath = resolveSecurePath(domainRoot, relativePath);

  await runCommand('mkdir', ['-p', fullPath]);

  logger.info('Directory created', { targetId, targetType, path: relativePath });
  return true;
}

async function renameItem(targetId, oldPath, newPath, userId, isAdmin = false, targetType = 'domain') {
  const domainRoot = await getFileRoot(targetId, userId, isAdmin, targetType);
  const fullOldPath = resolveSecurePath(domainRoot, oldPath);
  const fullNewPath = resolveSecurePath(domainRoot, newPath);

  await fsPromises.rename(fullOldPath, fullNewPath);

  logger.info('Item renamed', { targetId, targetType, oldPath, newPath });
  return true;
}

async function uploadFile(targetId, relativePath, fileBuffer, userId, isAdmin = false, targetType = 'domain') {
  const domainRoot = await getFileRoot(targetId, userId, isAdmin, targetType);
  const fullPath = resolveSecurePath(domainRoot, relativePath);

  await fsPromises.mkdir(path.dirname(fullPath), { recursive: true });
  await fsPromises.writeFile(fullPath, fileBuffer);

  logger.info('File uploaded', { targetId, targetType, path: relativePath, size: fileBuffer.length });
  return true;
}

async function extractZip(targetId, zipPath, destPath, userId, isAdmin = false, targetType = 'domain') {
  const domainRoot = await getFileRoot(targetId, userId, isAdmin, targetType);
  const fullZipPath = resolveSecurePath(domainRoot, zipPath);
  const fullDestPath = resolveSecurePath(domainRoot, destPath);

  await runCommand('mkdir', ['-p', fullDestPath]);
  const result = await runCommand('unzip', ['-o', fullZipPath, '-d', fullDestPath]);
  if (!result.success) throw new Error(`Unzip failed: ${result.stderr}`);

  logger.info('Zip extracted', { targetId, targetType, zipPath, destPath });
  return true;
}

async function createZip(targetId, sourcePath, destName, userId, isAdmin = false, targetType = 'domain') {
  const domainRoot = await getFileRoot(targetId, userId, isAdmin, targetType);
  const fullSourcePath = resolveSecurePath(domainRoot, sourcePath);
  const fullDestPath = resolveSecurePath(domainRoot, destName);

  const result = await runCommand('zip', ['-r', '-9', fullDestPath, fullSourcePath]);
  if (!result.success) throw new Error(`Zip failed: ${result.stderr}`);

  logger.info('Zip created', { targetId, targetType, sourcePath, destName });
  return true;
}

async function getPermissions(targetId, relativePath, userId, isAdmin = false, targetType = 'domain') {
  const domainRoot = await getFileRoot(targetId, userId, isAdmin, targetType);
  const fullPath = resolveSecurePath(domainRoot, relativePath);

  const stat = await fsPromises.stat(fullPath);
  const octal = (stat.mode & 0o777).toString(8);
  return { path: relativePath, permissions: octal, mode: stat.mode };
}

async function setPermissions(targetId, relativePath, mode, userId, isAdmin = false, targetType = 'domain') {
  const domainRoot = await getFileRoot(targetId, userId, isAdmin, targetType);
  const fullPath = resolveSecurePath(domainRoot, relativePath);

  // Validate mode is octal string
  if (!/^[0-7]{3,4}$/.test(mode.toString())) {
    throw new Error('Invalid permission mode. Use octal format (e.g., 755)');
  }

  const result = await runCommand('chmod', [mode.toString(), fullPath]);
  if (!result.success) throw new Error(`chmod failed: ${result.stderr}`);

  logger.info('Permissions set', { targetId, targetType, path: relativePath, mode });
  return true;
}

async function deleteFiles(targetId, relativePaths, userId, isAdmin = false, targetType = 'domain') {
  const domainRoot = await getFileRoot(targetId, userId, isAdmin, targetType);
  const results = [];

  for (const relativePath of relativePaths) {
    try {
      const fullPath = resolveSecurePath(domainRoot, relativePath);
      const stat = await fsPromises.stat(fullPath);
      if (stat.isDirectory()) {
        await runCommand('rm', ['-rf', fullPath]);
      } else {
        await fsPromises.unlink(fullPath);
      }
      results.push({ path: relativePath, success: true });
      logger.info('File deleted', { targetId, targetType, path: relativePath });
    } catch (err) {
      results.push({ path: relativePath, success: false, error: err.message });
    }
  }

  return results;
}

function getTrashDir(domainRoot) {
  return path.join(path.dirname(domainRoot), '.panel-trash');
}

async function moveToTrash(targetId, relativePaths, userId, isAdmin = false, targetType = 'domain') {
  const domainRoot = await getFileRoot(targetId, userId, isAdmin, targetType);
  const trashDir = getTrashDir(domainRoot);
  await fsPromises.mkdir(trashDir, { recursive: true });

  const results = [];
  for (const relativePath of relativePaths) {
    try {
      const fullPath = resolveSecurePath(domainRoot, relativePath);
      const originalName = path.basename(fullPath);
      const timestamp = Date.now();
      const trashName = `${timestamp}_${originalName}`;
      const trashPath = path.join(trashDir, trashName);
      const stat = await fsPromises.stat(fullPath);
      await fsPromises.rename(fullPath, trashPath);
      await fsPromises.writeFile(`${trashPath}.meta.json`, JSON.stringify({
        originalName,
        originalPath: relativePath,
        deletedAt: new Date().toISOString(),
        type: stat.isDirectory() ? 'directory' : 'file',
        size: stat.size,
      }));
      results.push({ path: relativePath, success: true, trashName });
      logger.info('File moved to trash', { targetId, targetType, path: relativePath });
    } catch (err) {
      results.push({ path: relativePath, success: false, error: err.message });
    }
  }
  return results;
}

async function listTrash(targetId, userId, isAdmin = false, targetType = 'domain') {
  const domainRoot = await getFileRoot(targetId, userId, isAdmin, targetType);
  const trashDir = getTrashDir(domainRoot);

  try { await fsPromises.access(trashDir); } catch { return []; }

  const entries = await fsPromises.readdir(trashDir);
  const result = [];
  for (const entry of entries) {
    if (entry.endsWith('.meta.json')) continue;
    const metaPath = path.join(trashDir, `${entry}.meta.json`);
    try {
      const meta = JSON.parse(await fsPromises.readFile(metaPath, 'utf8'));
      result.push({ trashName: entry, ...meta });
    } catch {
      const stat = await fsPromises.stat(path.join(trashDir, entry)).catch(() => null);
      if (stat) result.push({ trashName: entry, originalName: entry, originalPath: '/', deletedAt: stat.mtime.toISOString(), type: stat.isDirectory() ? 'directory' : 'file', size: stat.size });
    }
  }
  return result.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
}

async function deleteFromTrash(targetId, trashNames, userId, isAdmin = false, targetType = 'domain') {
  const domainRoot = await getFileRoot(targetId, userId, isAdmin, targetType);
  const trashDir = getTrashDir(domainRoot);
  const results = [];
  for (const trashName of trashNames) {
    if (/[/\\]/.test(trashName) || trashName.includes('..')) {
      results.push({ trashName, success: false, error: 'Geçersiz isim' });
      continue;
    }
    try {
      const trashPath = path.join(trashDir, trashName);
      const stat = await fsPromises.stat(trashPath);
      if (stat.isDirectory()) await runCommand('rm', ['-rf', trashPath]);
      else await fsPromises.unlink(trashPath);
      await fsPromises.unlink(`${trashPath}.meta.json`).catch(() => {});
      results.push({ trashName, success: true });
    } catch (err) {
      results.push({ trashName, success: false, error: err.message });
    }
  }
  return results;
}

async function restoreFromTrash(targetId, trashNames, userId, isAdmin = false, targetType = 'domain') {
  const domainRoot = await getFileRoot(targetId, userId, isAdmin, targetType);
  const trashDir = getTrashDir(domainRoot);
  const results = [];
  for (const trashName of trashNames) {
    if (/[/\\]/.test(trashName) || trashName.includes('..')) {
      results.push({ trashName, success: false, error: 'Geçersiz isim' });
      continue;
    }
    try {
      const trashPath = path.join(trashDir, trashName);
      let restorePath;
      try {
        const meta = JSON.parse(await fsPromises.readFile(`${trashPath}.meta.json`, 'utf8'));
        restorePath = resolveSecurePath(domainRoot, meta.originalPath);
      } catch {
        restorePath = path.join(domainRoot, trashName);
      }
      const exists = await fsPromises.access(restorePath).then(() => true).catch(() => false);
      if (exists) {
        const ext = path.extname(restorePath);
        const base = ext ? restorePath.slice(0, -ext.length) : restorePath;
        restorePath = `${base}_geri_${Date.now()}${ext}`;
      }
      await fsPromises.mkdir(path.dirname(restorePath), { recursive: true });
      await fsPromises.rename(trashPath, restorePath);
      await fsPromises.unlink(`${trashPath}.meta.json`).catch(() => {});
      results.push({ trashName, success: true });
    } catch (err) {
      results.push({ trashName, success: false, error: err.message });
    }
  }
  return results;
}

async function emptyTrash(targetId, userId, isAdmin = false, targetType = 'domain') {
  const domainRoot = await getFileRoot(targetId, userId, isAdmin, targetType);
  const trashDir = getTrashDir(domainRoot);
  try { await fsPromises.access(trashDir); } catch { return; }
  await runCommand('rm', ['-rf', trashDir]);
  await fsPromises.mkdir(trashDir, { recursive: true });
}

module.exports = {
  listFiles,
  readFile,
  writeFile,
  deleteFile,
  deleteFiles,
  createDirectory,
  renameItem,
  uploadFile,
  extractZip,
  createZip,
  getPermissions,
  setPermissions,
  moveToTrash,
  listTrash,
  deleteFromTrash,
  restoreFromTrash,
  emptyTrash,
};
