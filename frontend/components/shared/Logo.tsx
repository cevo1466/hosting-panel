import { cn } from '@/lib/utils';

interface LogoProps {
  size?: number;
  className?: string;
  animated?: boolean;
}

export function LogoMark({ size = 36, className, animated = false }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(animated && 'animate-float', className)}
    >
      <defs>
        <linearGradient id="logoGrad1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
        <linearGradient id="logoGrad2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
        <linearGradient id="logoGrad3" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6366F1" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.05" />
        </linearGradient>
        <filter id="logoGlow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Background rounded square */}
      <rect width="40" height="40" rx="10" fill="url(#logoGrad1)" />

      {/* Inner glow */}
      <rect width="40" height="40" rx="10" fill="white" fillOpacity="0.06" />

      {/* Server rack — top bar */}
      <rect x="8" y="10" width="24" height="6" rx="2" fill="white" fillOpacity="0.95" />
      <circle cx="28" cy="13" r="1.5" fill="#06B6D4" />
      <circle cx="24" cy="13" r="1" fill="white" fillOpacity="0.4" />
      <rect x="10" y="12" width="8" height="2" rx="1" fill="white" fillOpacity="0.3" />

      {/* Server rack — middle bar */}
      <rect x="8" y="19" width="24" height="6" rx="2" fill="white" fillOpacity="0.75" />
      <circle cx="28" cy="22" r="1.5" fill="#4ADE80" />
      <circle cx="24" cy="22" r="1" fill="white" fillOpacity="0.4" />
      <rect x="10" y="21" width="6" height="2" rx="1" fill="white" fillOpacity="0.3" />

      {/* Server rack — bottom bar */}
      <rect x="8" y="28" width="24" height="4" rx="2" fill="white" fillOpacity="0.5" />
      <circle cx="28" cy="30" r="1" fill="#F59E0B" />

      {/* Top shine */}
      <rect x="8" y="10" width="24" height="2" rx="1" fill="white" fillOpacity="0.2" />
    </svg>
  );
}

export function LogoFull({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LogoMark size={34} animated />
      <div>
        <p className="text-sm font-bold leading-none text-gradient tracking-tight">HostPanel</p>
        <p className="text-[9px] text-slate-400 mt-0.5 tracking-[0.15em] uppercase font-medium">Enterprise</p>
      </div>
    </div>
  );
}

export function LogoCollapsed({ className }: { className?: string }) {
  return <LogoMark size={34} animated className={className} />;
}
