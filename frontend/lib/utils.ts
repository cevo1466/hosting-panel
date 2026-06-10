import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatDate(date: string | Date, formatStr = 'dd.MM.yyyy HH:mm'): string {
  try {
    return format(new Date(date), formatStr, { locale: tr });
  } catch {
    return '-';
  }
}

export function formatRelativeDate(date: string | Date): string {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: tr });
  } catch {
    return '-';
  }
}

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}g ${hours}s ${minutes}d`;
  if (hours > 0) return `${hours}s ${minutes}d`;
  return `${minutes}d`;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
    case 'running':
    case 'completed':
    case 'success':
      return 'text-emerald-500';
    case 'inactive':
    case 'stopped':
    case 'disabled':
      return 'text-slate-400';
    case 'suspended':
    case 'failed':
    case 'error':
    case 'expired':
    case 'revoked':
      return 'text-red-500';
    case 'pending':
    case 'scheduled':
    case 'running':
      return 'text-yellow-500';
    default:
      return 'text-slate-400';
  }
}

export function getStatusBgColor(status: string): string {
  switch (status) {
    case 'active':
    case 'running':
    case 'completed':
    case 'success':
      return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    case 'inactive':
    case 'stopped':
    case 'disabled':
      return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    case 'suspended':
    case 'failed':
    case 'error':
    case 'expired':
    case 'revoked':
      return 'bg-red-500/10 text-red-500 border-red-500/20';
    case 'pending':
    case 'scheduled':
      return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    default:
      return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  }
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return `${str.slice(0, length)}...`;
}

export function getDaysUntilExpiry(expiryDate: string): number {
  const expiry = new Date(expiryDate);
  const now = new Date();
  const diff = expiry.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getSSLExpiryColor(daysLeft: number): string {
  if (daysLeft < 0) return 'text-red-500';
  if (daysLeft <= 7) return 'text-red-500';
  if (daysLeft <= 30) return 'text-yellow-500';
  return 'text-emerald-500';
}
