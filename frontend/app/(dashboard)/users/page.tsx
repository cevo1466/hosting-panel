'use client';

import { useState, useEffect } from 'react';
import { Users, Plus, Trash2, RefreshCw, Loader2, Search, Shield, UserCheck, UserX, Edit } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api, getErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';

interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'reseller' | 'user';
  domainCount: number;
  status: 'active' | 'suspended';
  createdAt: string;
  lastLogin?: string;
  isSuspended: boolean;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [suspendingId, setSuspendingId] = useState<string | null>(null);
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'user' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async () => {
    if (!form.username || !form.email || !form.password) return toast.error('Tüm alanlar zorunludur.');
    setSubmitting(true);
    try {
      await api.post('/users', form);
      toast.success('Kullanıcı oluşturuldu.');
      setShowAdd(false);
      setForm({ username: '', email: '', password: '', role: 'user' });
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuspend = async (user: User) => {
    setSuspendingId(user.id);
    try {
      if (user.isSuspended) {
        await api.post(`/users/${user.id}/unsuspend`);
        toast.success('Kullanıcı aktif edildi.');
      } else {
        await api.post(`/users/${user.id}/suspend`);
        toast.success('Kullanıcı askıya alındı.');
      }
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSuspendingId(null);
    }
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`"${user.username}" kullanıcısını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) return;
    setDeletingId(user.id);
    try {
      await api.delete(`/users/${user.id}`);
      toast.success('Kullanıcı silindi.');
      setUsers(prev => prev.filter(u => u.id !== user.id));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  const roleConfig = {
    admin: { label: 'Admin', class: 'bg-red-950/20 text-red-400 border-red-900/30' },
    reseller: { label: 'Bayi', class: 'bg-[#5e6ad2]/10 text-[#5e6ad2] border-[#5e6ad2]/20' },
    user: { label: 'Kullanıcı', class: 'bg-[#14151a] text-[#8a8f98] border-[#23252a]' },
  };

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#23252a]/70 pb-6">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">Kullanıcı Yönetimi</h2>
          <p className="text-[#8a8f98] mt-1 text-sm">Hosting müşterileri ve kullanıcı hesaplarını yönetin.</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={fetchData} variant="outline" className="border-[#23252a] hover:bg-[#14151a] text-white rounded-xl"><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={() => setShowAdd(true)} className="bg-gradient-to-r from-primary to-[#828fff] hover:from-[#828fff] hover:to-[#5e6ad2] text-white rounded-xl py-5 px-5 gap-2">
            <Plus className="h-4 w-4" />Yeni Kullanıcı
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-white">{users.length}</p>
            <p className="text-xs text-[#8a8f98] mt-1">Toplam</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{users.filter(u => !u.isSuspended).length}</p>
            <p className="text-xs text-[#8a8f98] mt-1">Aktif</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-400">{users.filter(u => u.isSuspended).length}</p>
            <p className="text-xs text-[#8a8f98] mt-1">Askıya Alınmış</p>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8a8f98]" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Kullanıcı veya e-posta ara..." className="pl-11 bg-[#0b0c10]/60 border-[#23252a] text-white rounded-xl placeholder-[#62666d]" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="h-12 w-12 text-[#8a8f98] mb-4" />
            <p className="text-white font-semibold">Kullanıcı bulunamadı</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((user) => {
            const roleCfg = roleConfig[user.role] || roleConfig.user;
            return (
              <Card key={user.id} className={`backdrop-blur-xl border transition-all ${user.isSuspended ? 'bg-[#0b0c10]/30 border-[#23252a]/50 opacity-70' : 'bg-[#0b0c10]/50 border-[#23252a] hover:border-[#34343a]'}`}>
                <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${user.role === 'admin' ? 'bg-red-950/20 border border-red-800/30' : 'bg-[#14151a] border border-[#23252a]'}`}>
                      {user.role === 'admin' ? <Shield className="h-5 w-5 text-red-400" /> : <Users className="h-5 w-5 text-[#8a8f98]" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-white font-bold">{user.username}</p>
                        <Badge variant="outline" className={`${roleCfg.class} text-[10px]`}>{roleCfg.label}</Badge>
                        {user.isSuspended && <Badge variant="outline" className="bg-red-950/20 text-red-400 border-red-900/30 text-[10px]">Askıda</Badge>}
                      </div>
                      <p className="text-xs text-[#8a8f98]">{user.email}</p>
                      <p className="text-xs text-[#8a8f98] mt-0.5">
                        {user.domainCount || 0} domain • Kayıt: {new Date(user.createdAt).toLocaleDateString('tr-TR')}
                        {user.lastLogin && ` • Son giriş: ${new Date(user.lastLogin).toLocaleDateString('tr-TR')}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handleSuspend(user)}
                      disabled={suspendingId === user.id || user.role === 'admin'}
                      variant="outline"
                      className={`border-[#23252a] hover:bg-[#14151a] text-white rounded-xl text-xs gap-1.5 ${user.role === 'admin' ? 'opacity-30 cursor-not-allowed' : ''}`}
                    >
                      {suspendingId === user.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : user.isSuspended ? <UserCheck className="h-3.5 w-3.5 text-emerald-400" /> : <UserX className="h-3.5 w-3.5 text-yellow-400" />}
                      {user.isSuspended ? 'Aktif Et' : 'Askıya Al'}
                    </Button>
                    <Button
                      onClick={() => handleDelete(user)}
                      disabled={deletingId === user.id || user.role === 'admin'}
                      variant="ghost"
                      className={`h-9 w-9 p-0 text-red-400 hover:text-red-300 hover:bg-red-950/20 rounded-xl ${user.role === 'admin' ? 'opacity-30 cursor-not-allowed' : ''}`}
                    >
                      {deletingId === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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
          <DialogHeader><DialogTitle className="text-white text-lg font-bold">Yeni Kullanıcı Oluştur</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Kullanıcı Adı</label>
              <Input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="johndoe" className="bg-[#07080b] border-[#23252a] text-white rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">E-posta</label>
              <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} type="email" placeholder="john@example.com" className="bg-[#07080b] border-[#23252a] text-white rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Şifre</label>
              <Input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} type="password" placeholder="Güçlü şifre" className="bg-[#07080b] border-[#23252a] text-white rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Rol</label>
              <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
                <SelectTrigger className="bg-[#07080b] border-[#23252a] text-white rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#0b0c10] border-[#23252a] text-white">
                  <SelectItem value="user" className="hover:bg-[#14151a]">Kullanıcı</SelectItem>
                  <SelectItem value="reseller" className="hover:bg-[#14151a]">Bayi</SelectItem>
                  <SelectItem value="admin" className="hover:bg-[#14151a]">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)} className="border-[#23252a] text-white hover:bg-[#14151a] rounded-xl">İptal</Button>
            <Button onClick={handleCreate} disabled={submitting} className="bg-gradient-to-r from-primary to-[#828fff] text-white rounded-xl gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
