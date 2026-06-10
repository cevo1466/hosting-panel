'use client';

import { useState, useEffect } from 'react';
import { Cpu, RefreshCw, Loader2, Play, Square, RotateCcw, FileText, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api, getErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';

interface ServiceStatus {
  name: string;
  displayName: string;
  status: 'running' | 'stopped' | 'error' | 'unknown';
  uptime?: string;
  pid?: number;
  memoryMb?: number;
  cpuPercent?: number;
}

const serviceColors: Record<string, string> = {
  nginx: 'text-green-400',
  apache2: 'text-orange-400',
  'php8.3-fpm': 'text-blue-400',
  'php8.4-fpm': 'text-blue-300',
  mysql: 'text-cyan-400',
  mariadb: 'text-cyan-400',
  dovecot: 'text-purple-400',
  postfix: 'text-purple-300',
  named: 'text-yellow-400',
  bind9: 'text-yellow-400',
  'pure-ftpd': 'text-orange-300',
  fail2ban: 'text-red-400',
  redis: 'text-red-300',
  docker: 'text-sky-400',
};

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [logs, setLogs] = useState<Record<string, string>>({});
  const [showLogs, setShowLogs] = useState<string | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/services');
      setServices(res.data.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAction = async (service: string, action: 'start' | 'stop' | 'restart' | 'reload') => {
    const key = `${service}-${action}`;
    setActionLoading(key);
    try {
      await api.post(`/services/${service}/${action}`);
      const labels = { start: 'başlatıldı', stop: 'durduruldu', restart: 'yeniden başlatıldı', reload: 'yeniden yüklendi' };
      toast.success(`${service} servisi ${labels[action]}.`);
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleLogs = async (serviceName: string) => {
    if (showLogs === serviceName) {
      setShowLogs(null);
      return;
    }
    setShowLogs(serviceName);
    if (logs[serviceName]) return;
    setLogsLoading(true);
    try {
      const res = await api.get(`/services/${serviceName}/logs`);
      setLogs(prev => ({ ...prev, [serviceName]: res.data.data || '' }));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLogsLoading(false);
    }
  };

  const runningCount = services.filter(s => s.status === 'running').length;
  const stoppedCount = services.filter(s => s.status !== 'running').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#23252a]/70 pb-6">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">Servis Yönetimi</h2>
          <p className="text-[#8a8f98] mt-1 text-sm">Sistem servislerini izleyin ve yönetin.</p>
        </div>
        <Button onClick={fetchData} variant="outline" className="border-[#23252a] hover:bg-[#14151a] text-white rounded-xl gap-2">
          <RefreshCw className="h-4 w-4" /> Yenile
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-950/20 border border-emerald-800/30 flex items-center justify-center">
              <Activity className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-400">{runningCount}</p>
              <p className="text-xs text-[#8a8f98]">Çalışan</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-red-950/20 border border-red-800/30 flex items-center justify-center">
              <Square className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-400">{stoppedCount}</p>
              <p className="text-xs text-[#8a8f98]">Durmuş</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#5e6ad2]/10 border border-[#5e6ad2]/20 flex items-center justify-center">
              <Cpu className="h-5 w-5 text-[#5e6ad2]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#5e6ad2]">{services.length}</p>
              <p className="text-xs text-[#8a8f98]">Toplam</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-3">
          {services.map((svc) => {
            const color = serviceColors[svc.name] || 'text-slate-400';
            const isRunning = svc.status === 'running';
            const hasLogs = showLogs === svc.name;
            return (
              <Card key={svc.name} className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a] hover:border-[#34343a] transition-all overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between p-5 gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className={`h-2.5 w-2.5 rounded-full ${isRunning ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        {isRunning && <div className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-40" />}
                      </div>
                      <div>
                        <p className={`font-bold ${color}`}>{svc.displayName || svc.name}</p>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-[#8a8f98]">
                          {svc.pid && <span>PID: {svc.pid}</span>}
                          {svc.memoryMb && <span>RAM: {svc.memoryMb}MB</span>}
                          {svc.cpuPercent !== undefined && <span>CPU: {svc.cpuPercent.toFixed(1)}%</span>}
                          {svc.uptime && <span>Uptime: {svc.uptime}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={isRunning ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30 text-[10px]' : 'bg-red-950/20 text-red-400 border-red-900/30 text-[10px]'}>
                        {isRunning ? 'Çalışıyor' : svc.status === 'error' ? 'Hata' : 'Durduruldu'}
                      </Badge>
                      {isRunning ? (
                        <>
                          <Button onClick={() => handleAction(svc.name, 'restart')} disabled={actionLoading !== null} variant="outline" className="border-[#23252a] hover:bg-[#14151a] text-white text-xs rounded-lg py-1.5 h-auto gap-1">
                            {actionLoading === `${svc.name}-restart` ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}Restart
                          </Button>
                          <Button onClick={() => handleAction(svc.name, 'stop')} disabled={actionLoading !== null} variant="outline" className="border-red-900/30 hover:bg-red-950/20 text-red-400 text-xs rounded-lg py-1.5 h-auto gap-1">
                            {actionLoading === `${svc.name}-stop` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3" />}Stop
                          </Button>
                        </>
                      ) : (
                        <Button onClick={() => handleAction(svc.name, 'start')} disabled={actionLoading !== null} variant="outline" className="border-emerald-900/30 hover:bg-emerald-950/20 text-emerald-400 text-xs rounded-lg py-1.5 h-auto gap-1">
                          {actionLoading === `${svc.name}-start` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}Başlat
                        </Button>
                      )}
                      <Button onClick={() => handleToggleLogs(svc.name)} variant="ghost" className="text-[#8a8f98] hover:text-white text-xs rounded-lg py-1.5 h-auto gap-1">
                        <FileText className="h-3.5 w-3.5" />
                        {hasLogs ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                  {hasLogs && (
                    <div className="border-t border-[#23252a]/50 bg-[#050607] p-4">
                      {logsLoading ? (
                        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                      ) : (
                        <pre className="text-xs text-[#8a8f98] font-mono overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                          {logs[svc.name] || 'Log bulunamadı.'}
                        </pre>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {services.length === 0 && (
            <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Cpu className="h-12 w-12 text-[#8a8f98] mb-4" />
                <p className="text-white font-semibold">Servis bilgisi alınamadı</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
