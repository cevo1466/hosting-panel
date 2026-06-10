'use client';

import Link from 'next/link';
import { Server, ArrowLeft, Construction } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#010103] flex flex-col items-center justify-center relative overflow-hidden px-4 selection:bg-primary/30 selection:text-primary">
      {/* Background glowing mesh */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[30%] left-[20%] w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle_at_center,rgba(94,106,210,0.1)_0%,rgba(0,0,0,0)_60%)] blur-[80px]" />
        <div className="absolute bottom-[30%] right-[20%] w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.06)_0%,rgba(0,0,0,0)_60%)] blur-[80px]" />
      </div>

      <div className="z-10 text-center max-w-md space-y-6">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-cyan-400 p-[1.5px] shadow-[0_0_30px_rgba(94,106,210,0.2)]">
          <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-[#0c0d12]">
            <Construction className="h-6 w-6 text-cyan-400 animate-bounce" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight text-white bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Sayfa Hazırlanıyor
          </h1>
          <p className="text-[#8a8f98] text-sm leading-relaxed">
            Bu modül şu an arka planda geliştirilme aşamasındadır. Premium tasarım yönergelerimiz doğrultusunda en kısa sürede aktif edilecektir.
          </p>
        </div>

        <div className="pt-4">
          <Link href="/dashboard" passHref>
            <Button className="bg-gradient-to-r from-primary to-[#828fff] hover:from-[#828fff] hover:to-[#5e6ad2] text-white flex items-center gap-2 rounded-xl py-5 px-6 mx-auto hover:shadow-[0_0_20px_rgba(94,106,210,0.3)]">
              <ArrowLeft className="h-4 w-4" />
              Kontrol Paneline Dön
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
