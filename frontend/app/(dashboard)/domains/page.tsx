'use client';

import { useState, useEffect } from 'react';
import { Globe, Plus, Search, Shield, Trash2, ArrowUpRight, Loader2, RefreshCw, Code2, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api, getErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface Domain {
  id: string;
  name: string;
  phpVersion: string;
  sslEnabled?: boolean;
  sslCertificate?: { status: string; expiresAt?: string } | null;
  sslExpiry?: string;
  status: 'active' | 'suspended' | 'pending';
  createdAt: string;
  diskUsage: number;
  bandwidth: number;
  subdomainCount?: number;
  emailCount?: number;
}

export default function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', phpVersion: '8.3' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/domains');
      setDomains(res.data.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAdd = async () => {
    if (!form.name.trim()) return toast.error('Domain adı gereklidir.');
    setSubmitting(true);
    try {
      await api.post('/domains', { name: form.name.trim(), phpVersion: form.phpVersion });
      toast.success(`${form.name} başarıyla eklendi.`);
      setShowAdd(false);
      setForm({ name: '', phpVersion: '8.3' });
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (domain: Domain) => {
    if (!confirm(`"${domain.name}" domainini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) return;
    setDeletingId(domain.id);
    try {
      await api.delete(`/domains/${domain.id}`);
      toast.success(`${domain.name} silindi.`);
      setDomains(prev => prev.filter(d => d.id !== domain.id));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = domains.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));

  const statusConfig = {
    active: { label: 'Aktif', class: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
    suspended: { label: 'Askıda', class: 'bg-red-500/10 text-red-400 border border-red-500/20' },
    pending: { label: 'Beklemede', class: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#23252a]/70 pb-6">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Domain Yönetimi
          </h2>
          <p className="text-[#8a8f98] mt-1 text-sm">Web sitelerinizi ve domain yapılandırmalarını buradan yönetin.</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={fetchData} variant="outline" className="border-[#23252a] hover:bg-[#14151a] text-white rounded-xl"><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={() => setShowAdd(true)} className="bg-gradient-to-r from-primary to-[#828fff] hover:from-[#828fff] hover:to-[#5e6ad2] text-white flex items-center gap-2 rounded-xl py-5 px-5">
            <Plus className="h-4 w-4" />Yeni Domain Ekle
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8a8f98]" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Domain adına göre ara..."
          className="pl-11 bg-[#0b0c10]/60 border-[#23252a] focus:border-primary text-white rounded-xl placeholder-[#62666d]"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Globe className="h-12 w-12 text-[#8a8f98] mb-4" />
            <p className="text-white font-semibold text-lg">Domain bulunamadı</p>
            <p className="text-[#8a8f98] text-sm mt-1">İlk domainizi ekleyerek başlayın.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((domain) => {
            const statusCfg = statusConfig[domain.status] || statusConfig.active;
            return (
              <Card key={domain.id} className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a] hover:border-[#34343a] transition-all overflow-hidden relative group">
                <div className="absolute top-0 bottom-0 left-0 w-[3px] bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-[#14151a] border border-[#23252a] flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
                      <Globe className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-white text-lg">{domain.name}</h3>
                        {(domain.sslCertificate || domain.sslEnabled) ? (
                          <Badge variant="outline" className="bg-emerald-950/20 text-emerald-400 border-emerald-900/30 flex items-center gap-1 text-[10px] px-2 py-0.5">
                            <Shield className="h-3 w-3" /> SSL
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-yellow-950/20 text-yellow-400 border-yellow-900/30 text-[10px] px-2 py-0.5">
                            <AlertCircle className="h-3 w-3 inline mr-1" />SSL Yok
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-[#8a8f98] mt-1">Ekleme: {new Date(domain.createdAt).toLocaleDateString('tr-TR')}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 flex-1 max-w-xl lg:px-6">
                    <div>
                      <span className="text-xs text-[#8a8f98] block uppercase tracking-wider font-semibold">PHP</span>
                      <span className="text-sm font-mono font-medium text-slate-200 mt-1 flex items-center gap-1">
                        <Code2 className="h-3.5 w-3.5 text-[#8a8f98]" />{domain.phpVersion || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-[#8a8f98] block uppercase tracking-wider font-semibold">Durum</span>
                      <span className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${statusCfg.class}`}>{statusCfg.label}</span>
                    </div>
                    <div>
                      <span className="text-xs text-[#8a8f98] block uppercase tracking-wider font-semibold">Disk</span>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="w-16 bg-[#14151a] h-1.5 rounded-full overflow-hidden">
                          <div className="bg-primary h-full rounded-full" style={{ width: `${Math.min(100, domain.diskUsage || 0)}%` }} />
                        </div>
                        <span className="text-xs font-mono text-slate-200">{domain.diskUsage || 0}%</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-[#8a8f98] block uppercase tracking-wider font-semibold">Bant Genişliği</span>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="w-16 bg-[#14151a] h-1.5 rounded-full overflow-hidden">
                          <div className="bg-cyan-400 h-full rounded-full" style={{ width: `${Math.min(100, domain.bandwidth || 0)}%` }} />
                        </div>
                        <span className="text-xs font-mono text-slate-200">{domain.bandwidth || 0}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Link href={`/dns?domain=${domain.id}`}>
                      <Button variant="outline" className="border-[#23252a] hover:bg-[#14151a] text-white hover:text-white rounded-xl text-xs gap-1">
                        Yönet <ArrowUpRight className="h-3.5 w-3.5 text-[#8a8f98]" />
                      </Button>
                    </Link>
                    <Button
                      onClick={() => handleDelete(domain)}
                      disabled={deletingId === domain.id}
                      variant="ghost"
                      className="h-10 w-10 p-0 text-red-400 hover:text-red-300 hover:bg-red-950/20 rounded-xl"
                    >
                      {deletingId === domain.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-[#0b0c10] border border-[#23252a] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white text-lg font-bold">Yeni Domain Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Domain Adı</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="example.com"
                className="bg-[#07080b] border-[#23252a] text-white rounded-xl font-mono"
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">PHP Sürümü</label>
              <Select value={form.phpVersion} onValueChange={(v) => setForm({ ...form, phpVersion: v })}>
                <SelectTrigger className="bg-[#07080b] border-[#23252a] text-white rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0b0c10] border-[#23252a] text-white">
                  <SelectItem value="8.3" className="hover:bg-[#14151a]">PHP 8.3</SelectItem>
                  <SelectItem value="8.4" className="hover:bg-[#14151a]">PHP 8.4</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="bg-[#0a0b10] border border-[#23252a]/60 rounded-xl p-4 text-xs text-[#8a8f98] space-y-1">
              <p>• Document root otomatik olarak oluşturulacaktır.</p>
              <p>• Nginx/Apache yapılandırması hazırlanacaktır.</p>
              <p>• SSL kurulumu için ayrıca SSL modülünü kullanın.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)} className="border-[#23252a] text-white hover:bg-[#14151a] rounded-xl">İptal</Button>
            <Button onClick={handleAdd} disabled={submitting} className="bg-gradient-to-r from-primary to-[#828fff] text-white rounded-xl gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Domain Ekle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
