import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: number;
  changeLabel?: string;
  description?: string;
  iconColor?: string;
  iconBg?: string;
  gradient?: string;
  loading?: boolean;
}

export function StatCard({
  title, value, icon: Icon, change, changeLabel, description,
  iconColor = 'text-indigo-500',
  iconBg,
  gradient = 'from-indigo-500 to-violet-500',
  loading = false,
}: StatCardProps) {
  const isPositive = change !== undefined && change >= 0;

  if (loading) {
    return (
      <div className="rounded-2xl p-5 shimmer-loading" style={{
        background: '#f8faff',
        border: '1px solid #E2E8F0',
        minHeight: '120px',
      }}>
        <div className="animate-pulse space-y-3">
          <div className="h-3 bg-slate-200 rounded w-1/2" />
          <div className="h-7 bg-slate-200 rounded w-3/4" />
          <div className="h-2 bg-slate-200 rounded w-1/3" />
        </div>
      </div>
    );
  }

  return (
    <div className="group relative rounded-2xl p-5 card-hover overflow-hidden" style={{
      background: '#FFFFFF',
      border: '1px solid #E2E8F0',
      boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 4px 16px rgba(99,102,241,0.06)',
    }}>
      {/* Gradient accent top line */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${gradient} opacity-70 group-hover:opacity-100 transition-opacity`} />

      {/* Soft background glow on hover */}
      <div className={`absolute -top-8 -right-8 h-24 w-24 rounded-full bg-gradient-to-br ${gradient} opacity-[0.04] group-hover:opacity-[0.08] blur-xl transition-opacity`} />

      <div className="relative flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 truncate">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 animate-count-up">{value}</p>

          {change !== undefined && (
            <div className="mt-2 flex items-center gap-1">
              {isPositive
                ? <TrendingUp  className="h-3 w-3 text-emerald-500" />
                : <TrendingDown className="h-3 w-3 text-rose-500" />}
              <span className={cn('text-[11px] font-semibold', isPositive ? 'text-emerald-600' : 'text-rose-600')}>
                {isPositive ? '+' : ''}{change}%
              </span>
              {changeLabel && <span className="text-[11px] text-slate-400">{changeLabel}</span>}
            </div>
          )}
          {description && <p className="mt-1 text-[11px] text-slate-400">{description}</p>}
        </div>

        {/* Icon */}
        <div className={cn(
          'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110'
        )} style={{
          background: iconBg || 'linear-gradient(135deg, #EEF2FF, #F5F3FF)',
          border: '1px solid #E0E7FF',
        }}>
          <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${gradient} opacity-[0.08] group-hover:opacity-[0.15] transition-opacity`} />
          <Icon className={cn('h-5 w-5 relative', iconColor)} />
        </div>
      </div>
    </div>
  );
}
