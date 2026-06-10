'use client';

import { useState, useEffect } from 'react';
import { GitBranch, Plus, Search, Trash2, Code2, Shield, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api, getErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';

interface Subdomain {
  id: string;
  name: string;
  fullName: string;
  phpVersion: string;
  sslEnabled: boolean;
  status: string;
  documentRoot: string;
  createdAt: string;
  domainId: string;
}

interface Domain {
  id: string;
  name: string;
}

export default function SubdomainsPage() {
  const [subdomains, setSubdomains] = useState<Subdomain[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', domainId: '', phpVersion: '8.3' });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const domainsRes = await api.get('/domains');
      const domainList: Domain[] = domainsRes.data.data || [];
      setDomains(domainList);

      const all: Subdomain[] = [];
      await Promise.all(
        domainList.map(async (d) => {
          try {
            const res = await api.get(`/subdomains/${d.id}`);
            const items = (res.data.data || []).map((s: Subdomain) => ({ ...s, domainId: d.id }));
            all.push(...items);
          } catch {}
        })
      );
      setSubdomains(all);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAdd = async () => {
    if (!form.name || !form.domainId) return toast.error('Subdomain adı ve domain gerekli.');
    setSubmitting(true);
    try {
      await api.post(`/subdomains/${form.domainId}`, { name: form.name, phpVersion: form.phpVersion });
      toast.success('Subdomain başarıyla oluşturuldu.');
      setShowAdd(false);
      setForm({ name: '', domainId: '', phpVersion: '8.3' });
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (s: Subdomain) => {
    if (!confirm(`"${s.fullName || s.name}" subdomainini silmek istediğinizden emin misiniz?`)) return;
    setDeletingId(s.id);
    try {
      await api.delete(`/subdomains/${s.domainId}/${s.id}`);
      toast.success('Subdomain silindi.');
      setSubdomains((prev) => prev.filter((x) => x.id !== s.id));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = subdomains.filter((s) =>
    (s.fullName || s.name).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#23252a]/70 pb-6">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Subdomain Yönetimi
          </h2>
          <p className="text-[#8a8f98] mt-1 text-sm">Domain altındaki alt alan adlarınızı yönetin.</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={fetchData} variant="outline" className="border-[#23252a] hover:bg-[#14151a] text-white rounded-xl gap-2">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setShowAdd(true)} className="bg-gradient-to-r from-primary to-[#828fff] hover:from-[#828fff] hover:to-[#5e6ad2] text-white rounded-xl py-5 px-5 gap-2">
            <Plus className="h-4 w-4" />
            Yeni Subdomain
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8a8f98]" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Subdomain ara..."
          className="pl-11 bg-[#0b0c10]/60 border-[#23252a] focus:border-primary text-white rounded-xl placeholder-[#62666d]"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <GitBranch className="h-12 w-12 text-[#8a8f98] mb-4" />
            <p className="text-white font-semibold text-lg">Subdomain bulunamadı</p>
            <p className="text-[#8a8f98] text-sm mt-1">Yeni subdomain eklemek için butona tıklayın.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((s) => (
            <Card key={s.id} className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a] hover:border-[#34343a] transition-all overflow-hidden group">
              <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-cyan-950/20 border border-cyan-800/30 flex items-center justify-center text-cyan-400">
                    <GitBranch className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-white font-bold">{s.fullName || s.name}</p>
                    <p className="text-xs text-[#8a8f98] mt-0.5">Oluşturma: {new Date(s.createdAt).toLocaleDateString('tr-TR')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Code2 className="h-3.5 w-3.5 text-[#8a8f98]" />
                    <span className="text-xs font-mono text-slate-300">PHP {s.phpVersion}</span>
                  </div>
                  {s.sslEnabled ? (
                    <Badge variant="outline" className="bg-emerald-950/20 text-emerald-400 border-emerald-900/30 text-[10px] gap-1">
                      <Shield className="h-3 w-3" /> SSL Aktif
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-yellow-950/20 text-yellow-400 border-yellow-900/30 text-[10px]">SSL Yok</Badge>
                  )}
                  <Badge variant="outline" className={s.status === 'active' ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30 text-[10px]' : 'bg-yellow-950/20 text-yellow-400 border-yellow-900/30 text-[10px]'}>
                    {s.status === 'active' ? 'Aktif' : 'Beklemede'}
                  </Badge>
                  <Button
                    onClick={() => handleDelete(s)}
                    disabled={deletingId === s.id}
                    variant="ghost"
                    className="h-9 w-9 p-0 text-red-400 hover:text-red-300 hover:bg-red-950/20 rounded-xl"
                  >
                    {deletingId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-[#0b0c10] border border-[#23252a] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white text-lg font-bold">Yeni Subdomain Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Ana Domain</label>
              <Select value={form.domainId} onValueChange={(v) => setForm({ ...form, domainId: v })}>
                <SelectTrigger className="bg-[#07080b] border-[#23252a] text-white rounded-xl">
                  <SelectValue placeholder="Domain seçin" />
                </SelectTrigger>
                <SelectContent className="bg-[#0b0c10] border-[#23252a] text-white">
                  {domains.map((d) => (
                    <SelectItem key={d.id} value={d.id} className="hover:bg-[#14151a]">{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Subdomain Adı</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="blog, shop, api..."
                className="bg-[#07080b] border-[#23252a] text-white rounded-xl"
              />
              {form.domainId && form.name && (
                <p className="text-xs text-cyan-400 mt-1">→ {form.name}.{domains.find(d => d.id === form.domainId)?.name}</p>
              )}
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)} className="border-[#23252a] text-white hover:bg-[#14151a] rounded-xl">İptal</Button>
            <Button onClick={handleAdd} disabled={submitting} className="bg-gradient-to-r from-primary to-[#828fff] text-white rounded-xl gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
