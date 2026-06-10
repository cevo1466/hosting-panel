'use client';

import { useState, useEffect } from 'react';
import { Lock, Shield, RefreshCw, Loader2, Search, Ban, CheckCircle, XCircle, AlertTriangle, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api, getErrorMessage } from '@/lib/api';
import { normalizeAuditLogs, normalizeFail2banStatus, normalizeLoginAttempts } from '@/lib/response-normalizers';
import toast from 'react-hot-toast';

interface AuditLog {
  id: string;
  username?: string;
  action: string;
  resource: string;
  ipAddress?: string;
  status: 'success' | 'failed';
  createdAt: string;
}

interface LoginAttempt {
  id: string;
  ip: string;
  email: string;
  success: boolean;
  createdAt: string;
}

interface Jail {
  name: string;
  status: string;
  currentlyBanned: number;
  totalBanned: number;
}

interface Fail2banStatus {
  enabled: boolean;
  jails: Jail[];
}

export default function SecurityPage() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loginAttempts, setLoginAttempts] = useState<LoginAttempt[]>([]);
  const [fail2ban, setFail2ban] = useState<Fail2banStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [blockIp, setBlockIp] = useState('');
  const [blocking, setBlocking] = useState(false);
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [auditRes, attemptRes, f2bRes] = await Promise.all([
        api.get('/security/audit-logs'),
        api.get('/security/login-attempts'),
        api.get('/security/fail2ban'),
      ]);
      setAuditLogs(normalizeAuditLogs(auditRes.data.data));
      setLoginAttempts(normalizeLoginAttempts(attemptRes.data.data));
      setFail2ban(normalizeFail2banStatus(f2bRes.data.data));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleBlockIp = async () => {
    if (!blockIp.trim()) return;
    setBlocking(true);
    try {
      await api.post('/security/ip-blocks', { ip: blockIp.trim() });
      toast.success(`${blockIp} IP adresi engellendi.`);
      setBlockIp('');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBlocking(false);
    }
  };

  const filteredAudit = auditLogs.filter(l =>
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.resource?.toLowerCase().includes(search.toLowerCase()) ||
    l.username?.toLowerCase().includes(search.toLowerCase()) ||
    l.ipAddress?.includes(search)
  );

  const failedLogins = loginAttempts.filter(a => !a.success).length;
  const uniqueIps = new Set(loginAttempts.map(a => a.ip)).size;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#23252a]/70 pb-6">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">Güvenlik Merkezi</h2>
          <p className="text-[#8a8f98] mt-1 text-sm">Audit logları, giriş denemeleri ve IP engelleme.</p>
        </div>
        <Button onClick={fetchData} variant="outline" className="border-[#23252a] hover:bg-[#14151a] text-white rounded-xl gap-2">
          <RefreshCw className="h-4 w-4" /> Yenile
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-white">{auditLogs.length}</p>
            <p className="text-xs text-[#8a8f98] mt-1">Audit Logu</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-400">{failedLogins}</p>
            <p className="text-xs text-[#8a8f98] mt-1">Başarısız Giriş</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-400">{uniqueIps}</p>
            <p className="text-xs text-[#8a8f98] mt-1">Benzersiz IP</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{fail2ban?.jails?.reduce((a, j) => a + (j.currentlyBanned || 0), 0) || 0}</p>
            <p className="text-xs text-[#8a8f98] mt-1">Engellenen IP</p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <Tabs defaultValue="audit">
          <TabsList className="bg-[#0b0c10] border border-[#23252a] rounded-xl p-1">
            <TabsTrigger value="audit" className="rounded-lg data-[state=active]:bg-[#14151a] data-[state=active]:text-white text-[#8a8f98] text-xs">Audit Logları</TabsTrigger>
            <TabsTrigger value="logins" className="rounded-lg data-[state=active]:bg-[#14151a] data-[state=active]:text-white text-[#8a8f98] text-xs">Giriş Denemeleri</TabsTrigger>
            <TabsTrigger value="fail2ban" className="rounded-lg data-[state=active]:bg-[#14151a] data-[state=active]:text-white text-[#8a8f98] text-xs">Fail2Ban</TabsTrigger>
            <TabsTrigger value="block" className="rounded-lg data-[state=active]:bg-[#14151a] data-[state=active]:text-white text-[#8a8f98] text-xs">IP Engelle</TabsTrigger>
          </TabsList>

          <TabsContent value="audit" className="space-y-4 mt-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8a8f98]" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="İşlem, kaynak, kullanıcı ara..." className="pl-11 bg-[#0b0c10]/60 border-[#23252a] text-white rounded-xl placeholder-[#62666d]" />
            </div>
            <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
              <CardContent className="p-0">
                <div className="divide-y divide-[#23252a]/50">
                  {filteredAudit.slice(0, 50).map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-4 gap-4 hover:bg-[#0a0b10]/50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        {log.status === 'success' ? (
                          <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-white text-sm font-medium truncate">{log.action}</p>
                          <p className="text-xs text-[#8a8f98]">{log.resource} • {log.username || 'System'} • {log.ipAddress}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant="outline" className={log.status === 'success' ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30 text-[10px]' : 'bg-red-950/20 text-red-400 border-red-900/30 text-[10px]'}>
                          {log.status === 'success' ? 'Başarılı' : 'Başarısız'}
                        </Badge>
                        <p className="text-xs text-[#8a8f98] mt-1">{new Date(log.createdAt).toLocaleString('tr-TR')}</p>
                      </div>
                    </div>
                  ))}
                  {filteredAudit.length === 0 && (
                    <div className="py-12 text-center text-[#8a8f98]">Audit logu bulunamadı.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logins" className="mt-4">
            <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
              <CardHeader>
                <CardTitle className="text-white text-base font-bold">Son Giriş Denemeleri</CardTitle>
                <CardDescription className="text-[#8a8f98] text-xs">Son 100 giriş denemesi</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-[#23252a]/50">
                  {loginAttempts.slice(0, 50).map((attempt) => (
                    <div key={attempt.id} className="flex items-center justify-between p-4 gap-4 hover:bg-[#0a0b10]/50 transition-colors">
                      <div className="flex items-center gap-3">
                        {attempt.success ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <AlertTriangle className="h-4 w-4 text-red-400" />}
                        <div>
                          <p className="text-white text-sm">{attempt.email || 'Bilinmeyen'}</p>
                          <p className="text-xs text-[#8a8f98] font-mono">{attempt.ip}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className={attempt.success ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30 text-[10px]' : 'bg-red-950/20 text-red-400 border-red-900/30 text-[10px]'}>
                          {attempt.success ? 'Başarılı' : 'Başarısız'}
                        </Badge>
                        <p className="text-xs text-[#8a8f98] mt-1">{new Date(attempt.createdAt).toLocaleString('tr-TR')}</p>
                      </div>
                    </div>
                  ))}
                  {loginAttempts.length === 0 && <div className="py-12 text-center text-[#8a8f98]">Giriş denemesi bulunamadı.</div>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fail2ban" className="mt-4 space-y-4">
            {fail2ban ? (
              <>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={fail2ban.enabled ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30' : 'bg-red-950/20 text-red-400 border-red-900/30'}>
                    {fail2ban.enabled ? '● Fail2Ban Aktif' : '● Fail2Ban Pasif'}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(fail2ban.jails || []).map(jail => (
                    <Card key={jail.name} className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-white font-bold font-mono">{jail.name}</p>
                          <Badge variant="outline" className={jail.status === 'active' ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30 text-[10px]' : 'bg-[#14151a] text-[#8a8f98] border-[#23252a] text-[10px]'}>
                            {jail.status}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-[#8a8f98]">Şu an engellenen</span>
                            <p className="text-red-400 font-bold text-lg">{jail.currentlyBanned || 0}</p>
                          </div>
                          <div>
                            <span className="text-[#8a8f98]">Toplam engellenen</span>
                            <p className="text-white font-bold text-lg">{jail.totalBanned || 0}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            ) : (
              <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Shield className="h-10 w-10 text-[#8a8f98] mb-3" />
                  <p className="text-white font-semibold">Fail2Ban bilgisi alınamadı</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="block" className="mt-4">
            <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
              <CardHeader>
                <CardTitle className="text-white text-base font-bold">IP Adresi Engelle</CardTitle>
                <CardDescription className="text-[#8a8f98] text-xs">Belirtilen IP adresine gelen tüm bağlantıları engelle.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Input
                    value={blockIp}
                    onChange={e => setBlockIp(e.target.value)}
                    placeholder="192.168.1.100"
                    className="bg-[#07080b] border-[#23252a] text-white rounded-xl font-mono flex-1"
                    onKeyDown={e => e.key === 'Enter' && handleBlockIp()}
                  />
                  <Button onClick={handleBlockIp} disabled={blocking || !blockIp.trim()} className="bg-red-600 hover:bg-red-700 text-white rounded-xl gap-2">
                    {blocking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                    Engelle
                  </Button>
                </div>
                <p className="text-xs text-[#8a8f98] mt-3">Geçerli IPv4 veya IPv6 adresi girin. Bu işlem Fail2Ban üzerinden gerçekleştirilir.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
