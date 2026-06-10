'use strict';

const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const config = require('../config/config');
const { runCommand } = require('../utils/shell');
const logger = require('../utils/logger');

const { bcryptRounds } = config;
const { mysqlHost, mysqlPort, mysqlAdminUser, mysqlAdminPass } = config.database;

function sanitizeIdentifier(str) {
  if (!/^[a-zA-Z0-9_]+$/.test(str)) {
    throw new Error(`Invalid identifier: ${str}. Only alphanumeric and underscore allowed.`);
  }
  return str;
}

function buildUserPrefix(userId) {
  return `u${userId.replace(/-/g, '').substring(0, 8)}`;
}

async function runMysql(sql) {
  const args = [
    `--user=${mysqlAdminUser}`,
    `--host=${mysqlHost}`,
    `--port=${mysqlPort.toString()}`,
    '--execute', sql,
  ];
  if (mysqlAdminPass) args.push(`--password=${mysqlAdminPass}`);

  const result = await runCommand('mysql', args);
  if (!result.success) throw new Error(`MySQL error: ${result.stderr}`);
  return result;
}

async function createDatabase(name, dbUser, password, domainId, userId) {
  const prefix = buildUserPrefix(userId);
  const safeName = sanitizeIdentifier(`${prefix}_${name}`);
  const safeUser = sanitizeIdentifier(`${prefix}_${dbUser}`);

  const domain = await prisma.domain.findUnique({ where: { id: domainId } });
  if (!domain) throw new Error('Domain not found');

  const user = await prisma.user.findUnique({ where: { id: userId }, include: { package: true } });
  if (user?.package?.maxDatabases) {
    const count = await prisma.database.count({ where: { userId } });
    if (count >= user.package.maxDatabases) {
      throw new Error(`Database limit reached (${user.package.maxDatabases})`);
    }
  }

  const existingDb = await prisma.database.findFirst({ where: { name: safeName } });
  if (existingDb) throw new Error('Database name already exists');

  await runMysql(`CREATE DATABASE IF NOT EXISTS \`${safeName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await runMysql(`CREATE USER IF NOT EXISTS '${safeUser}'@'localhost' IDENTIFIED BY '${password.replace(/'/g, "\\'")}';`);
  await runMysql(`GRANT ALL PRIVILEGES ON \`${safeName}\`.* TO '${safeUser}'@'localhost';`);
  await runMysql(`FLUSH PRIVILEGES;`);

  const passwordHash = await bcrypt.hash(password, bcryptRounds);

  const db = await prisma.database.create({
    data: {
      name: safeName,
      dbUser: safeUser,
      passwordHash,
      domainId,
      userId,
      charset: 'utf8mb4',
      collation: 'utf8mb4_unicode_ci',
      sizeMB: 0,
    },
  });

  logger.info('Database created', { dbId: db.id, name: safeName, userId });
  return db;
}

async function deleteDatabase(databaseId) {
  const db = await prisma.database.findUnique({ where: { id: databaseId } });
  if (!db) throw new Error('Database not found');

  await runMysql(`DROP DATABASE IF EXISTS \`${db.name}\`;`);
  await runMysql(`DROP USER IF EXISTS '${db.dbUser}'@'localhost';`);
  await runMysql(`FLUSH PRIVILEGES;`);

  await prisma.database.delete({ where: { id: databaseId } });

  logger.info('Database deleted', { databaseId, name: db.name });
  return true;
}

async function changePassword(databaseId, newPassword) {
  const db = await prisma.database.findUnique({ where: { id: databaseId } });
  if (!db) throw new Error('Database not found');

  if (!newPassword || newPassword.length < 8) throw new Error('Password must be at least 8 characters');

  await runMysql(`ALTER USER '${db.dbUser}'@'localhost' IDENTIFIED BY '${newPassword.replace(/'/g, "\\'")}';`);
  await runMysql(`FLUSH PRIVILEGES;`);

  const passwordHash = await bcrypt.hash(newPassword, bcryptRounds);
  const updated = await prisma.database.update({
    where: { id: databaseId },
    data: { passwordHash },
  });

  logger.info('Database password changed', { databaseId });
  return updated;
}

async function getDatabaseSize(databaseId) {
  const db = await prisma.database.findUnique({ where: { id: databaseId } });
  if (!db) throw new Error('Database not found');

  const result = await runMysql(
    `SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb FROM information_schema.tables WHERE table_schema = '${db.name}' GROUP BY table_schema;`
  );

  const lines = result.stdout.split('\n').filter(l => l.trim() && l !== 'size_mb');
  const sizeMB = parseFloat(lines[0]) || 0;

  await prisma.database.update({ where: { id: databaseId }, data: { sizeMB } });

  return { databaseId, name: db.name, sizeMB };
}

async function listDatabases(filter, isAdmin = false) {
  const where = {};
  if (filter.domainId) where.domainId = filter.domainId;
  if (!isAdmin && filter.userId) where.userId = filter.userId;
  else if (isAdmin && filter.userId) where.userId = filter.userId;

  const databases = await prisma.database.findMany({
    where,
    select: {
      id: true,
      name: true,
      dbUser: true,
      domainId: true,
      sizeMB: true,
      charset: true,
      collation: true,
      createdAt: true,
      domain: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return databases.map((db) => ({
    id: db.id,
    name: db.name,
    user: db.dbUser,
    domain: db.domain?.name || '',
    domainId: db.domainId,
    sizeMb: db.sizeMB || 0,
    status: 'active',
    createdAt: db.createdAt,
    charset: db.charset,
    collation: db.collation,
  }));
}

module.exports = {
  createDatabase,
  deleteDatabase,
  changePassword,
  getDatabaseSize,
  listDatabases,
};
