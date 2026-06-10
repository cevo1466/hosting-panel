'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Globe, GitBranch, Shield, Code2, FolderOpen, Mail,
  Database, Server, Lock, Users, Bell, User, HardDrive, FileText,
  ChevronLeft, ChevronRight, Network, Cpu, Archive, ExternalLink,
} from 'lucide-react';
import { LogoMark } from '@/components/shared/Logo';
import { cn } from '@/lib/utils';
import { useAuthStore, useUIStore } from '@/lib/store';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { resolveWebmailHref } from '@/lib/response-normalizers';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  external?: boolean;
  color?: string;
  activeColor?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: 'Genel',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, color: 'text-violet-500', activeColor: '#7C3AED' },
    ],
  },
  {
    title: 'Hosting',
    items: [
      { label: 'Domainler',         href: '/domains',    icon: Globe,     color: 'text-sky-500',     activeColor: '#0284C7' },
      { label: 'Subdomainler',      href: '/subdomains', icon: GitBranch, color: 'text-cyan-500',    activeColor: '#0891B2' },
      { label: 'SSL Sertifikaları', href: '/ssl',        icon: Shield,    color: 'text-emerald-500', activeColor: '#059669' },
      { label: 'PHP Yönetimi',      href: '/php',        icon: Code2,     color: 'text-orange-500',  activeColor: '#EA580C' },
    ],
  },
  {
    title: 'Servisler',
    items: [
      { label: 'FTP Hesapları', href: '/ftp',      icon: FolderOpen, color: 'text-amber-500',  activeColor: '#D97706' },
      { label: 'E-posta',       href: '/email',    icon: Mail,       color: 'text-pink-500',   activeColor: '#DB2777' },
      { label: 'Webmail',       href: resolveWebmailHref(process.env.NEXT_PUBLIC_WEBMAIL_URL), icon: ExternalLink, color: 'text-rose-500', activeColor: '#E11D48', external: !!process.env.NEXT_PUBLIC_WEBMAIL_URL },
      { label: 'DNS Yönetimi',  href: '/dns',      icon: Network,    color: 'text-indigo-500', activeColor: '#4338CA' },
      { label: 'Veritabanları', href: '/databases',icon: Database,   color: 'text-blue-500',   activeColor: '#2563EB' },
    ],
  },
  {
    title: 'Araçlar',
    items: [
      { label: 'Dosya Yöneticisi', href: '/files',   icon: HardDrive, color: 'text-teal-500',  activeColor: '#0D9488' },
      { label: 'Yedeklemeler',     href: '/backups', icon: Archive,   color: 'text-lime-600',  activeColor: '#65A30D' },
      { label: 'Günlükler',        href: '/logs',    icon: FileText,  color: 'text-slate-500', activeColor: '#475569' },
    ],
  },
  {
    title: 'Sistem',
    items: [
      { label: 'Servisler',    href: '/services', icon: Cpu,   color: 'text-violet-500', activeColor: '#7C3AED' },
      { label: 'Güvenlik',     href: '/security', icon: Lock,  color: 'text-rose-500',   activeColor: '#E11D48' },
      { label: 'Kullanıcılar', href: '/users',    icon: Users, color: 'text-amber-500',  activeColor: '#D97706', adminOnly: true },
    ],
  },
  {
    title: 'Hesap',
    items: [
      { label: 'Profil',      href: '/profile',       icon: User, color: 'text-sky-500',    activeColor: '#0284C7' },
      { label: 'Bildirimler', href: '/notifications', icon: Bell, color: 'text-indigo-500', activeColor: '#4338CA' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  const isActive = (href: string) => {
    if (href.startsWith('http')) return false;
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  return (
    <TooltipProvider>
      <aside
        className={cn(
          'relative flex flex-col transition-all duration-300 ease-in-out shrink-0',
          sidebarCollapsed ? 'w-[68px]' : 'w-[240px]'
        )}
        style={{
          background: '#FFFFFF',
          borderRight: '1px solid #E8ECFF',
        }}
      >
        {/* Logo */}
        <div className={cn(
          'flex h-16 items-center border-b px-4 shrink-0',
          sidebarCollapsed ? 'justify-center' : 'gap-2.5'
        )} style={{ borderBottomColor: '#E8ECFF' }}>
          <LogoMark size={34} animated />
          {!sidebarCollapsed && (
            <div className="animate-fade-in overflow-hidden">
              <p className="text-sm font-bold leading-none text-gradient tracking-tight">HostPanel</p>
              <p className="text-[9px] text-slate-400 mt-0.5 tracking-[0.15em] uppercase font-medium">Enterprise</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter(item => !item.adminOnly || user?.role === 'admin');
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.title} className="mb-1">
                {!sidebarCollapsed && (
                  <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 select-none">
                    {group.title}
                  </p>
                )}
                {sidebarCollapsed && <div className="my-1 mx-3 h-px bg-slate-100" />}

                {visibleItems.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  const color = item.color || 'text-slate-500';
                  const activeColor = item.activeColor || '#6366F1';

                  const inner = (
                    <span className={cn(
                      'group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-200 w-full relative overflow-hidden',
                      active
                        ? 'text-indigo-700'
                        : 'text-slate-500 hover:text-slate-800',
                      sidebarCollapsed && 'justify-center px-2 py-2.5'
                    )}
                    style={active ? {
                      background: '#EEF2FF',
                      borderLeft: '2px solid #6366F1',
                    } : undefined}
                    >
                      {/* Hover bg */}
                      {!active && (
                        <span className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                          style={{ background: '#F5F3FF' }} />
                      )}

                      {/* Icon container */}
                      <span className={cn(
                        'relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-all duration-200',
                        active ? 'scale-105' : 'group-hover:scale-105'
                      )}
                      style={active ? {
                        background: `${activeColor}18`,
                      } : undefined}>
                        <Icon className={cn(
                          'h-3.5 w-3.5 shrink-0 transition-all',
                          active ? color : cn('text-slate-400 group-hover:', color)
                        )}
                        style={active ? { color: activeColor } : undefined}
                        />
                      </span>

                      {!sidebarCollapsed && (
                        <span className="truncate text-[13px] relative">{item.label}</span>
                      )}

                      {/* Active pulse dot */}
                      {active && !sidebarCollapsed && (
                        <span className="ml-auto relative flex h-1.5 w-1.5 shrink-0">
                          <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full opacity-60"
                            style={{ backgroundColor: activeColor }} />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: activeColor }} />
                        </span>
                      )}

                      {/* External icon */}
                      {item.external && !sidebarCollapsed && (
                        <ExternalLink className="ml-auto h-2.5 w-2.5 text-slate-300 shrink-0" />
                      )}
                    </span>
                  );

                  const wrapped = item.external ? (
                    <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer">{inner}</a>
                  ) : (
                    <Link key={item.href} href={item.href}>{inner}</Link>
                  );

                  if (sidebarCollapsed) {
                    return (
                      <Tooltip key={item.href} delayDuration={0}>
                        <TooltipTrigger asChild>{wrapped}</TooltipTrigger>
                        <TooltipContent side="right" className="text-xs bg-white text-slate-700 border border-slate-200 shadow-lg">
                          {item.label}
                        </TooltipContent>
                      </Tooltip>
                    );
                  }
                  return wrapped;
                })}
              </div>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={toggleSidebar}
          className={cn(
            'absolute -right-3 top-20 z-10 flex h-6 w-6 items-center justify-center rounded-full shadow-md transition-all duration-200 hover:scale-110',
          )}
          style={{
            background: '#FFFFFF',
            border: '1px solid #E8ECFF',
            boxShadow: '0 2px 8px rgba(99,102,241,0.12)',
          }}
        >
          {sidebarCollapsed
            ? <ChevronRight className="h-3 w-3 text-slate-400" />
            : <ChevronLeft  className="h-3 w-3 text-slate-400" />}
        </button>
      </aside>
    </TooltipProvider>
  );
}
