'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Bell, Sun, Moon, LogOut, User, Settings, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuthStore, useUIStore, useNotificationStore } from '@/lib/store';
import { formatRelativeDate } from '@/lib/utils';
import toast from 'react-hot-toast';

const breadcrumbMap: Record<string, string> = {
  dashboard: 'Dashboard', domains: 'Domainler', subdomains: 'Subdomainler',
  ssl: 'SSL Sertifikaları', php: 'PHP Yönetimi', ftp: 'FTP Hesapları',
  email: 'E-posta', dns: 'DNS Yönetimi', databases: 'Veritabanları',
  files: 'Dosya Yöneticisi', backups: 'Yedeklemeler', logs: 'Günlükler',
  services: 'Servisler', security: 'Güvenlik', users: 'Kullanıcılar',
  profile: 'Profil', notifications: 'Bildirimler',
};

const notifTypeColor: Record<string, string> = {
  error: 'bg-rose-500', warning: 'bg-amber-500', success: 'bg-emerald-500', info: 'bg-sky-500',
};

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useUIStore();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationStore();

  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs = segments.map((seg) => ({
    label: breadcrumbMap[seg] || seg,
    href: `/${segments.slice(0, segments.indexOf(seg) + 1).join('/')}`,
  }));

  const handleLogout = () => {
    logout();
    router.push('/login');
    toast.success('Başarıyla çıkış yapıldı.');
  };

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() || 'HP';

  const roleLabels: Record<string, string> = { admin: 'Admin', reseller: 'Bayi', user: 'Kullanıcı' };
  const roleGradients: Record<string, string> = {
    admin:    'from-violet-500 to-indigo-500',
    reseller: 'from-amber-500 to-orange-500',
    user:     'from-sky-500 to-indigo-500',
  };
  const roleGrad = roleGradients[user?.role || 'user'];

  return (
    <header className="flex h-14 shrink-0 items-center justify-between px-5 relative"
      style={{
        background: '#FFFFFF',
        borderBottom: '1px solid #E8ECFF',
        boxShadow: '0 1px 4px rgba(99,102,241,0.06)',
      }}>

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1">
        <span className="text-slate-300 text-sm select-none">/</span>
        {breadcrumbs.map((crumb, idx) => (
          <div key={crumb.href} className="flex items-center gap-1">
            {idx > 0 && <ChevronRight className="h-3 w-3 text-slate-300" />}
            <button
              onClick={() => idx < breadcrumbs.length - 1 && router.push(crumb.href)}
              className={cn(
                'text-sm transition-all px-1.5 py-0.5 rounded-md',
                idx === breadcrumbs.length - 1
                  ? 'font-semibold text-slate-800 cursor-default'
                  : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer'
              )}
            >
              {crumb.label}
            </button>
          </div>
        ))}
      </nav>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Theme toggle */}
        <Button variant="ghost" size="icon"
          onClick={toggleTheme}
          className="h-8 w-8 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
          {theme === 'dark'
            ? <Sun  className="h-3.5 w-3.5" />
            : <Moon className="h-3.5 w-3.5" />}
        </Button>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon"
              className="relative h-8 w-8 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
              <Bell className="h-3.5 w-3.5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 border-slate-200 bg-white shadow-xl shadow-indigo-100/50">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span className="text-slate-700 flex items-center gap-1.5">
                <Bell className="h-3.5 w-3.5 text-indigo-500" /> Bildirimler
              </span>
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} className="text-[11px] text-indigo-500 hover:text-indigo-700">
                  Tümünü okundu say
                </button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-100" />
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Sparkles className="h-6 w-6 text-slate-200 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Bildirim yok</p>
              </div>
            ) : (
              notifications.slice(0, 5).map((notif) => (
                <DropdownMenuItem key={notif.id}
                  className="flex flex-col items-start gap-1 px-4 py-3 focus:bg-slate-50 cursor-pointer"
                  onClick={() => markAsRead(notif.id)}>
                  <div className="flex items-start gap-2 w-full">
                    <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${notifTypeColor[notif.type] || 'bg-slate-300'} ${!notif.read ? '' : 'opacity-40'}`} />
                    <div>
                      <p className={`text-xs leading-snug ${!notif.read ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>{notif.message}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{formatRelativeDate(notif.createdAt)}</p>
                    </div>
                  </div>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost"
              className="flex items-center gap-2 pl-1.5 pr-3 h-8 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg">
              <div className={`relative h-7 w-7 rounded-lg bg-gradient-to-br ${roleGrad} p-px`}>
                <div className="h-full w-full rounded-[7px] bg-white flex items-center justify-center">
                  <span className="text-[11px] font-bold text-indigo-600">{initials}</span>
                </div>
              </div>
              <div className="hidden flex-col items-start md:flex">
                <span className="text-xs font-semibold leading-none text-slate-700">{user?.username || user?.email}</span>
                <span className="mt-0.5 text-[10px] text-slate-400">{roleLabels[user?.role || 'user']}</span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 border-slate-200 bg-white shadow-xl shadow-indigo-100/50">
            <DropdownMenuLabel>
              <div className={`h-px w-full bg-gradient-to-r ${roleGrad} mb-3 rounded-full opacity-60`} />
              <p className="font-semibold text-slate-700 text-sm">{user?.username || user?.email}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{user?.email}</p>
              <Badge variant="outline" className={`mt-2 text-[10px] border-0 bg-gradient-to-r ${roleGrad} text-white px-2`}>
                {roleLabels[user?.role || 'user']}
              </Badge>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-100" />
            <DropdownMenuItem onClick={() => router.push('/profile')}
              className="focus:bg-slate-50 text-slate-500 focus:text-slate-800 text-xs gap-2">
              <User className="h-3.5 w-3.5" /> Profil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/settings')}
              className="focus:bg-slate-50 text-slate-500 focus:text-slate-800 text-xs gap-2">
              <Settings className="h-3.5 w-3.5" /> Ayarlar
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-100" />
            <DropdownMenuItem onClick={handleLogout}
              className="focus:bg-rose-50 text-rose-500 focus:text-rose-600 text-xs gap-2">
              <LogOut className="h-3.5 w-3.5" /> Çıkış Yap
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ');
}
