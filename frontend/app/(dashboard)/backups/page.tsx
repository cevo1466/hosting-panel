'use client';

import { useState, useEffect } from 'react';
import { Archive, Plus, Trash2, RefreshCw, Loader2, Search, RotateCcw, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api, getErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';

interface Backup {
  id: string;
  domain: string;
  type: 'full' | 'files' | 'database' | 'email';
  status: 'completed' | 'running' | 'failed' | 'scheduled';
  sizeMb: number;
  createdAt: string;
  expiresAt?: string;
}

interface Domain { id: string; name: string; }

const typeLabels: Record<string, string> = { full: 'Tam Yedek', files: 'Dosyalar', database: 'Veritabanı', email: 'E-posta' };
const typeColors: Record<string, string> = { full: 'text-[#5e6ad2]', files: 'text-cyan-400', database: 'text-emerald-400', email: 'text-purple-400' };
const statusColors: Record<string, string> = {
  completed: 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30',
  running: 'bg-blue-950/20 text-blue-400 border-blue-900/30',
  failed: 'bg-red-950/20 text-red-400 border-red-900/30',
  scheduled: 'bg-yellow-950/20 text-yellow-400 border-yellow-900/30',
};
const statusLabels: Record<string, string> = { completed: 'Tamamlandı', running: 'Devam Ediyor', failed: 'Başarısız', scheduled: 'Planlandı' };

export default function BackupsPage() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({ domainId: '', type: 'full' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [backRes, domsRes] = await Promise.all([api.get('/backups'), api.get('/domains')]);
      setBackups(backRes.data.data || []);
      setDomains(domsRes.data.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async () => {
    if (!form.domainId) return toast.error('Lütfen domain seçin.');
    setSubmitting(true);
    try {
      await api.post('/backups', { domainId: form.domainId, type: form.type });
      toast.success('Yedekleme işlemi başlatıldı.');
      setShowCreate(false);
      setForm({ domainId: '', type: 'full' });
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestore = async (backup: Backup) => {
    if (!confirm(`"${backup.domain}" için ${typeLabels[backup.type]} yedeği geri yüklensin mi? Bu işlem mevcut verilerin üzerine yazacaktır.`)) return;
    setRestoringId(backup.id);
    try {
      await api.post(`/backups/${backup.id}/restore`);
      toast.success('Yedek geri yükleme işlemi başlatıldı.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setRestoringId(null);
    }
  };

  const handleDelete = async (backup: Backup) => {
    if (!confirm('Bu yedeği silmek istediğinizden emin misiniz?')) return;
    setDeletingId(backup.id);
    try {
      await api.delete(`/backups/${backup.id}`);
      toast.success('Yedek silindi.');
      setBackups(prev => prev.filter(b => b.id !== backup.id));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  const totalSize = backups.reduce((acc, b) => acc + (b.sizeMb || 0), 0);
  const filtered = backups.filter(b => b.domain?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#23252a]/70 pb-6">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">Yedekleme Sistemi</h2>
          <p className="text-[#8a8f98] mt-1 text-sm">Domain yedeklerini yönetin ve geri yükleyin.</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={fetchData} variant="outline" className="border-[#23252a] hover:bg-[#14151a] text-white rounded-xl"><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-primary to-[#828fff] hover:from-[#828fff] hover:to-[#5e6ad2] text-white rounded-xl py-5 px-5 gap-2">
            <Plus className="h-4 w-4" />Yedek Al
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-white">{backups.length}</p>
            <p className="text-xs text-[#8a8f98] mt-1">Toplam Yedek</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{backups.filter(b => b.status === 'completed').length}</p>
            <p className="text-xs text-[#8a8f98] mt-1">Tamamlandı</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-400">{backups.filter(b => b.status === 'failed').length}</p>
            <p className="text-xs text-[#8a8f98] mt-1">Başarısız</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-cyan-400">{(totalSize / 1024).toFixed(1)} GB</p>
            <p className="text-xs text-[#8a8f98] mt-1">Toplam Boyut</p>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8a8f98]" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Domain ara..." className="pl-11 bg-[#0b0c10]/60 border-[#23252a] text-white rounded-xl placeholder-[#62666d]" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Archive className="h-12 w-12 text-[#8a8f98] mb-4" />
            <p className="text-white font-semibold">Yedek bulunamadı</p>
            <p className="text-[#8a8f98] text-sm mt-1">Verilerinizi korumak için yedek alın.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map((backup) => (
            <Card key={backup.id} className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a] hover:border-[#34343a] transition-all">
              <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-xl bg-[#14151a] border border-[#23252a] flex items-center justify-center ${typeColors[backup.type] || 'text-slate-400'}`}>
                    <Archive className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-white font-bold">{backup.domain}</p>
                      <Badge variant="outline" className="bg-[#14151a] text-[#8a8f98] border-[#23252a] text-[10px]">{typeLabels[backup.type]}</Badge>
                    </div>
                    <p className="text-xs text-[#8a8f98] mt-0.5">{new Date(backup.createdAt).toLocaleString('tr-TR')} • {backup.sizeMb ? `${backup.sizeMb} MB` : '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={`${statusColors[backup.status]} text-[10px]`}>
                    {statusLabels[backup.status]}
                  </Badge>
                  {backup.status === 'completed' && (
                    <Button onClick={() => handleRestore(backup)} disabled={restoringId === backup.id} variant="outline" className="border-[#23252a] hover:bg-[#14151a] text-white hover:text-white rounded-xl text-xs gap-1.5">
                      {restoringId === backup.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                      Geri Yükle
                    </Button>
                  )}
                  <Button onClick={() => handleDelete(backup)} disabled={deletingId === backup.id} variant="ghost" className="h-9 w-9 p-0 text-red-400 hover:text-red-300 hover:bg-red-950/20 rounded-xl">
                    {deletingId === backup.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-[#0b0c10] border border-[#23252a] text-white max-w-md">
          <DialogHeader><DialogTitle className="text-white text-lg font-bold">Yeni Yedek Oluştur</DialogTitle></DialogHeader>
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
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Yedek Türü</label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="bg-[#07080b] border-[#23252a] text-white rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#0b0c10] border-[#23252a] text-white">
                  <SelectItem value="full" className="hover:bg-[#14151a]">Tam Yedek (Dosyalar + DB + E-posta)</SelectItem>
                  <SelectItem value="files" className="hover:bg-[#14151a]">Sadece Dosyalar</SelectItem>
                  <SelectItem value="database" className="hover:bg-[#14151a]">Sadece Veritabanı</SelectItem>
                  <SelectItem value="email" className="hover:bg-[#14151a]">Sadece E-posta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} className="border-[#23252a] text-white hover:bg-[#14151a] rounded-xl">İptal</Button>
            <Button onClick={handleCreate} disabled={submitting} className="bg-gradient-to-r from-primary to-[#828fff] text-white rounded-xl gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}Yedek Al
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
