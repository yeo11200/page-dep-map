import type { PageMetrics } from '@page-dep-map/shared';
import { DEFAULT_WEIGHTS } from '@page-dep-map/shared/constants';
import { cn } from '@/lib/utils';

interface ScoreBreakdownProps {
  metrics: PageMetrics;
  /** Max top contributors to render. */
  topN?: number;
  className?: string;
}

export interface ScoreContribution {
  key: keyof PageMetrics;
  label: string;
  value: number;
  weight: number;
  contribution: number;
}

const SCORE_BREAKDOWN_WEIGHTS = {
  propsCount: DEFAULT_WEIGHTS.propsCount,
  requiredPropsCount: DEFAULT_WEIGHTS.requiredPropsCount,
  maxDrillingDepth: DEFAULT_WEIGHTS.maxDrillingDepth,
  passThroughPropsCount: DEFAULT_WEIGHTS.passThroughPropsCount,
  hookCount: DEFAULT_WEIGHTS.hookCount,
  queryCount: DEFAULT_WEIGHTS.queryCount,
  storeUsageCount: DEFAULT_WEIGHTS.storeContextUsageCount,
  contextUsageCount: DEFAULT_WEIGHTS.storeContextUsageCount,
  effectCount: DEFAULT_WEIGHTS.effectCount,
  conditionalBranchCount: DEFAULT_WEIGHTS.conditionalBranchCount,
  childComponentCount: DEFAULT_WEIGHTS.childComponentCount,
  derivedDataPropCount: DEFAULT_WEIGHTS.derivedDataPropCount,
  sharedDependencyCount: DEFAULT_WEIGHTS.sharedDependencyCount,
} as const satisfies Partial<Record<keyof PageMetrics, number>>;

const SCORE_BREAKDOWN_LABELS: Record<keyof typeof SCORE_BREAKDOWN_WEIGHTS, string> = {
  propsCount: 'props',
  requiredPropsCount: 'required props',
  maxDrillingDepth: 'drilling depth',
  passThroughPropsCount: 'pass-through',
  hookCount: 'hooks',
  queryCount: 'queries',
  storeUsageCount: 'stores',
  contextUsageCount: 'contexts',
  effectCount: 'effects',
  conditionalBranchCount: 'conditionals',
  childComponentCount: 'children',
  derivedDataPropCount: 'derived',
  sharedDependencyCount: 'shared deps',
};

export function handleGetScoreContributions(metrics: PageMetrics, topN = 5): ScoreContribution[] {
  return Object.entries(SCORE_BREAKDOWN_WEIGHTS)
    .map(([key, weight]) => {
      const metricKey = key as keyof typeof SCORE_BREAKDOWN_WEIGHTS;
      const value = metrics[metricKey];

      return {
        key: metricKey,
        label: SCORE_BREAKDOWN_LABELS[metricKey],
        value,
        weight,
        contribution: value * weight,
      };
    })
    .filter((row) => row.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, topN);
}

/**
 * Visual breakdown of complexity-score contributions per metric.
 * Renders top-N rows by points (descending); rows with 0 contribution are hidden.
 * Bar width is proportional to the largest contributor.
 */
export function ScoreBreakdown({ metrics, topN = 5, className }: ScoreBreakdownProps) {
  const top = handleGetScoreContributions(metrics, topN);
  const maxContribution = top.length > 0 ? top[0].contribution : 1;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Top contributors</h3>
        <span className="text-xs text-muted-foreground">Score breakdown</span>
      </div>

      {top.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No metric is contributing to the score yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {top.map((row) => {
            const pct = (row.contribution / maxContribution) * 100;

            return (
              <li
                key={row.key}
                className="grid grid-cols-[7rem_minmax(0,1fr)_6.5rem] items-center gap-3"
              >
                <div className="min-w-0 truncate text-xs font-medium" title={row.label}>
                  {row.label}
                </div>
                <div className="h-2 rounded-full bg-primary/30" role="presentation">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.max(pct, 3)}%` }}
                  />
                </div>
                <div className="text-right text-xs font-medium tabular-nums text-muted-foreground">
                  <span className="font-semibold text-foreground">{row.value}</span> x {row.weight}{' '}
                  = {row.contribution}pt
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
