'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Server, Loader2 } from 'lucide-react';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    // Instantly forward to login
    const timer = setTimeout(() => {
      router.push('/login');
    }, 1000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-[#010103] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background glowing mesh */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[35%] left-[25%] w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle_at_center,rgba(94,106,210,0.15)_0%,rgba(0,0,0,0)_60%)] blur-[80px]" />
      </div>

      <div className="z-10 flex flex-col items-center space-y-4 animate-pulse">
        <div className="h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-cyan-400 p-[1.5px] shadow-[0_0_30px_rgba(94,106,210,0.25)] flex">
          <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-[#0c0d12]">
            <Server className="h-7 w-7 text-cyan-400" />
          </div>
        </div>
        <div className="flex items-center gap-2 text-[#8a8f98] text-sm">
          <Loader2 className="h-4.5 w-4.5 animate-spin text-cyan-400" />
          <span>HostPanel yükleniyor...</span>
        </div>
      </div>
    </div>
  );
}
