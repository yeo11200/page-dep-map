import type { RuleSeverity } from '@page-dep-map/shared';
import { cn } from '@/lib/utils';
import { SEVERITY_COLORS } from '@/lib/colors';

interface SeverityBadgeProps {
  severity: RuleSeverity;
  className?: string;
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const colors = SEVERITY_COLORS[severity];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize',
        colors.bg, colors.text, colors.border,
        className,
      )}
    >
      {severity}
    </span>
  );
}
