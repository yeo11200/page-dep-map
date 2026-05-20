import type { RiskLevel } from '@page-dep-map/shared';
import { cn } from '@/lib/utils';
import { RISK_COLORS, RISK_DARK_COLORS } from '@/lib/colors';

const RISK_LEVELS: RiskLevel[] = ['healthy', 'moderate', 'warning', 'critical'];

interface PageTableFiltersProps {
  selected: RiskLevel[];
  onChange: (levels: RiskLevel[]) => void;
}

export function PageTableFilters({ selected, onChange }: PageTableFiltersProps) {
  function toggle(level: RiskLevel) {
    if (selected.includes(level)) {
      onChange(selected.filter((l) => l !== level));
    } else {
      onChange([...selected, level]);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Risk:</span>
      {RISK_LEVELS.map((level) => {
        const isActive = selected.includes(level);
        const light = RISK_COLORS[level];
        const dark = RISK_DARK_COLORS[level];
        return (
          <button
            key={level}
            onClick={() => toggle(level)}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize transition-colors',
              isActive
                ? cn(light.bg, light.text, light.border, dark.bg, dark.text, dark.border)
                : 'border-border text-muted-foreground hover:bg-accent',
            )}
          >
            {level}
          </button>
        );
      })}
    </div>
  );
}
