'use client';

import { useState, useEffect } from 'react';
import { FolderOpen, Plus, Trash2, RefreshCw, Loader2, Search, Eye, EyeOff, ToggleLeft, ToggleRight, RefreshCcw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api, getErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';

interface FTPAccount {
  id: string;
  username: string;
  domain: string;
  homeDir: string;
  quotaMb: number;
  usedMb: number;
  lastLogin?: string;
  status: 'active' | 'disabled';
  domainId?: string;
}

interface Domain { id: string; name: string; }
interface Subdomain { id: string; name: string; domainId: string; domain?: { name: string } }

export default function FTPPage() {
  const [accounts, setAccounts] = useState<FTPAccount[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [subdomains, setSubdomains] = useState<Subdomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showPwChange, setShowPwChange] = useState<FTPAccount | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', domainId: '', subdomainId: '', quota: '1024' });
  const [pwForm, setPwForm] = useState({ password: '' });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ftpRes, domsRes, subsRes] = await Promise.all([
        api.get('/ftp'),
        api.get('/domains'),
        api.get('/subdomains').catch(() => ({ data: { data: [] } })),
      ]);
      setAccounts(ftpRes.data.data || []);
      setDomains(domsRes.data.data || []);
      setSubdomains(subsRes.data.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAdd = async () => {
    if (!form.username || !form.password || !form.domainId) return toast.error('Tüm alanlar zorunludur.');
    setSubmitting(true);
    try {
      await api.post('/ftp', {
        username: form.username,
        password: form.password,
        domainId: form.domainId,
        subdomainId: form.subdomainId || undefined,
        quota: parseInt(form.quota),
      });
      toast.success('FTP hesabı oluşturuldu.');
      setShowAdd(false);
      setForm({ username: '', password: '', domainId: '', subdomainId: '', quota: '1024' });
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangePassword = async () => {
    if (!pwForm.password || !showPwChange) return;
    setSubmitting(true);
    try {
      await api.put(`/ftp/${showPwChange.id}/password`, { password: pwForm.password });
      toast.success('Şifre başarıyla değiştirildi.');
      setShowPwChange(null);
      setPwForm({ password: '' });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (acc: FTPAccount) => {
    setTogglingId(acc.id);
    try {
      await api.patch(`/ftp/${acc.id}/toggle`);
      toast.success(acc.status === 'active' ? 'FTP hesabı devre dışı bırakıldı.' : 'FTP hesabı aktif edildi.');
      setAccounts(prev => prev.map(a => a.id === acc.id ? { ...a, status: a.status === 'active' ? 'disabled' : 'active' } : a));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (acc: FTPAccount) => {
    if (!confirm(`"${acc.username}" FTP hesabını silmek istediğinizden emin misiniz?`)) return;
    setDeletingId(acc.id);
    try {
      await api.delete(`/ftp/${acc.id}`);
      toast.success('FTP hesabı silindi.');
      setAccounts(prev => prev.filter(a => a.id !== acc.id));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/ftp/sync');
      const { imported, skipped } = res.data.data;
      if (imported.length > 0) {
        toast.success(`${imported.length} hesap içe aktarıldı: ${imported.join(', ')}`);
      } else {
        toast.success('Yeni hesap bulunamadı — tüm sistem hesapları zaten panelde mevcut.');
      }
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSyncing(false);
    }
  };

  const filtered = accounts.filter(a => a.username.toLowerCase().includes(search.toLowerCase()) || a.domain?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#23252a]/70 pb-6">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">FTP Yönetimi</h2>
          <p className="text-[#8a8f98] mt-1 text-sm">FTP hesaplarınızı oluşturun ve yönetin.</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={fetchData} variant="outline" className="border-[#23252a] hover:bg-[#14151a] text-white rounded-xl"><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={handleSync} disabled={syncing} variant="outline" className="border-[#23252a] hover:bg-[#14151a] text-white rounded-xl gap-2 text-xs">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Sistemi Senkronize Et
          </Button>
          <Button onClick={() => setShowAdd(true)} className="bg-gradient-to-r from-primary to-[#828fff] hover:from-[#828fff] hover:to-[#5e6ad2] text-white rounded-xl py-5 px-5 gap-2">
            <Plus className="h-4 w-4" />Yeni FTP Hesabı
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8a8f98]" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="FTP hesabı ara..." className="pl-11 bg-[#0b0c10]/60 border-[#23252a] text-white rounded-xl placeholder-[#62666d]" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FolderOpen className="h-12 w-12 text-[#8a8f98] mb-4" />
            <p className="text-white font-semibold text-lg">FTP hesabı bulunamadı</p>
            <p className="text-[#8a8f98] text-sm mt-1">Dosya yönetimi için FTP hesabı oluşturun.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((acc) => {
            const quotaPct = acc.quotaMb > 0 ? Math.round((acc.usedMb / acc.quotaMb) * 100) : 0;
            return (
              <Card key={acc.id} className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a] hover:border-[#34343a] transition-all relative overflow-hidden">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-orange-950/20 border border-orange-800/30 flex items-center justify-center text-orange-400">
                        <FolderOpen className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-white font-bold font-mono">{acc.username}</p>
                        <p className="text-xs text-[#8a8f98]">{acc.domain}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={acc.status === 'active' ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30 text-[10px]' : 'bg-red-950/20 text-red-400 border-red-900/30 text-[10px]'}>
                      {acc.status === 'active' ? 'Aktif' : 'Pasif'}
                    </Badge>
                  </div>

                  <div className="text-xs text-[#8a8f98] font-mono bg-[#07080b] rounded-lg px-3 py-2 border border-[#23252a]/50 truncate">
                    {acc.homeDir || '/home/ftp/'}
                  </div>

                  {acc.quotaMb > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-[#8a8f98]">Disk Kullanımı</span>
                        <span className="font-mono text-slate-300">{acc.usedMb}MB / {acc.quotaMb}MB ({quotaPct}%)</span>
                      </div>
                      <Progress value={quotaPct} className={`h-1.5 bg-[#14151a] [&>div]:bg-gradient-to-r ${quotaPct > 80 ? '[&>div]:from-red-500 [&>div]:to-pink-500' : '[&>div]:from-orange-400 [&>div]:to-yellow-400'}`} />
                    </div>
                  )}

                  {acc.lastLogin && (
                    <p className="text-xs text-[#8a8f98]">Son giriş: {new Date(acc.lastLogin).toLocaleString('tr-TR')}</p>
                  )}

                  <div className="flex gap-2 pt-1 border-t border-[#23252a]/50">
                    <Button onClick={() => setShowPwChange(acc)} variant="outline" className="flex-1 border-[#23252a] hover:bg-[#14151a] text-white hover:text-white rounded-xl text-xs">Şifre Değiştir</Button>
                    <Button onClick={() => handleToggle(acc)} disabled={togglingId === acc.id} variant="outline" className="h-9 w-9 p-0 border-[#23252a] hover:bg-[#14151a] text-[#8a8f98] hover:text-white rounded-xl flex items-center justify-center">
                      {togglingId === acc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : acc.status === 'active' ? <ToggleRight className="h-4 w-4 text-emerald-400" /> : <ToggleLeft className="h-4 w-4" />}
                    </Button>
                    <Button onClick={() => handleDelete(acc)} disabled={deletingId === acc.id} variant="ghost" className="h-9 w-9 p-0 text-red-400 hover:text-red-300 hover:bg-red-950/20 rounded-xl flex items-center justify-center">
                      {deletingId === acc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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
          <DialogHeader><DialogTitle className="text-white text-lg font-bold">Yeni FTP Hesabı Oluştur</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Domain</label>
              <Select value={form.domainId} onValueChange={(v) => setForm({ ...form, domainId: v, subdomainId: '' })}>
                <SelectTrigger className="bg-[#07080b] border-[#23252a] text-white rounded-xl"><SelectValue placeholder="Domain seçin" /></SelectTrigger>
                <SelectContent className="bg-[#0b0c10] border-[#23252a] text-white">
                  {domains.map(d => <SelectItem key={d.id} value={d.id} className="hover:bg-[#14151a]">{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.domainId && subdomains.filter(s => s.domainId === form.domainId).length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Alt Alan Adı (opsiyonel)</label>
                <Select value={form.subdomainId || 'none'} onValueChange={(v) => setForm({ ...form, subdomainId: v === 'none' ? '' : v })}>
                  <SelectTrigger className="bg-[#07080b] border-[#23252a] text-white rounded-xl"><SelectValue placeholder="Ana domain (kök dizin)" /></SelectTrigger>
                  <SelectContent className="bg-[#0b0c10] border-[#23252a] text-white">
                    <SelectItem value="none" className="hover:bg-[#14151a]">Ana domain (kök dizin)</SelectItem>
                    {subdomains.filter(s => s.domainId === form.domainId).map(s => (
                      <SelectItem key={s.id} value={s.id} className="hover:bg-[#14151a]">{s.name}.{domains.find(d => d.id === form.domainId)?.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-[#62666d]">Alt alan adı seçerseniz FTP, o alt alan adının public_html dizinine bağlanır.</p>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Kullanıcı Adı</label>
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="ftpuser" className="bg-[#07080b] border-[#23252a] text-white rounded-xl font-mono" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Şifre</label>
              <div className="relative">
                <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} type={showPw ? 'text' : 'password'} placeholder="Güçlü şifre girin" className="bg-[#07080b] border-[#23252a] text-white rounded-xl pr-10" />
                <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a8f98] hover:text-white">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-[#8a8f98]">En az 8 karakter, büyük/küçük harf, rakam ve özel karakter içermelidir.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Kota (MB)</label>
              <Input value={form.quota} onChange={(e) => setForm({ ...form, quota: e.target.value })} type="number" placeholder="1024" className="bg-[#07080b] border-[#23252a] text-white rounded-xl" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)} className="border-[#23252a] text-white hover:bg-[#14151a] rounded-xl">İptal</Button>
            <Button onClick={handleAdd} disabled={submitting} className="bg-gradient-to-r from-primary to-[#828fff] text-white rounded-xl gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showPwChange} onOpenChange={() => setShowPwChange(null)}>
        <DialogContent className="bg-[#0b0c10] border border-[#23252a] text-white max-w-md">
          <DialogHeader><DialogTitle className="text-white text-lg font-bold">Şifre Değiştir — {showPwChange?.username}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Yeni Şifre</label>
              <div className="relative">
                <Input value={pwForm.password} onChange={(e) => setPwForm({ password: e.target.value })} type={showPw ? 'text' : 'password'} placeholder="Yeni şifre" className="bg-[#07080b] border-[#23252a] text-white rounded-xl pr-10" />
                <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a8f98] hover:text-white">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPwChange(null)} className="border-[#23252a] text-white hover:bg-[#14151a] rounded-xl">İptal</Button>
            <Button onClick={handleChangePassword} disabled={submitting} className="bg-gradient-to-r from-primary to-[#828fff] text-white rounded-xl gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Şifreyi Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
