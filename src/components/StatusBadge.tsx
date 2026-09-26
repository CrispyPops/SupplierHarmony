import { Badge } from '@/components/ui/badge';
import { ExpiryStatus } from '@/lib/types';
import { getStatusLabel } from '@/lib/expiryUtils';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: ExpiryStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        'font-medium text-xs rounded-full px-2.5 py-0.5 border-0',
        status === 'valid' && 'status-valid',
        status === 'expiring' && 'status-expiring',
        status === 'expired' && 'status-expired',
        status === 'na' && 'status-na',
        className
      )}
    >
      {getStatusLabel(status)}
    </Badge>
  );
}
