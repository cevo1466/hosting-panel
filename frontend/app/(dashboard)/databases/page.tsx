'use client';

import { useState, useEffect } from 'react';
import { Database, Plus, Trash2, RefreshCw, Loader2, Search, ExternalLink, HardDrive } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api, getErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';

interface DB {
  id: string;
  name: string;
  user: string;
  domain: string;
  sizeMb: number;
  maxSizeMb?: number;
  status: 'active' | 'disabled';
  createdAt: string;
}

interface Domain { id: string; name: string; }

export default function DatabasesPage() {
  const [databases, setDatabases] = useState<DB[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', domainId: '', dbUser: '', password: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dbRes, domsRes] = await Promise.all([api.get('/databases'), api.get('/domains')]);
      setDatabases(dbRes.data.data || []);
      setDomains(domsRes.data.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAdd = async () => {
    if (!form.name || !form.domainId) return toast.error('Veritabanı adı ve domain zorunludur.');
    setSubmitting(true);
    try {
      await api.post('/databases', { name: form.name, domainId: form.domainId, dbUser: form.dbUser || undefined, password: form.password || undefined });
      toast.success('Veritabanı oluşturuldu.');
      setShowAdd(false);
      setForm({ name: '', domainId: '', dbUser: '', password: '' });
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (db: DB) => {
    if (!confirm(`"${db.name}" veritabanını silmek istediğinizden emin misiniz? İçindeki tüm veriler silinecektir!`)) return;
    setDeletingId(db.id);
    try {
      await api.delete(`/databases/${db.id}`);
      toast.success('Veritabanı silindi.');
      setDatabases(prev => prev.filter(d => d.id !== db.id));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  const totalSize = databases.reduce((acc, db) => acc + (db.sizeMb || 0), 0);
  const filtered = databases.filter(d => d.name.toLowerCase().includes(search.toLowerCase()) || d.domain?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#23252a]/70 pb-6">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">Veritabanları</h2>
          <p className="text-[#8a8f98] mt-1 text-sm">MySQL/MariaDB veritabanlarınızı yönetin.</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={fetchData} variant="outline" className="border-[#23252a] hover:bg-[#14151a] text-white rounded-xl"><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={() => setShowAdd(true)} className="bg-gradient-to-r from-primary to-[#828fff] hover:from-[#828fff] hover:to-[#5e6ad2] text-white rounded-xl py-5 px-5 gap-2">
            <Plus className="h-4 w-4" />Yeni Veritabanı
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-white">{databases.length}</p>
            <p className="text-xs text-[#8a8f98] mt-1">Toplam DB</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{databases.filter(d => d.status === 'active').length}</p>
            <p className="text-xs text-[#8a8f98] mt-1">Aktif</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-cyan-400">{totalSize.toFixed(1)} MB</p>
            <p className="text-xs text-[#8a8f98] mt-1">Toplam Boyut</p>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8a8f98]" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Veritabanı veya domain ara..." className="pl-11 bg-[#0b0c10]/60 border-[#23252a] text-white rounded-xl placeholder-[#62666d]" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Database className="h-12 w-12 text-[#8a8f98] mb-4" />
            <p className="text-white font-semibold text-lg">Veritabanı bulunamadı</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((db) => {
            const sizePct = db.maxSizeMb ? Math.round((db.sizeMb / db.maxSizeMb) * 100) : 0;
            return (
              <Card key={db.id} className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a] hover:border-primary/40 group transition-all overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-[#5e6ad2]/10 border border-[#5e6ad2]/20 flex items-center justify-center text-[#5e6ad2] group-hover:scale-105 transition-transform">
                        <Database className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-white text-base font-bold">{db.name}</CardTitle>
                        <CardDescription className="text-[#8a8f98] text-xs">{db.domain}</CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className={db.status === 'active' ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30 text-[10px]' : 'bg-red-950/20 text-red-400 border-red-900/30 text-[10px]'}>
                      {db.status === 'active' ? 'Aktif' : 'Pasif'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[#8a8f98] block uppercase tracking-wider font-semibold mb-1">Kullanıcı</span>
                      <span className="text-slate-300 font-mono">{db.user || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[#8a8f98] block uppercase tracking-wider font-semibold mb-1">Boyut</span>
                      <span className="text-slate-300 font-mono">{db.sizeMb ? `${db.sizeMb} MB` : '0 MB'}</span>
                    </div>
                  </div>
                  {db.maxSizeMb && (
                    <div className="space-y-1.5 border-t border-[#23252a]/50 pt-3">
                      <div className="flex justify-between text-xs">
                        <span className="text-[#8a8f98] flex items-center gap-1"><HardDrive className="h-3.5 w-3.5" />Kota</span>
                        <span className="font-mono text-slate-200">{db.sizeMb}MB / {db.maxSizeMb}MB ({sizePct}%)</span>
                      </div>
                      <Progress value={sizePct} className={`h-1.5 bg-[#14151a] [&>div]:bg-gradient-to-r ${sizePct > 80 ? '[&>div]:from-red-500 [&>div]:to-pink-500' : '[&>div]:from-[#5e6ad2] [&>div]:to-[#828fff]'}`} />
                    </div>
                  )}
                  <div className="pt-2 flex gap-2.5">
                    <Button variant="outline" className="flex-1 border-[#23252a] hover:bg-[#14151a] text-white hover:text-white rounded-xl text-xs gap-1.5">
                      <ExternalLink className="h-3.5 w-3.5 text-[#8a8f98]" />phpMyAdmin
                    </Button>
                    <Button onClick={() => handleDelete(db)} disabled={deletingId === db.id} variant="ghost" className="h-9 w-9 p-0 text-red-400 hover:text-red-300 hover:bg-red-950/20 rounded-xl flex items-center justify-center">
                      {deletingId === db.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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
          <DialogHeader><DialogTitle className="text-white text-lg font-bold">Yeni Veritabanı Oluştur</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Domain</label>
              <Select value={form.domainId} onValueChange={(v) => setForm({ ...form, domainId: v })}>
                <SelectTrigger className="bg-[#07080b] border-[#23252a] text-white rounded-xl"><SelectValue placeholder="Domain seçin" /></SelectTrigger>
                <SelectContent className="bg-[#0b0c10] border-[#23252a] text-white">
                  {domains.map(d => <SelectItem key={d.id} value={d.id} className="hover:bg-[#14151a]">{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Veritabanı Adı</label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="myapp_db" className="bg-[#07080b] border-[#23252a] text-white rounded-xl font-mono" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">DB Kullanıcısı (opsiyonel)</label>
              <Input value={form.dbUser} onChange={e => setForm({ ...form, dbUser: e.target.value })} placeholder="myapp_user" className="bg-[#07080b] border-[#23252a] text-white rounded-xl font-mono" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Şifre (opsiyonel)</label>
              <Input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} type="password" placeholder="Güçlü şifre" className="bg-[#07080b] border-[#23252a] text-white rounded-xl" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)} className="border-[#23252a] text-white hover:bg-[#14151a] rounded-xl">İptal</Button>
            <Button onClick={handleAdd} disabled={submitting} className="bg-gradient-to-r from-primary to-[#828fff] text-white rounded-xl gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
