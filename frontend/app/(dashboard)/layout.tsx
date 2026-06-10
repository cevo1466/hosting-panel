'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { useAuthStore, useUIStore } from '@/lib/store';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    try {
      useAuthStore.persist.rehydrate();
      useUIStore.persist.rehydrate();
    } catch (e) {}
    // Apply stored theme to <html> element immediately after rehydration
    const storedTheme = useUIStore.getState().theme;
    document.documentElement.classList.toggle('dark', storedTheme === 'dark');
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const token = localStorage.getItem('auth_token');
    const { isAuthenticated } = useAuthStore.getState();
    if (!token && !isAuthenticated) router.replace('/login');
  }, [mounted, router]);

  if (!mounted) {
    return (
      <div className="flex h-screen w-screen items-center justify-center" style={{ background: '#F0F4FF' }}>
        <div className="relative">
          <div className="h-10 w-10 rounded-full border border-indigo-200" />
          <div className="absolute inset-0 h-10 w-10 animate-spin rounded-full border-t-2 border-indigo-500" />
          <div className="absolute inset-1 h-8 w-8 animate-spin rounded-full border-t border-violet-400/60"
            style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: '#F0F4FF' }}>

      {/* Subtle ambient orb blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-1/4 -left-1/4 w-3/4 h-3/4 rounded-full animate-orb-drift"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div className="absolute -bottom-1/4 -right-1/4 w-3/4 h-3/4 rounded-full animate-orb-drift"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)', filter: 'blur(80px)', animationDelay: '4s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1/2 h-1/2 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.04) 0%, transparent 70%)', filter: 'blur(100px)' }} />
      </div>

      <Sidebar />

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Topbar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-5 md:p-7">
          <div className="max-w-7xl mx-auto w-full animate-fade-up">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
