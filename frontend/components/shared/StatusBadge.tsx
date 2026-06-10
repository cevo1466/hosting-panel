import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig: Record<string, { label: string; variant: 'success' | 'error' | 'warning' | 'info' | 'secondary' }> = {
  active: { label: 'Aktif', variant: 'success' },
  running: { label: 'Çalışıyor', variant: 'success' },
  completed: { label: 'Tamamlandı', variant: 'success' },
  success: { label: 'Başarılı', variant: 'success' },
  inactive: { label: 'Pasif', variant: 'secondary' },
  stopped: { label: 'Durduruldu', variant: 'secondary' },
  disabled: { label: 'Devre Dışı', variant: 'secondary' },
  suspended: { label: 'Askıya Alındı', variant: 'error' },
  failed: { label: 'Başarısız', variant: 'error' },
  error: { label: 'Hata', variant: 'error' },
  expired: { label: 'Süresi Dolmuş', variant: 'error' },
  revoked: { label: 'İptal Edildi', variant: 'error' },
  pending: { label: 'Beklemede', variant: 'warning' },
  scheduled: { label: 'Zamanlanmış', variant: 'warning' },
  installing: { label: 'Yükleniyor', variant: 'info' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status.toLowerCase()] || { label: status, variant: 'secondary' as const };

  return (
    <Badge variant={config.variant} className={cn('capitalize', className)}>
      <span className={cn(
        'mr-1.5 h-1.5 w-1.5 rounded-full inline-block',
        config.variant === 'success' && 'bg-emerald-500',
        config.variant === 'error' && 'bg-red-500',
        config.variant === 'warning' && 'bg-yellow-500',
        config.variant === 'info' && 'bg-blue-500',
        config.variant === 'secondary' && 'bg-slate-400',
      )} />
      {config.label}
    </Badge>
  );
}
