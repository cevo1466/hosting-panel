'use strict';

const { systemctlAction } = require('../utils/shell');
const prisma = require('../config/database');
const logger = require('../utils/logger');

const PHP_VERSIONS = ['8.3', '8.4'];

async function list(req, res) {
  try {
    const versions = await Promise.all(
      PHP_VERSIONS.map(async (v) => {
        const r = await systemctlAction(`php${v}-fpm`, 'status');
        return { version: v, running: r.stdout.includes('active (running)'), service: `php${v}-fpm` };
      })
    );
    res.json({ success: true, data: versions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getFpmStatus(req, res) {
  try {
    const { version } = req.params;
    if (!PHP_VERSIONS.includes(version)) {
      return res.status(400).json({ success: false, message: 'Geçersiz PHP sürümü' });
    }
    const r = await systemctlAction(`php${version}-fpm`, 'status');
    res.json({ success: true, data: { version, output: r.stdout, running: r.stdout.includes('active (running)') } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function switchVersion(req, res) {
  try {
    const { domainId } = req.params;
    const { phpVersion } = req.body;

    if (!PHP_VERSIONS.includes(phpVersion)) {
      return res.status(400).json({ success: false, message: 'Desteklenmeyen PHP sürümü' });
    }

    const domain = await prisma.domain.findFirst({
      where: { id: domainId, ...(req.user.role !== 'admin' ? { userId: req.user.id } : {}) },
    });
    if (!domain) return res.status(404).json({ success: false, message: 'Domain bulunamadı' });

    await prisma.domain.update({ where: { id: domainId }, data: { phpVersion } });
    await systemctlAction('nginx', 'reload');

    res.json({ success: true, message: `PHP ${phpVersion} aktif edildi` });
  } catch (err) {
    logger.error('PHP switch error', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { list, getFpmStatus, switchVersion };
