import type { RiskLevel } from '@page-dep-map/shared';
import { cn } from '@/lib/utils';
import { RISK_COLORS, RISK_DARK_COLORS } from '@/lib/colors';

interface RiskBadgeProps {
  level: RiskLevel;
  className?: string;
}

export function RiskBadge({ level, className }: RiskBadgeProps) {
  const light = RISK_COLORS[level];
  const dark = RISK_DARK_COLORS[level];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize',
        light.bg, light.text, light.border,
        dark.bg, dark.text, dark.border,
        className,
      )}
    >
      {level}
    </span>
  );
}
