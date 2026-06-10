'use client';

import { useState, useEffect } from 'react';
import { Code2, RefreshCw, Loader2, Globe, GitBranch, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api, getErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';

interface PHPTarget {
  id: string;
  name: string;
  type: 'domain' | 'subdomain';
  phpVersion: string;
  status: string;
  domainId?: string;
}

const PHP_VERSIONS = ['8.3', '8.4'];

export default function PHPPage() {
  const [targets, setTargets] = useState<PHPTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [pendingVersions, setPendingVersions] = useState<Record<string, string>>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const domsRes = await api.get('/domains');
      const domains = domsRes.data.data || [];
      const result: PHPTarget[] = domains.map((d: PHPTarget) => ({ ...d, type: 'domain' }));

      await Promise.all(
        domains.map(async (d: { id: string }) => {
          try {
            const subRes = await api.get(`/subdomains/${d.id}`);
            const subs = (subRes.data.data || []).map((s: PHPTarget) => ({ ...s, type: 'subdomain', domainId: d.id }));
            result.push(...subs);
          } catch {}
        })
      );
      setTargets(result);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleVersionChange = (id: string, version: string) => {
    setPendingVersions(prev => ({ ...prev, [id]: version }));
  };

  const handleApply = async (target: PHPTarget) => {
    const newVersion = pendingVersions[target.id] || target.phpVersion;
    if (newVersion === target.phpVersion) return toast('PHP sürümü değiştirilmedi.', { icon: 'ℹ️' });
    setUpdatingId(target.id);
    try {
      if (target.type === 'domain') {
        await api.put(`/domains/${target.id}/php`, { phpVersion: newVersion });
      } else {
        await api.put(`/subdomains/${target.domainId}/${target.id}/php`, { phpVersion: newVersion });
      }
      toast.success(`PHP ${newVersion} başarıyla uygulandı ve servis yeniden başlatıldı.`);
      setTargets(prev => prev.map(t => t.id === target.id ? { ...t, phpVersion: newVersion } : t));
      setPendingVersions(prev => { const n = { ...prev }; delete n[target.id]; return n; });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUpdatingId(null);
    }
  };

  const domains = targets.filter(t => t.type === 'domain');
  const subs = targets.filter(t => t.type === 'subdomain');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#23252a]/70 pb-6">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">PHP Sürüm Yönetimi</h2>
          <p className="text-[#8a8f98] mt-1 text-sm">Domain ve subdomain bazlı PHP sürümlerini buradan ayarlayın.</p>
        </div>
        <Button onClick={fetchData} variant="outline" className="border-[#23252a] hover:bg-[#14151a] text-white rounded-xl gap-2">
          <RefreshCw className="h-4 w-4" /> Yenile
        </Button>
      </div>

      {/* PHP Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {PHP_VERSIONS.map(v => (
          <Card key={v} className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-[#5e6ad2]/10 border border-[#5e6ad2]/20 flex items-center justify-center">
                <Code2 className="h-6 w-6 text-[#5e6ad2]" />
              </div>
              <div>
                <p className="text-white font-bold text-lg">PHP {v}</p>
                <p className="text-xs text-[#8a8f98]">{targets.filter(t => t.phpVersion === v).length} domain/subdomain kullanıyor</p>
              </div>
              <Badge variant="outline" className="ml-auto bg-emerald-950/20 text-emerald-400 border-emerald-900/30 gap-1">
                <CheckCircle className="h-3 w-3" /> Destekleniyor
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-6">
          {domains.length > 0 && (
            <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
              <CardHeader>
                <CardTitle className="text-white text-base font-bold flex items-center gap-2"><Globe className="h-4 w-4 text-cyan-400" /> Domainler</CardTitle>
                <CardDescription className="text-[#8a8f98] text-xs">Ana domain başına PHP sürümü</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {domains.map(target => {
                  const current = pendingVersions[target.id] || target.phpVersion;
                  const hasChange = current !== target.phpVersion;
                  return (
                    <div key={target.id} className="flex items-center justify-between p-4 rounded-xl bg-[#0a0b10]/60 border border-[#23252a]/60 gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-cyan-950/20 border border-cyan-800/30 flex items-center justify-center"><Globe className="h-4 w-4 text-cyan-400" /></div>
                        <span className="text-white font-medium truncate">{target.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Select value={current} onValueChange={(v) => handleVersionChange(target.id, v)}>
                          <SelectTrigger className="w-32 bg-[#07080b] border-[#23252a] text-white rounded-xl text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0b0c10] border-[#23252a] text-white">
                            {PHP_VERSIONS.map(v => <SelectItem key={v} value={v} className="hover:bg-[#14151a]">PHP {v}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={() => handleApply(target)}
                          disabled={updatingId === target.id || !hasChange}
                          size="sm"
                          className={`rounded-xl text-xs ${hasChange ? 'bg-gradient-to-r from-primary to-[#828fff] text-white' : 'bg-[#14151a] text-[#8a8f98] border border-[#23252a]'}`}
                        >
                          {updatingId === target.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Uygula'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {subs.length > 0 && (
            <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
              <CardHeader>
                <CardTitle className="text-white text-base font-bold flex items-center gap-2"><GitBranch className="h-4 w-4 text-[#5e6ad2]" /> Subdomainler</CardTitle>
                <CardDescription className="text-[#8a8f98] text-xs">Subdomain başına PHP sürümü</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {subs.map(target => {
                  const current = pendingVersions[target.id] || target.phpVersion;
                  const hasChange = current !== target.phpVersion;
                  return (
                    <div key={target.id} className="flex items-center justify-between p-4 rounded-xl bg-[#0a0b10]/60 border border-[#23252a]/60 gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-[#5e6ad2]/10 border border-[#5e6ad2]/20 flex items-center justify-center"><GitBranch className="h-4 w-4 text-[#5e6ad2]" /></div>
                        <span className="text-white font-medium truncate">{target.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Select value={current} onValueChange={(v) => handleVersionChange(target.id, v)}>
                          <SelectTrigger className="w-32 bg-[#07080b] border-[#23252a] text-white rounded-xl text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0b0c10] border-[#23252a] text-white">
                            {PHP_VERSIONS.map(v => <SelectItem key={v} value={v} className="hover:bg-[#14151a]">PHP {v}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={() => handleApply(target)}
                          disabled={updatingId === target.id || !hasChange}
                          size="sm"
                          className={`rounded-xl text-xs ${hasChange ? 'bg-gradient-to-r from-primary to-[#828fff] text-white' : 'bg-[#14151a] text-[#8a8f98] border border-[#23252a]'}`}
                        >
                          {updatingId === target.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Uygula'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {targets.length === 0 && (
            <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Code2 className="h-12 w-12 text-[#8a8f98] mb-4" />
                <p className="text-white font-semibold">Domain bulunamadı</p>
                <p className="text-[#8a8f98] text-sm mt-1">PHP yönetimi için önce domain ekleyin.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
