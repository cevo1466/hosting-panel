// Auth Types
export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'reseller' | 'user';
  packageId?: string;
  packageName?: string;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

// Domain Types
export interface Domain {
  id: string;
  name: string;
  userId: string;
  phpVersion: string;
  sslEnabled: boolean;
  sslExpiry?: string;
  subdomainCount: number;
  emailCount: number;
  status: 'active' | 'suspended' | 'pending';
  createdAt: string;
  documentRoot: string;
  diskUsage: number;
  bandwidth: number;
}

// SSL Types
export interface SSLCertificate {
  id: string;
  domain: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  status: 'active' | 'expired' | 'pending' | 'revoked';
  autoRenew: boolean;
  type: 'letsencrypt' | 'custom';
}

// FTP Types
export interface FTPAccount {
  id: string;
  username: string;
  domain: string;
  homeDir: string;
  quotaMb: number;
  usedMb: number;
  lastLogin?: string;
  status: 'active' | 'disabled';
}

// Email Types
export interface EmailAccount {
  id: string;
  address: string;
  domain: string;
  quotaMb: number;
  usedMb: number;
  lastLogin?: string;
  status: 'active' | 'disabled';
  hasForward: boolean;
  hasAutoresponder: boolean;
}

// DNS Types
export type DNSRecordType = 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS' | 'PTR' | 'SRV';

export interface DNSRecord {
  id: string;
  domain: string;
  type: DNSRecordType;
  name: string;
  value: string;
  ttl: number;
  priority?: number;
}

// Database Types
export interface Database {
  id: string;
  name: string;
  user: string;
  domain: string;
  sizeMb: number;
  status: 'active' | 'disabled';
  createdAt: string;
}

// Service Types
export interface ServiceStatus {
  name: string;
  displayName: string;
  status: 'running' | 'stopped' | 'error';
  uptime?: string;
  pid?: number;
  memoryMb?: number;
  cpuPercent?: number;
}

// Backup Types
export interface Backup {
  id: string;
  domain: string;
  type: 'full' | 'files' | 'db' | 'email';
  status: 'completed' | 'running' | 'failed' | 'scheduled';
  sizeMb: number;
  createdAt: string;
  expiresAt?: string;
}

// Dashboard Types
export interface SystemStats {
  cpuPercent: number;
  ramPercent: number;
  ramUsedGb: number;
  ramTotalGb: number;
  diskPercent: number;
  diskUsedGb: number;
  diskTotalGb: number;
  networkInMbps: number;
  networkOutMbps: number;
  uptime: string;
}

export interface DashboardCounts {
  domains: number;
  subdomains: number;
  emails: number;
  ftpAccounts: number;
  databases: number;
  backups: number;
}

export interface ActivityLog {
  id: string;
  userId: string;
  username: string;
  action: string;
  resource: string;
  ip: string;
  status: 'success' | 'failed';
  createdAt: string;
}

export interface Alert {
  id: string;
  type: 'ssl_expiry' | 'disk_full' | 'service_down' | 'backup_failed' | 'security';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  domain?: string;
  createdAt: string;
  read: boolean;
}

export interface ChartDataPoint {
  time: string;
  cpu: number;
  ram: number;
  disk: number;
  networkIn: number;
  networkOut: number;
}

// User Management Types
export interface ManagedUser {
  id: string;
  username: string;
  email: string;
  role: 'reseller' | 'user';
  packageId?: string;
  packageName?: string;
  domainCount: number;
  status: 'active' | 'suspended';
  createdAt: string;
  lastLogin?: string;
}

export interface Package {
  id: string;
  name: string;
  maxDomains: number;
  maxSubdomains: number;
  maxEmails: number;
  maxFtp: number;
  maxDbs: number;
  diskGb: number;
  bandwidthGb: number;
  phpVersions: string[];
  price?: number;
}

// Notification Types
export interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
}

// Log Types
export type LogType = 'access' | 'error' | 'mail' | 'ftp' | 'panel' | 'ssl';

export interface LogEntry {
  id: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: string;
  source?: string;
}

// Security Types
export interface AuditLogEntry {
  id: string;
  userId: string;
  username: string;
  action: string;
  resource: string;
  ip: string;
  userAgent?: string;
  status: 'success' | 'failed';
  createdAt: string;
}

export interface Fail2banStatus {
  enabled: boolean;
  jails: {
    name: string;
    status: 'active' | 'inactive';
    currentlyBanned: number;
    totalBanned: number;
    failThreshold: number;
    banTime: number;
  }[];
}

export interface BlockedIP {
  ip: string;
  reason: string;
  blockedAt: string;
  expiresAt?: string;
}
