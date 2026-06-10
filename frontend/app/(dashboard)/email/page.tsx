'use client';

import { useState, useEffect } from 'react';
import { Mail, Plus, Trash2, RefreshCw, Loader2, Search, ExternalLink, HardDrive, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api, getErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';

interface EmailAccount {
  id: string;
  address: string;
  domain: string;
  quotaMb: number;
  usedMb: number;
  lastLogin?: string;
  status: 'active' | 'disabled';
  hasForward: boolean;
  hasAutoresponder: boolean;
  domainId?: string;
}

interface Domain { id: string; name: string; }

export default function EmailPage() {
  const [emails, setEmails] = useState<EmailAccount[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showPwChange, setShowPwChange] = useState<EmailAccount | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({ local: '', domainId: '', password: '', quotaMb: '1024' });
  const [pwForm, setPwForm] = useState({ password: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [emailRes, domsRes] = await Promise.all([api.get('/email'), api.get('/domains')]);
      setEmails(emailRes.data.data || []);
      setDomains(domsRes.data.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAdd = async () => {
    if (!form.local || !form.domainId || !form.password) return toast.error('Tüm zorunlu alanları doldurun.');
    setSubmitting(true);
    try {
      const domainName = domains.find(d => d.id === form.domainId)?.name || '';
      await api.post('/email', {
        address: `${form.local}@${domainName}`,
        domainId: form.domainId,
        password: form.password,
        quotaMb: parseInt(form.quotaMb) || 1024,
      });
      toast.success('E-posta hesabı oluşturuldu.');
      setShowAdd(false);
      setForm({ local: '', domainId: '', password: '', quotaMb: '1024' });
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
      await api.put(`/email/${showPwChange.id}/password`, { password: pwForm.password });
      toast.success('Şifre değiştirildi.');
      setShowPwChange(null);
      setPwForm({ password: '' });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (email: EmailAccount) => {
    if (!confirm(`"${email.address}" e-posta hesabını silmek istediğinizden emin misiniz?`)) return;
    setDeletingId(email.id);
    try {
      await api.delete(`/email/${email.id}`);
      toast.success('E-posta hesabı silindi.');
      setEmails(prev => prev.filter(e => e.id !== email.id));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = emails.filter(e => e.address.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#23252a]/70 pb-6">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">E-posta Hesapları</h2>
          <p className="text-[#8a8f98] mt-1 text-sm">E-posta kutularınızı oluşturun ve yönetin.</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={fetchData} variant="outline" className="border-[#23252a] hover:bg-[#14151a] text-white rounded-xl"><RefreshCw className="h-4 w-4" /></Button>
          <Button variant="outline" className="border-[#23252a] hover:bg-[#14151a] text-white hover:text-white rounded-xl text-xs gap-1.5 py-5">
            <ExternalLink className="h-4 w-4 text-[#8a8f98]" />Webmail
          </Button>
          <Button onClick={() => setShowAdd(true)} className="bg-gradient-to-r from-primary to-[#828fff] hover:from-[#828fff] hover:to-[#5e6ad2] text-white rounded-xl py-5 px-5 gap-2">
            <Plus className="h-4 w-4" />Yeni Hesap
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8a8f98]" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="E-posta adresine göre ara..." className="pl-11 bg-[#0b0c10]/60 border-[#23252a] focus:border-primary text-white rounded-xl placeholder-[#62666d]" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Mail className="h-12 w-12 text-[#8a8f98] mb-4" />
            <p className="text-white font-semibold text-lg">E-posta hesabı bulunamadı</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((email) => {
            const quotaPercent = email.quotaMb > 0 ? Math.round((email.usedMb / email.quotaMb) * 100) : 0;
            return (
              <Card key={email.id} className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a] hover:border-primary/40 group transition-all relative overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="h-10 w-10 rounded-xl bg-purple-950/20 border border-purple-800/30 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div className="flex gap-1.5">
                      {email.hasForward && (
                        <Badge variant="outline" className="bg-[#14151a] text-cyan-400 border-cyan-900/20 text-[10px]">Yönlendirme</Badge>
                      )}
                      <Badge variant="outline" className={email.status === 'active' ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30 text-[10px]' : 'bg-red-950/20 text-red-400 border-red-900/30 text-[10px]'}>
                        {email.status === 'active' ? 'Aktif' : 'Pasif'}
                      </Badge>
                    </div>
                  </div>
                  <CardTitle className="text-white text-base font-bold mt-4 truncate">{email.address}</CardTitle>
                  <CardDescription className="text-[#8a8f98] text-xs font-mono">{email.domain}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <div className="space-y-2 border-t border-[#23252a]/50 pt-4">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#8a8f98] flex items-center gap-1.5"><HardDrive className="h-3.5 w-3.5" />Kota</span>
                      <span className="font-mono text-slate-200">{email.usedMb || 0}MB / {email.quotaMb}MB ({quotaPercent}%)</span>
                    </div>
                    <Progress value={quotaPercent} className={`h-1.5 bg-[#14151a] [&>div]:bg-gradient-to-r ${quotaPercent > 80 ? '[&>div]:from-red-500 [&>div]:to-pink-500' : '[&>div]:from-purple-500 [&>div]:to-[#828fff]'}`} />
                  </div>
                  <div className="pt-2 flex gap-2.5">
                    <Button onClick={() => setShowPwChange(email)} variant="outline" className="flex-1 border-[#23252a] hover:bg-[#14151a] text-white hover:text-white rounded-xl text-xs">Şifre Değiştir</Button>
                    <Button onClick={() => handleDelete(email)} disabled={deletingId === email.id} variant="ghost" className="h-9 w-9 p-0 text-red-400 hover:text-red-300 hover:bg-red-950/20 rounded-xl flex items-center justify-center">
                      {deletingId === email.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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
          <DialogHeader><DialogTitle className="text-white text-lg font-bold">Yeni E-posta Hesabı</DialogTitle></DialogHeader>
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
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">E-posta Adresi</label>
              <div className="flex gap-2">
                <Input value={form.local} onChange={e => setForm({ ...form, local: e.target.value })} placeholder="kullanici" className="bg-[#07080b] border-[#23252a] text-white rounded-xl flex-1 font-mono" />
                <div className="flex items-center text-[#8a8f98] text-sm px-2">@{form.domainId ? domains.find(d => d.id === form.domainId)?.name : 'domain.com'}</div>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Şifre</label>
              <div className="relative">
                <Input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} type={showPw ? 'text' : 'password'} placeholder="Güçlü şifre" className="bg-[#07080b] border-[#23252a] text-white rounded-xl pr-10" />
                <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a8f98]">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Kota (MB)</label>
              <Input value={form.quotaMb} onChange={e => setForm({ ...form, quotaMb: e.target.value })} type="number" placeholder="1024" className="bg-[#07080b] border-[#23252a] text-white rounded-xl" />
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
        <DialogContent className="bg-[#0b0c10] border border-[#23252a] text-white max-w-sm">
          <DialogHeader><DialogTitle className="text-white text-lg font-bold">Şifre Değiştir — {showPwChange?.address}</DialogTitle></DialogHeader>
          <div className="py-2">
            <div className="relative">
              <Input value={pwForm.password} onChange={e => setPwForm({ password: e.target.value })} type={showPw ? 'text' : 'password'} placeholder="Yeni şifre" className="bg-[#07080b] border-[#23252a] text-white rounded-xl pr-10" />
              <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a8f98]">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPwChange(null)} className="border-[#23252a] text-white hover:bg-[#14151a] rounded-xl">İptal</Button>
            <Button onClick={handleChangePassword} disabled={submitting} className="bg-gradient-to-r from-primary to-[#828fff] text-white rounded-xl">
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
