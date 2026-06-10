'use strict';

const fs = require('fs').promises;
const path = require('path');
const prisma = require('../config/database');
const config = require('../config/config');
const { runCommand, systemctlAction } = require('../utils/shell');
const logger = require('../utils/logger');

const BIND_ZONES_DIR = '/etc/bind/zones';
const BIND_NAMED_CONF = '/etc/bind/named.conf.local';
const SERVER_IP = config.hosting.serverIp;

const VALID_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'CAA', 'NS', 'PTR'];

function validateRecord(type, value, name) {
  switch (type) {
    case 'A':
      if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(value)) throw new Error('Invalid IPv4 address');
      const parts = value.split('.').map(Number);
      if (parts.some(p => p > 255)) throw new Error('Invalid IPv4 address');
      break;
    case 'AAAA':
      if (!/^[0-9a-fA-F:]+$/.test(value)) throw new Error('Invalid IPv6 address');
      break;
    case 'CNAME':
      if (!/^[a-zA-Z0-9.-]+\.$/.test(value)) throw new Error('CNAME value must end with a dot');
      break;
    case 'MX':
      if (!/^[a-zA-Z0-9.-]+\.$/.test(value)) throw new Error('MX value must be FQDN ending with dot');
      break;
    case 'TXT':
      if (value.length > 255) throw new Error('TXT record too long');
      break;
    case 'NS':
      if (!/^[a-zA-Z0-9.-]+\.$/.test(value)) throw new Error('NS value must be FQDN ending with dot');
      break;
    case 'CAA':
      if (!/^\d+ (issue|issuewild|iodef) ".*"$/.test(value)) {
        throw new Error('Invalid CAA record format. Expected: flag tag value');
      }
      break;
    case 'SRV':
      if (!/^\d+ \d+ [a-zA-Z0-9.-]+\.$/.test(value)) {
        throw new Error('Invalid SRV record format. Expected: weight port target.');
      }
      break;
  }
}

function validateServerIp() {
  validateRecord('A', SERVER_IP, '@');
}

function generateSerial() {
  const now = new Date();
  const dateStr = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  return parseInt(dateStr + '01');
}

async function buildZoneContent(domain, zone, records) {
  const serial = zone.serial || generateSerial();
  let content = `; Zone file for ${domain.name}
$ORIGIN ${domain.name}.
$TTL 3600

@ IN SOA ns1.${domain.name}. hostmaster.${domain.name}. (
    ${serial}  ; Serial
    3600       ; Refresh
    900        ; Retry
    604800     ; Expire
    300        ; Minimum TTL
)

  ; Name servers
@ IN NS ns1.${domain.name}.
@ IN NS ns2.${domain.name}.

`;

  const hasNs1Address = records.some(record =>
    record.name === 'ns1' && ['A', 'AAAA'].includes(record.type)
  );
  const hasNs2Address = records.some(record =>
    record.name === 'ns2' && ['A', 'AAAA'].includes(record.type)
  );
  if (!hasNs1Address) content += `ns1 3600 IN A ${SERVER_IP}\n`;
  if (!hasNs2Address) content += `ns2 3600 IN A ${SERVER_IP}\n`;
  if (!hasNs1Address || !hasNs2Address) content += '\n';

  for (const record of records) {
    const namePart = record.name === '@' ? '@' : record.name;
    const priorityPart = record.priority !== null && record.priority !== undefined
      ? `${record.priority} `
      : '';
    content += `${namePart} ${record.ttl} IN ${record.type} ${priorityPart}${record.value}\n`;
  }

  return content;
}

async function createZone(domainId) {
  const domain = await prisma.domain.findUnique({ where: { id: domainId } });
  if (!domain) throw new Error('Domain not found');
  validateServerIp();

  const existing = await prisma.dnsZone.findUnique({ where: { domainId } });
  if (existing) return existing;

  const serial = generateSerial();
  const zone = await prisma.dnsZone.create({
    data: { domainId, serial },
  });

  // Create default records using actual server IP. Webmail is shared globally,
  // so new customer zones should not get per-domain webmail records.
  const defaultRecords = [
    { type: 'A', name: '@',    value: SERVER_IP, ttl: 3600, zoneId: zone.id },
    { type: 'A', name: 'www',  value: SERVER_IP, ttl: 3600, zoneId: zone.id },
    { type: 'A', name: 'mail', value: SERVER_IP, ttl: 3600, zoneId: zone.id },
    { type: 'A', name: 'ns1',  value: SERVER_IP, ttl: 3600, zoneId: zone.id },
    { type: 'A', name: 'ns2',  value: SERVER_IP, ttl: 3600, zoneId: zone.id },
    { type: 'MX', name: '@', value: `mail.${domain.name}.`, ttl: 3600, priority: 10, zoneId: zone.id },
    { type: 'TXT', name: '@', value: `v=spf1 mx a ip4:${SERVER_IP} ~all`, ttl: 3600, zoneId: zone.id },
  ];

  await prisma.dnsRecord.createMany({ data: defaultRecords });

  await writeZoneFile(domain, zone, await prisma.dnsRecord.findMany({ where: { zoneId: zone.id } }));
  await reloadBind();

  logger.info('DNS zone created', { domainId, zoneId: zone.id });
  return zone;
}

async function writeZoneFile(domain, zone, records) {
  await runCommand('mkdir', ['-p', BIND_ZONES_DIR]);
  const zoneFile = path.join(BIND_ZONES_DIR, `db.${domain.name}`);
  const content = await buildZoneContent(domain, zone, records);
  await fs.writeFile(zoneFile, content, 'utf8');

  // Ensure named.conf.local has this zone
  const namedEntry = `
zone "${domain.name}" {
    type master;
    file "${zoneFile}";
};
`;
  const existing = await fs.readFile(BIND_NAMED_CONF, 'utf8').catch(() => '');
  if (!existing.includes(`zone "${domain.name}"`)) {
    await fs.appendFile(BIND_NAMED_CONF, namedEntry, 'utf8');
  }
}

async function reloadBind() {
  const bind9 = await systemctlAction('bind9', 'reload');
  if (bind9.success) return bind9;

  const named = await systemctlAction('named', 'reload');
  if (named.success) return named;

  const stderr = named.stderr || bind9.stderr || 'unknown error';
  logger.error('BIND reload failed', {
    bind9: bind9.stderr,
    named: named.stderr,
  });
  throw new Error(`BIND reload failed: ${stderr}`);
}

async function addRecord(zoneId, type, name, value, ttl = 3600, priority = null) {
  if (!VALID_TYPES.includes(type)) throw new Error(`Invalid record type: ${type}`);
  validateRecord(type, value, name);

  const zone = await prisma.dnsZone.findUnique({
    where: { id: zoneId },
    include: { domain: true },
  });
  if (!zone) throw new Error('DNS zone not found');

  const record = await prisma.dnsRecord.create({
    data: { zoneId, type, name, value, ttl, priority },
  });

  // Increment serial and rewrite zone file
  const newSerial = zone.serial + 1;
  await prisma.dnsZone.update({ where: { id: zoneId }, data: { serial: newSerial } });
  const allRecords = await prisma.dnsRecord.findMany({ where: { zoneId } });
  await writeZoneFile(zone.domain, { ...zone, serial: newSerial }, allRecords);
  await reloadBind();

  logger.info('DNS record added', { zoneId, type, name });
  return record;
}

async function updateRecord(recordId, data) {
  const record = await prisma.dnsRecord.findUnique({
    where: { id: recordId },
    include: { zone: { include: { domain: true } } },
  });
  if (!record) throw new Error('DNS record not found');

  const nextType = data.type || record.type;
  const nextName = data.name || record.name;
  const nextValue = data.value || record.value;
  if (!VALID_TYPES.includes(nextType)) throw new Error(`Invalid record type`);
  validateRecord(nextType, nextValue, nextName);

  const updated = await prisma.dnsRecord.update({
    where: { id: recordId },
    data: {
      type: nextType,
      name: nextName,
      value: nextValue,
      ttl: data.ttl || record.ttl,
      priority: data.priority !== undefined ? data.priority : record.priority,
    },
  });

  const zone = record.zone;
  const newSerial = zone.serial + 1;
  await prisma.dnsZone.update({ where: { id: zone.id }, data: { serial: newSerial } });
  const allRecords = await prisma.dnsRecord.findMany({ where: { zoneId: zone.id } });
  await writeZoneFile(zone.domain, { ...zone, serial: newSerial }, allRecords);
  await reloadBind();

  logger.info('DNS record updated', { recordId });
  return updated;
}

async function deleteRecord(recordId) {
  const record = await prisma.dnsRecord.findUnique({
    where: { id: recordId },
    include: { zone: { include: { domain: true } } },
  });
  if (!record) throw new Error('DNS record not found');

  await prisma.dnsRecord.delete({ where: { id: recordId } });

  const zone = record.zone;
  const newSerial = zone.serial + 1;
  await prisma.dnsZone.update({ where: { id: zone.id }, data: { serial: newSerial } });
  const allRecords = await prisma.dnsRecord.findMany({ where: { zoneId: zone.id } });
  await writeZoneFile(zone.domain, { ...zone, serial: newSerial }, allRecords);
  await reloadBind();

  logger.info('DNS record deleted', { recordId });
  return true;
}

async function reloadZone(domainId) {
  const zone = await prisma.dnsZone.findUnique({
    where: { domainId },
    include: { domain: true, records: true },
  });
  if (!zone) throw new Error('DNS zone not found');

  await writeZoneFile(zone.domain, zone, zone.records);
  await reloadBind();

  logger.info('DNS zone reloaded', { domainId });
  return true;
}

async function getZone(domainId) {
  return prisma.dnsZone.findUnique({
    where: { domainId },
    include: {
      domain: { select: { id: true, name: true } },
      records: { orderBy: [{ type: 'asc' }, { name: 'asc' }] },
    },
  });
}

// Build the DNS record template a subdomain should have — the same web + mail
// records the parent domain gets (A apex/www/mail, MX, SPF, DMARC), scoped under
// the subdomain name. TXT values are stored WITH surrounding quotes because
// buildZoneContent emits TXT verbatim (unquoted multi-word TXT would be split
// into broken strings — see the TXT quoting note in CLAUDE.md).
function subdomainRecordTemplate(domainName, sub) {
  return [
    { type: 'A',   name: sub,            value: SERVER_IP,                                              ttl: 3600, priority: null },
    { type: 'A',   name: `www.${sub}`,   value: SERVER_IP,                                              ttl: 3600, priority: null },
    { type: 'A',   name: `mail.${sub}`,  value: SERVER_IP,                                              ttl: 3600, priority: null },
    { type: 'MX',  name: sub,            value: `mail.${sub}.${domainName}.`,                           ttl: 3600, priority: 10 },
    { type: 'TXT', name: sub,            value: `"v=spf1 mx a ip4:${SERVER_IP} ~all"`,                   ttl: 3600, priority: null },
    { type: 'TXT', name: `_dmarc.${sub}`, value: `"v=DMARC1; p=none; rua=mailto:postmaster@${domainName}"`, ttl: 3600, priority: null },
  ];
}

// Automatically called when a subdomain is created. Idempotent: only the missing
// records are inserted, a wrong-target apex A is repaired, and the zone file is
// rewritten + BIND reloaded once.
async function addSubdomainRecord(domainId, subdomainName) {
  try {
    validateServerIp();
    const domain = await prisma.domain.findUnique({ where: { id: domainId } });
    if (!domain) throw new Error('Domain not found');

    let zone = await prisma.dnsZone.findUnique({ where: { domainId } });
    if (!zone) {
      zone = await createZone(domainId);
    }

    const desired = subdomainRecordTemplate(domain.name, subdomainName);
    const existing = await prisma.dnsRecord.findMany({ where: { zoneId: zone.id } });
    const has = (type, name) => existing.some(r => r.type === type && r.name === name);

    // Repair a pre-existing apex A record that points at the wrong IP.
    let repaired = false;
    const wrongA = existing.find(r => r.type === 'A' && r.name === subdomainName && r.value !== SERVER_IP);
    if (wrongA) {
      await prisma.dnsRecord.update({ where: { id: wrongA.id }, data: { value: SERVER_IP } });
      repaired = true;
      logger.warn('Subdomain apex A had wrong target; repaired', { domainId, subdomainName, was: wrongA.value });
    }

    const toCreate = desired.filter(d => !has(d.type, d.name)).map(d => ({ ...d, zoneId: zone.id }));

    if (toCreate.length === 0 && !repaired) {
      logger.info('Subdomain DNS records already present', { domainId, subdomainName });
      return existing.find(r => r.type === 'A' && r.name === subdomainName) || null;
    }

    if (toCreate.length > 0) {
      await prisma.dnsRecord.createMany({ data: toCreate });
    }

    // Bump serial, rewrite zone file and reload BIND once for the whole batch.
    const newSerial = (zone.serial || generateSerial()) + 1;
    await prisma.dnsZone.update({ where: { id: zone.id }, data: { serial: newSerial } });
    const allRecords = await prisma.dnsRecord.findMany({ where: { zoneId: zone.id } });
    await writeZoneFile(domain, { ...zone, serial: newSerial }, allRecords);
    await reloadBind();

    logger.info('Subdomain DNS records added', { domainId, subdomainName, created: toCreate.length, repaired });
    return toCreate.length;
  } catch (err) {
    logger.error('Auto subdomain DNS record failed', { domainId, subdomainName, error: err.message });
    throw err;
  }
}

// Fix existing 127.0.0.1 records to use real server IP
async function fixLocalRecords() {
  const updated = await prisma.dnsRecord.updateMany({
    where: { value: '127.0.0.1', type: { in: ['A', 'AAAA'] } },
    data: { value: SERVER_IP },
  });
  if (updated.count > 0) {
    logger.info(`Fixed ${updated.count} DNS records from 127.0.0.1 to ${SERVER_IP}`);
    // Rewrite all affected zone files
    const zones = await prisma.dnsZone.findMany({ include: { domain: true, records: true } });
    for (const zone of zones) {
      await writeZoneFile(zone.domain, zone, zone.records).catch(() => {});
    }
    await reloadBind().catch(() => {});
  }
  return updated.count;
}

async function ensureWebmailRecords(domainId = null) {
  logger.info('Skipped per-domain webmail DNS records; webmail is shared globally', { domainId });
  return 0;
}

module.exports = {
  createZone,
  addRecord,
  updateRecord,
  deleteRecord,
  reloadZone,
  getZone,
  validateRecord,
  addSubdomainRecord,
  fixLocalRecords,
  ensureWebmailRecords,
};
