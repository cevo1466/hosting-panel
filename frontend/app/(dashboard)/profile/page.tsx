'use client';

import { useState } from 'react';
import { User, Lock, Save, Loader2, Shield, Eye, EyeOff, LogOut } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/lib/store';
import { api, getErrorMessage } from '@/lib/api';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  const handleChangePassword = async () => {
    if (!pwForm.currentPassword || !pwForm.newPassword) return toast.error('Tüm alanlar zorunludur.');
    if (pwForm.newPassword !== pwForm.confirmPassword) return toast.error('Yeni şifreler eşleşmiyor.');
    if (pwForm.newPassword.length < 8) return toast.error('Şifre en az 8 karakter olmalı.');
    setSavingPw(true);
    try {
      await api.put('/auth/change-password', {
        oldPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      toast.success('Şifre başarıyla değiştirildi.');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingPw(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {}
    logout();
    router.push('/login');
    toast.success('Çıkış yapıldı.');
  };

  const roleConfig = {
    admin: { label: 'Sistem Yöneticisi', class: 'bg-red-950/20 text-red-400 border-red-900/30' },
    reseller: { label: 'Bayi', class: 'bg-[#5e6ad2]/10 text-[#5e6ad2] border-[#5e6ad2]/20' },
    user: { label: 'Kullanıcı', class: 'bg-[#14151a] text-[#8a8f98] border-[#23252a]' },
  };
  const roleCfg = roleConfig[user?.role || 'user'];

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#23252a]/70 pb-6">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">Profilim</h2>
          <p className="text-[#8a8f98] mt-1 text-sm">Hesap bilgilerinizi ve güvenlik ayarlarınızı yönetin.</p>
        </div>
        <Button onClick={handleLogout} variant="outline" className="border-red-900/30 hover:bg-red-950/20 text-red-400 hover:text-red-300 rounded-xl gap-2 text-xs">
          <LogOut className="h-4 w-4" />Çıkış Yap
        </Button>
      </div>

      <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
        <CardHeader>
          <CardTitle className="text-white text-base font-bold flex items-center gap-2">
            <User className="h-4 w-4 text-cyan-400" /> Hesap Bilgileri
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-5">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-cyan-400 p-[1.5px]">
              <div className="h-full w-full rounded-[14px] bg-[#0c0d12] flex items-center justify-center">
                <span className="text-2xl font-bold text-white">{user?.username?.[0]?.toUpperCase()}</span>
              </div>
            </div>
            <div>
              <p className="text-white text-xl font-bold">{user?.username}</p>
              <p className="text-[#8a8f98] text-sm">{user?.email}</p>
              <div className="mt-1.5">
                <Badge variant="outline" className={`${roleCfg?.class} text-xs`}>{roleCfg?.label}</Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2 border-t border-[#23252a]/50">
            <div>
              <span className="text-xs text-[#8a8f98] uppercase tracking-wider font-semibold">Kullanıcı ID</span>
              <p className="text-slate-300 font-mono text-sm mt-1 truncate">{user?.id}</p>
            </div>
            <div>
              <span className="text-xs text-[#8a8f98] uppercase tracking-wider font-semibold">Hesap Durumu</span>
              <div className="mt-1">
                <Badge variant="outline" className="bg-emerald-950/20 text-emerald-400 border-emerald-900/30 text-xs">Aktif</Badge>
              </div>
            </div>
            {user?.createdAt && (
              <div>
                <span className="text-xs text-[#8a8f98] uppercase tracking-wider font-semibold">Kayıt Tarihi</span>
                <p className="text-slate-300 text-sm mt-1">{new Date(user.createdAt).toLocaleDateString('tr-TR')}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
        <CardHeader>
          <CardTitle className="text-white text-base font-bold flex items-center gap-2">
            <Lock className="h-4 w-4 text-[#5e6ad2]" /> Şifre Değiştir
          </CardTitle>
          <CardDescription className="text-[#8a8f98] text-xs">
            Hesabınızın güvenliği için düzenli aralıklarla şifrenizi değiştirin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Mevcut Şifre</label>
            <div className="relative">
              <Input
                value={pwForm.currentPassword}
                onChange={e => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••"
                className="bg-[#07080b] border-[#23252a] text-white rounded-xl pr-10"
              />
              <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a8f98] hover:text-white">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Yeni Şifre</label>
            <Input
              value={pwForm.newPassword}
              onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })}
              type={showPw ? 'text' : 'password'}
              placeholder="En az 8 karakter"
              className="bg-[#07080b] border-[#23252a] text-white rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Yeni Şifre (Tekrar)</label>
            <Input
              value={pwForm.confirmPassword}
              onChange={e => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
              type={showPw ? 'text' : 'password'}
              placeholder="Şifreyi tekrar girin"
              className={`bg-[#07080b] border-[#23252a] text-white rounded-xl ${pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword ? 'border-red-500/50' : ''}`}
            />
            {pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword && (
              <p className="text-xs text-red-400">Şifreler eşleşmiyor</p>
            )}
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={savingPw}
            className="bg-gradient-to-r from-primary to-[#828fff] hover:from-[#828fff] hover:to-[#5e6ad2] text-white rounded-xl gap-2"
          >
            {savingPw ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Şifreyi Kaydet
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
        <CardHeader>
          <CardTitle className="text-white text-base font-bold flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-400" /> İki Faktörlü Doğrulama (2FA)
          </CardTitle>
          <CardDescription className="text-[#8a8f98] text-xs">
            Hesabınızı ek güvenlik katmanıyla koruyun.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-xl bg-[#0a0b10]/60 border border-[#23252a]/60">
            <div>
              <p className="text-white text-sm font-medium">TOTP Authenticator</p>
              <p className="text-xs text-[#8a8f98] mt-0.5">Google Authenticator veya Authy kullanabilirsiniz.</p>
            </div>
            <Badge variant="outline" className="bg-yellow-950/20 text-yellow-400 border-yellow-900/30 text-xs">Pasif</Badge>
          </div>
          <p className="text-xs text-[#8a8f98] mt-3">2FA kurulumu için güvenlik bölümünü kullanın veya bir sonraki oturum açışınızda ayarlayabilirsiniz.</p>
        </CardContent>
      </Card>
    </div>
  );
}
