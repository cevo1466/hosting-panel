'use strict';

const fileService = require('../services/fileService');
const logger = require('../utils/logger');
const path = require('path');

function isAdmin(req) {
  return req.user.role === 'admin';
}

function getTarget(req) {
  if (req.params.subdomainId) {
    return { id: req.params.subdomainId, type: 'subdomain' };
  }
  return { id: req.params.domainId, type: 'domain' };
}

function errorStatus(err) {
  if (err.message.includes('traversal')) return 403;
  if (err.message === 'Access denied') return 403;
  if (err.message === 'Domain not found' || err.message === 'Subdomain not found') return 404;
  return 500;
}

async function list(req, res) {
  try {
    const target = getTarget(req);
    const filePath = req.query.path || '/';
    const files = await fileService.listFiles(target.id, filePath, req.user.id, isAdmin(req), target.type);
    res.json({ success: true, data: files });
  } catch (err) {
    res.status(errorStatus(err)).json({ success: false, message: err.message });
  }
}

async function read(req, res) {
  try {
    const target = getTarget(req);
    const { path: filePath } = req.query;
    const content = await fileService.readFile(target.id, filePath, req.user.id, isAdmin(req), target.type);
    res.json({ success: true, data: { content } });
  } catch (err) {
    res.status(errorStatus(err)).json({ success: false, message: err.message });
  }
}

async function write(req, res) {
  try {
    const target = getTarget(req);
    const { path: filePath, content } = req.body;
    await fileService.writeFile(target.id, filePath, content, req.user.id, isAdmin(req), target.type);
    res.json({ success: true, message: 'Dosya kaydedildi' });
  } catch (err) {
    res.status(errorStatus(err)).json({ success: false, message: err.message });
  }
}

async function removeMany(req, res) {
  try {
    const target = getTarget(req);
    const { paths } = req.body;
    if (!Array.isArray(paths) || paths.length === 0) {
      return res.status(400).json({ success: false, message: 'No paths provided' });
    }
    const results = await fileService.deleteFiles(target.id, paths, req.user.id, isAdmin(req), target.type);
    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
      return res.json({ success: true, message: `${results.length - failed.length} öğe silindi, ${failed.length} başarısız`, results });
    }
    res.json({ success: true, message: `${results.length} öğe silindi`, results });
  } catch (err) {
    res.status(errorStatus(err)).json({ success: false, message: err.message });
  }
}

async function remove(req, res) {
  try {
    const target = getTarget(req);
    const { path: filePath } = req.body;
    await fileService.deleteFile(target.id, filePath, req.user.id, isAdmin(req), target.type);
    res.json({ success: true, message: 'Silindi' });
  } catch (err) {
    res.status(errorStatus(err)).json({ success: false, message: err.message });
  }
}

async function mkdir(req, res) {
  try {
    const target = getTarget(req);
    const { path: dirPath } = req.body;
    await fileService.createDirectory(target.id, dirPath, req.user.id, isAdmin(req), target.type);
    res.json({ success: true, message: 'Klasör oluşturuldu' });
  } catch (err) {
    res.status(errorStatus(err)).json({ success: false, message: err.message });
  }
}

async function rename(req, res) {
  try {
    const target = getTarget(req);
    const { oldPath, newPath } = req.body;
    await fileService.renameItem(target.id, oldPath, newPath, req.user.id, isAdmin(req), target.type);
    res.json({ success: true, message: 'Yeniden adlandırıldı' });
  } catch (err) {
    res.status(errorStatus(err)).json({ success: false, message: err.message });
  }
}

async function upload(req, res) {
  try {
    const target = getTarget(req);
    const destDir = req.body.path || '/';
    if (!req.file) return res.status(400).json({ success: false, message: 'Dosya bulunamadı' });
    const destPath = path.join(destDir, req.file.originalname).replace(/\\/g, '/');
    await fileService.uploadFile(target.id, destPath, req.file.buffer, req.user.id, isAdmin(req), target.type);
    res.json({ success: true, message: 'Dosya yüklendi' });
  } catch (err) {
    res.status(errorStatus(err)).json({ success: false, message: err.message });
  }
}

async function extractZip(req, res) {
  try {
    const target = getTarget(req);
    const { zipPath, destPath } = req.body;
    await fileService.extractZip(target.id, zipPath, destPath, req.user.id, isAdmin(req), target.type);
    res.json({ success: true, message: 'ZIP çıkartıldı' });
  } catch (err) {
    res.status(errorStatus(err)).json({ success: false, message: err.message });
  }
}

async function createZip(req, res) {
  try {
    const target = getTarget(req);
    const { sourcePath, zipName } = req.body;
    await fileService.createZip(target.id, sourcePath, zipName, req.user.id, isAdmin(req), target.type);
    res.json({ success: true, message: 'ZIP oluşturuldu' });
  } catch (err) {
    res.status(errorStatus(err)).json({ success: false, message: err.message });
  }
}

async function getPermissions(req, res) {
  try {
    const target = getTarget(req);
    const { path: filePath } = req.query;
    const perms = await fileService.getPermissions(target.id, filePath, req.user.id, isAdmin(req), target.type);
    res.json({ success: true, data: perms });
  } catch (err) {
    res.status(errorStatus(err)).json({ success: false, message: err.message });
  }
}

async function setPermissions(req, res) {
  try {
    const target = getTarget(req);
    const { path: filePath, mode } = req.body;
    await fileService.setPermissions(target.id, filePath, mode, req.user.id, isAdmin(req), target.type);
    res.json({ success: true, message: 'İzinler güncellendi' });
  } catch (err) {
    res.status(errorStatus(err)).json({ success: false, message: err.message });
  }
}

async function trashList(req, res) {
  try {
    const target = getTarget(req);
    const items = await fileService.listTrash(target.id, req.user.id, isAdmin(req), target.type);
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(errorStatus(err)).json({ success: false, message: err.message });
  }
}

async function trashMove(req, res) {
  try {
    const target = getTarget(req);
    const { paths } = req.body;
    if (!Array.isArray(paths) || paths.length === 0) return res.status(400).json({ success: false, message: 'Yol listesi gerekli' });
    const results = await fileService.moveToTrash(target.id, paths, req.user.id, isAdmin(req), target.type);
    res.json({ success: true, message: `${results.filter(r => r.success).length} öğe çöp kutusuna taşındı`, results });
  } catch (err) {
    res.status(errorStatus(err)).json({ success: false, message: err.message });
  }
}

async function trashRestore(req, res) {
  try {
    const target = getTarget(req);
    const { trashNames } = req.body;
    if (!Array.isArray(trashNames) || trashNames.length === 0) return res.status(400).json({ success: false, message: 'Öğe listesi gerekli' });
    const results = await fileService.restoreFromTrash(target.id, trashNames, req.user.id, isAdmin(req), target.type);
    res.json({ success: true, message: `${results.filter(r => r.success).length} öğe geri yüklendi`, results });
  } catch (err) {
    res.status(errorStatus(err)).json({ success: false, message: err.message });
  }
}

async function trashDelete(req, res) {
  try {
    const target = getTarget(req);
    const { trashNames } = req.body;
    if (!Array.isArray(trashNames) || trashNames.length === 0) return res.status(400).json({ success: false, message: 'Öğe listesi gerekli' });
    const results = await fileService.deleteFromTrash(target.id, trashNames, req.user.id, isAdmin(req), target.type);
    res.json({ success: true, message: `${results.filter(r => r.success).length} öğe kalıcı olarak silindi`, results });
  } catch (err) {
    res.status(errorStatus(err)).json({ success: false, message: err.message });
  }
}

async function trashEmpty(req, res) {
  try {
    const target = getTarget(req);
    await fileService.emptyTrash(target.id, req.user.id, isAdmin(req), target.type);
    res.json({ success: true, message: 'Çöp kutusu temizlendi' });
  } catch (err) {
    res.status(errorStatus(err)).json({ success: false, message: err.message });
  }
}

module.exports = { list, read, write, remove, removeMany, mkdir, rename, upload, extractZip, createZip, getPermissions, setPermissions, trashList, trashMove, trashRestore, trashDelete, trashEmpty };
