'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Server, Globe, Database, Mail, Cpu, HardDrive, ShieldCheck, Activity, Terminal, Play, AlertCircle
} from 'lucide-react';
import dynamic from 'next/dynamic';
const RealtimeChart = dynamic(() => import('@/components/shared/RealtimeChart'), { ssr: false, loading: () => <div className="flex items-center justify-center h-full text-[#8a8f98] text-sm">Grafik yükleniyor...</div> });
import { useAuthStore } from '@/lib/store';
import { StatCard } from '@/components/shared/StatCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface SystemStats {
  cpuPercent: number;
  ramPercent: number;
  ramUsedGb: number;
  ramTotalGb: number;
  diskPercent: number;
  diskUsedGb: number;
  diskTotalGb: number;
  uptime: string;
}

interface ChartPoint { name: string; cpu: number; ram: number; }

interface ServiceStatus {
  name: string;
  displayName: string;
  status: 'running' | 'stopped' | 'error';
  pid?: number;
  memoryMb?: number;
}

interface ActivityLog {
  id: string;
  action: string;
  resource: string;
  ipAddress?: string;
  status: 'success' | 'failed';
  createdAt: string;
  user?: { username: string };
}

interface ResourceCounts {
  domains: number;
  emailAccounts: number;
  ftpAccounts: number;
  databases: number;
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [resources, setResources] = useState<ResourceCounts>({ domains: 0, emailAccounts: 0, ftpAccounts: 0, databases: 0 });
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const pushChartPoint = useCallback((cpu: number, ram: number) => {
    const time = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    setChartData(prev => {
      const next = [...prev, { name: time, cpu, ram }];
      return next.length > 10 ? next.slice(-10) : next;
    });
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [statsRes, servicesRes, activityRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/dashboard/services').catch(() => ({ data: { data: [] } })),
        api.get('/dashboard/activity').catch(() => ({ data: { data: [] } })),
      ]);

      const statsData = statsRes.data.data;
      if (statsData?.system) {
        setSystemStats(statsData.system);
        pushChartPoint(statsData.system.cpuPercent || 0, statsData.system.ramPercent || 0);
      }
      if (statsData?.resources) {
        setResources(statsData.resources);
      }
      setServices(servicesRes.data.data || []);
      setActivity(activityRes.data.data || []);
    } catch (err) {
      // Fallback to mock data if API not available
    } finally {
      setLoading(false);
    }
  }, [pushChartPoint]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 10000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const cpu = systemStats?.cpuPercent ?? 0;
  const ram = systemStats?.ramPercent ?? 0;
  const disk = systemStats?.diskPercent ?? 0;
  const uptime = systemStats?.uptime ?? '—';

  const runningServices = services.filter(s => s.status === 'running');
  const allRunning = services.length > 0 && services.every(s => s.status === 'running');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#23252a]/70 pb-6">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Yönetim Paneline Hoş Geldiniz
          </h2>
          <p className="text-[#8a8f98] mt-1 text-sm">
            Merhaba <span className="text-cyan-400 font-semibold">{user?.username || 'Admin'}</span>, sunucunuzun genel durumunu ve servislerini buradan takip edebilirsiniz.
          </p>
        </div>
        <div className="flex gap-3">
          <Badge variant="outline" className={`bg-[#0f1011] border-[#23252a] px-3.5 py-1.5 rounded-lg flex items-center gap-2 ${allRunning ? 'text-emerald-400' : 'text-yellow-400'}`}>
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${allRunning ? 'bg-emerald-400' : 'bg-yellow-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${allRunning ? 'bg-emerald-500' : 'bg-yellow-500'}`}></span>
            </span>
            {allRunning ? 'Tüm Servisler Aktif' : `${runningServices.length}/${services.length} Servis Aktif`}
          </Badge>
          {uptime !== '—' && (
            <Badge variant="outline" className="bg-[#0f1011] border-[#23252a] text-[#8a8f98] px-3.5 py-1.5 rounded-lg">
              Uptime: {uptime}
            </Badge>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Toplam Domain"
          value={String(resources.domains)}
          icon={Globe}
          iconColor="text-cyan-400"
          iconBg="bg-cyan-950/30 border border-cyan-800/30"
        />
        <StatCard
          title="Veritabanları"
          value={String(resources.databases)}
          icon={Database}
          iconColor="text-[#5e6ad2]"
          iconBg="bg-[#5e6ad2]/10 border border-[#5e6ad2]/20"
        />
        <StatCard
          title="E-posta Hesapları"
          value={String(resources.emailAccounts)}
          icon={Mail}
          iconColor="text-purple-400"
          iconBg="bg-purple-950/30 border border-purple-800/30"
        />
        <StatCard
          title="FTP Hesapları"
          value={String(resources.ftpAccounts)}
          icon={ShieldCheck}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-950/30 border border-emerald-800/30"
        />
      </div>

      {/* Charts + Gauges */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a] hover:border-[#34343a] transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-white text-lg font-bold">Gerçek Zamanlı Sunucu Yükü</CardTitle>
              <CardDescription className="text-[#8a8f98] text-xs">CPU ve RAM aktivitesi</CardDescription>
            </div>
            <Activity className="h-5 w-5 text-cyan-400" />
          </CardHeader>
          <CardContent className="h-[260px] w-full pt-4">
            <RealtimeChart data={chartData} />
          </CardContent>
        </Card>

        <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a] hover:border-[#34343a] transition-all">
          <CardHeader>
            <CardTitle className="text-white text-lg font-bold">Kaynak Tüketimi</CardTitle>
            <CardDescription className="text-[#8a8f98] text-xs">Anlık doluluk oranları</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-white font-medium"><Cpu className="h-4 w-4 text-[#5e6ad2]" />CPU</span>
                <span className="text-[#8a8f98] font-mono">{cpu.toFixed(1)}%</span>
              </div>
              <Progress value={cpu} className="h-2 bg-[#1a1b24] [&>div]:bg-gradient-to-r [&>div]:from-[#5e6ad2] [&>div]:to-[#828fff]" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-white font-medium"><Activity className="h-4 w-4 text-cyan-400" />RAM</span>
                <span className="text-[#8a8f98] font-mono">{ram.toFixed(1)}%{systemStats && ` (${systemStats.ramUsedGb?.toFixed(1)}/${systemStats.ramTotalGb?.toFixed(1)}GB)`}</span>
              </div>
              <Progress value={ram} className="h-2 bg-[#1a1b24] [&>div]:bg-gradient-to-r [&>div]:from-cyan-400 [&>div]:to-cyan-500" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-white font-medium"><HardDrive className="h-4 w-4 text-purple-400" />Disk</span>
                <span className="text-[#8a8f98] font-mono">{disk.toFixed(1)}%{systemStats && ` (${systemStats.diskUsedGb?.toFixed(1)}/${systemStats.diskTotalGb?.toFixed(1)}GB)`}</span>
              </div>
              <Progress value={disk} className={`h-2 bg-[#1a1b24] [&>div]:bg-gradient-to-r ${disk > 80 ? '[&>div]:from-red-500 [&>div]:to-pink-500' : '[&>div]:from-purple-500 [&>div]:to-pink-500'}`} />
            </div>
            <div className="pt-4 border-t border-[#23252a]/70 grid grid-cols-2 gap-3">
              <Button variant="outline" className="border-[#23252a] hover:bg-[#1a1b24] text-white hover:text-white flex items-center justify-center gap-1.5 py-5 rounded-xl text-xs">
                <Terminal className="h-4 w-4 text-cyan-400" />SSH Terminal
              </Button>
              <Button variant="outline" className="border-[#23252a] hover:bg-[#1a1b24] text-white hover:text-white flex items-center justify-center gap-1.5 py-5 rounded-xl text-xs">
                <Play className="h-4 w-4 text-emerald-400" />Web Restart
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Services + Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a] hover:border-[#34343a] transition-all">
          <CardHeader>
            <CardTitle className="text-white text-lg font-bold">Servis Durumları</CardTitle>
            <CardDescription className="text-[#8a8f98] text-xs">Sistem kritik servisleri</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {services.slice(0, 6).map((svc) => (
              <div key={svc.name} className="flex items-center justify-between p-3 rounded-xl bg-[#14151a]/50 border border-[#23252a]/40">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className={`h-2 w-2 rounded-full ${svc.status === 'running' ? 'bg-emerald-500' : svc.status === 'error' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                    {svc.status === 'running' && <div className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-40" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{svc.displayName || svc.name}</p>
                    <p className="text-xs text-[#8a8f98]">{svc.pid ? `PID: ${svc.pid}` : ''}{svc.memoryMb ? ` • RAM: ${svc.memoryMb}MB` : ''}</p>
                  </div>
                </div>
                <Badge variant="outline" className={
                  svc.status === 'running' ? 'bg-emerald-950/30 text-emerald-400 border-emerald-900/30' :
                  svc.status === 'error' ? 'bg-red-950/30 text-red-400 border-red-900/30' :
                  'bg-yellow-950/30 text-yellow-400 border-yellow-900/30'
                }>
                  {svc.status === 'running' ? 'Aktif' : svc.status === 'error' ? 'Hata' : 'Durmuş'}
                </Badge>
              </div>
            ))}
            {services.length === 0 && (
              <div className="text-center py-6 text-[#8a8f98] text-sm">Servis bilgisi yükleniyor...</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a] hover:border-[#34343a] transition-all">
          <CardHeader>
            <CardTitle className="text-white text-lg font-bold">Son Aktiviteler</CardTitle>
            <CardDescription className="text-[#8a8f98] text-xs">Hesapta gerçekleştirilen son işlemler</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activity.slice(0, 5).map((log, i) => (
              <div key={log.id} className={`flex justify-between items-start gap-4 ${i > 0 ? 'border-t border-[#23252a]/40 pt-3' : ''}`}>
                <div className="flex gap-3">
                  <Badge variant="outline" className={`${log.status === 'success' ? 'bg-[#14151a] text-cyan-400' : 'bg-[#14151a] text-red-400'} border-[#23252a] rounded-lg mt-0.5 text-[10px] shrink-0`}>
                    {log.status === 'success' ? 'OK' : 'ERR'}
                  </Badge>
                  <div>
                    <p className="text-sm text-slate-200">{log.action}</p>
                    <p className="text-xs text-[#8a8f98]">{log.resource} • {log.ipAddress || 'System'}</p>
                  </div>
                </div>
                <span className="text-xs font-mono text-[#8a8f98] whitespace-nowrap shrink-0">
                  {new Date(log.createdAt).toLocaleTimeString('tr-TR')}
                </span>
              </div>
            ))}
            {activity.length === 0 && (
              <div className="text-center py-6 text-[#8a8f98] text-sm">Aktivite verisi yükleniyor...</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
