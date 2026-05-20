import type { RiskLevel } from '@page-dep-map/shared';
import { cn } from '@/lib/utils';

interface ScoreBarProps {
  score: number;
  riskLevel: RiskLevel;
  maxScore?: number;
  showValue?: boolean;
  className?: string;
}

const BAR_COLORS: Record<RiskLevel, string> = {
  healthy: 'bg-green-500',
  moderate: 'bg-yellow-500',
  warning: 'bg-orange-500',
  critical: 'bg-red-500',
};

export function ScoreBar({
  score,
  riskLevel,
  maxScore = 100,
  showValue = true,
  className,
}: ScoreBarProps) {
  const pct = Math.min((score / maxScore) * 100, 100);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-2 flex-1 rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all', BAR_COLORS[riskLevel])}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showValue && (
        <span className="w-8 text-right text-xs font-medium tabular-nums">{score}</span>
      )}
    </div>
  );
}
