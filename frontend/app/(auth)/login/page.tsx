'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Lock, User, ArrowRight, Loader2, Shield, Globe, Database } from 'lucide-react';
import { LogoMark } from '@/components/shared/Logo';
import { useAuthStore } from '@/lib/store';
import { api, getErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';

const loginSchema = z.object({
  username: z.string().min(2, 'En az 2 karakter'),
  password: z.string().min(6, 'En az 6 karakter'),
});
type LoginInputs = z.infer<typeof loginSchema>;

const features = [
  { icon: Globe,    label: 'Domain Yönetimi',  color: 'text-sky-500',     bg: '#EFF6FF',  border: '#BFDBFE' },
  { icon: Shield,   label: 'SSL & Güvenlik',   color: 'text-emerald-500', bg: '#ECFDF5',  border: '#A7F3D0' },
  { icon: Database, label: 'Veritabanları',    color: 'text-violet-500',  bg: '#F5F3FF',  border: '#DDD6FE' },
];

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginInputs>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  const onSubmit = async (data: LoginInputs) => {
    setIsLoading(true);
    try {
      const res = await api.post('/auth/login', data);
      const { accessToken, user } = res.data.data;
      setAuth(user, accessToken);
      toast.success('Hoş geldiniz!');
      router.push('/dashboard');
    } catch (error) {
      toast.error(getErrorMessage(error) || 'Kullanıcı adı veya şifre hatalı.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden px-4"
      style={{ background: '#F0F4FF' }}>

      {/* Animated light orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[15%] left-[8%] w-[500px] h-[500px] rounded-full animate-orb-drift"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 65%)', filter: 'blur(70px)' }} />
        <div className="absolute bottom-[10%] right-[5%] w-[600px] h-[600px] rounded-full animate-orb-drift"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 65%)', filter: 'blur(90px)', animationDelay: '5s' }} />
        <div className="absolute top-[50%] right-[25%] w-[300px] h-[300px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 65%)', filter: 'blur(60px)' }} />
      </div>

      <div className="w-full max-w-[420px] z-10 animate-fade-up">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex relative mb-4 justify-center">
            <div className="relative">
              <LogoMark size={56} animated />
              <div className="absolute inset-0 rounded-2xl blur-xl opacity-30"
                style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }} />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gradient">HostPanel</h1>
          <p className="text-sm text-slate-400 mt-1">Enterprise Hosting Yönetimi</p>
        </div>

        {/* Card */}
        <div className="relative rounded-2xl p-7 overflow-hidden"
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            boxShadow: '0 8px 32px rgba(99,102,241,0.12), 0 2px 8px rgba(0,0,0,0.06)',
          }}>
          {/* Top accent gradient */}
          <div className="absolute top-0 left-0 right-0 h-0.5"
            style={{ background: 'linear-gradient(90deg, #6366F1, #8B5CF6, #6366F1)' }} />

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                Kullanıcı Adı
              </label>
              <div className="relative group">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                <input
                  {...register('username')}
                  type="text"
                  autoComplete="username"
                  placeholder="kullaniciadi"
                  className="w-full rounded-xl py-3 pl-11 pr-4 text-sm text-slate-800 placeholder-slate-300 outline-none transition-all"
                  style={{
                    background: '#F8FAFF',
                    border: '1px solid #E2E8F0',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.border = '1px solid #6366F1';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.10)';
                    e.currentTarget.style.background = '#FFFFFF';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.border = '1px solid #E2E8F0';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.background = '#F8FAFF';
                  }}
                />
              </div>
              {errors.username && <p className="text-[11px] text-rose-500">{errors.username.message}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                Şifre
              </label>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                <input
                  {...register('password')}
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full rounded-xl py-3 pl-11 pr-4 text-sm text-slate-800 placeholder-slate-300 outline-none transition-all"
                  style={{
                    background: '#F8FAFF',
                    border: '1px solid #E2E8F0',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.border = '1px solid #6366F1';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.10)';
                    e.currentTarget.style.background = '#FFFFFF';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.border = '1px solid #E2E8F0';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.background = '#F8FAFF';
                  }}
                />
              </div>
              {errors.password && <p className="text-[11px] text-rose-500">{errors.password.message}</p>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-60 active:scale-[0.98] mt-2 overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, #4F46E5, #7C3AED)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, #6366F1, #8B5CF6)'; }}
            >
              <span className="relative flex items-center gap-2">
                {isLoading
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Giriş yapılıyor...</>
                  : <><span>Giriş Yap</span><ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" /></>}
              </span>
            </button>
          </form>
        </div>

        {/* Feature pills */}
        <div className="flex justify-center gap-2 mt-5">
          {features.map(({ icon: Icon, label, color, bg, border }) => (
            <div key={label} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
              style={{ background: bg, border: `1px solid ${border}` }}>
              <Icon className={`h-3 w-3 ${color}`} />
              <span className="text-[10px] text-slate-500 font-medium">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
