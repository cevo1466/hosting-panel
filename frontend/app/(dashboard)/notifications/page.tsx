'use client';

import { useState, useEffect } from 'react';
import { Bell, RefreshCw, Loader2, CheckCheck, Trash2, AlertTriangle, Info, AlertCircle, Shield } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api, getErrorMessage } from '@/lib/api';
import { useNotificationStore } from '@/lib/store';
import toast from 'react-hot-toast';

interface Notification {
  id: string;
  type: string;
  severity?: 'info' | 'warning' | 'critical';
  message: string;
  isRead: boolean;
  createdAt: string;
}

const severityConfig = {
  info: { icon: Info, color: 'text-blue-400', badge: 'bg-blue-950/20 text-blue-400 border-blue-900/30', label: 'Bilgi' },
  warning: { icon: AlertTriangle, color: 'text-yellow-400', badge: 'bg-yellow-950/20 text-yellow-400 border-yellow-900/30', label: 'Uyarı' },
  critical: { icon: AlertCircle, color: 'text-red-400', badge: 'bg-red-950/20 text-red-400 border-red-900/30', label: 'Kritik' },
};

const typeIcons: Record<string, React.ElementType> = {
  ssl_expiry: Shield,
  disk_full: AlertTriangle,
  service_down: AlertCircle,
  backup_failed: AlertTriangle,
  security: Shield,
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const { markAllAsRead } = useNotificationStore();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      markAllAsRead();
      toast.success('Tüm bildirimler okundu olarak işaretlendi.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setMarkingAll(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const unread = notifications.filter(n => !n.isRead).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#23252a]/70 pb-6">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Bildirimler
            {unread > 0 && (
              <Badge className="ml-3 bg-red-500 text-white text-xs">{unread}</Badge>
            )}
          </h2>
          <p className="text-[#8a8f98] mt-1 text-sm">Sistem uyarıları ve bildirimleri.</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={fetchData} variant="outline" className="border-[#23252a] hover:bg-[#14151a] text-white rounded-xl"><RefreshCw className="h-4 w-4" /></Button>
          {unread > 0 && (
            <Button onClick={handleMarkAllRead} disabled={markingAll} variant="outline" className="border-[#23252a] hover:bg-[#14151a] text-white rounded-xl gap-2 text-xs">
              {markingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
              Tümünü Oku
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : notifications.length === 0 ? (
        <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Bell className="h-12 w-12 text-[#8a8f98] mb-4" />
            <p className="text-white font-semibold text-lg">Bildirim yok</p>
            <p className="text-[#8a8f98] text-sm mt-1">Tüm bildirimler temizlenmiş.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const severity = (notif.severity || 'info') as keyof typeof severityConfig;
            const cfg = severityConfig[severity] || severityConfig.info;
            const Icon = typeIcons[notif.type] || cfg.icon;
            return (
              <Card
                key={notif.id}
                className={`backdrop-blur-xl border transition-all ${notif.isRead ? 'bg-[#0b0c10]/30 border-[#23252a]/50' : 'bg-[#0b0c10]/60 border-[#23252a]'}`}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  {!notif.isRead && <div className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${notif.isRead ? 'opacity-50' : ''}`} style={{ background: 'rgba(94,106,210,0.1)' }}>
                    <Icon className={`h-4.5 w-4.5 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${notif.isRead ? 'text-[#8a8f98]' : 'text-white font-medium'}`}>{notif.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={`${cfg.badge} text-[10px]`}>{cfg.label}</Badge>
                      <span className="text-xs text-[#8a8f98]">{new Date(notif.createdAt).toLocaleString('tr-TR')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!notif.isRead && (
                      <Button onClick={() => handleMarkRead(notif.id)} variant="ghost" className="h-8 w-8 p-0 text-[#8a8f98] hover:text-white rounded-lg">
                        <CheckCheck className="h-4 w-4" />
                      </Button>
                    )}
                    <Button onClick={() => handleDelete(notif.id)} variant="ghost" className="h-8 w-8 p-0 text-[#8a8f98] hover:text-red-400 rounded-lg">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
