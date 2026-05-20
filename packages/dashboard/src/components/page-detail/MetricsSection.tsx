import type { PageMetrics } from '@page-dep-map/shared';
import { cn } from '@/lib/utils';
import type { MetricKey } from './LikelyIssuesSection';

interface MetricsSectionProps {
  metrics: PageMetrics;
  highlightedMetric?: MetricKey | null;
}

interface Row {
  key: MetricKey;
  label: string;
  value: number;
  weight: number;
}

export function handleGetMetricRows(m: PageMetrics): Row[] {
  return [
    { label: 'Total Props', key: 'propsCount', value: m.propsCount, weight: 1 },
    { label: 'Required Props', key: 'requiredPropsCount', value: m.requiredPropsCount, weight: 1 },
    { label: 'Optional Props', key: 'optionalPropsCount', value: m.optionalPropsCount, weight: 0 },
    { label: 'Query Count', key: 'queryCount', value: m.queryCount, weight: 2 },
    { label: 'Store Usages', key: 'storeUsageCount', value: m.storeUsageCount, weight: 2 },
    { label: 'Context Usages', key: 'contextUsageCount', value: m.contextUsageCount, weight: 2 },
    { label: 'Hook Count', key: 'hookCount', value: m.hookCount, weight: 1 },
    { label: 'Effect Count', key: 'effectCount', value: m.effectCount, weight: 3 },
    {
      label: 'Conditional Branches',
      key: 'conditionalBranchCount',
      value: m.conditionalBranchCount,
      weight: 1,
    },
    { label: 'Child Components', key: 'childComponentCount', value: m.childComponentCount, weight: 1 },
    { label: 'Component Tree Depth', key: 'componentTreeDepth', value: m.componentTreeDepth, weight: 0 },
    { label: 'Max Drilling Depth', key: 'maxDrillingDepth', value: m.maxDrillingDepth, weight: 3 },
    {
      label: 'Pass-Through Props',
      key: 'passThroughPropsCount',
      value: m.passThroughPropsCount,
      weight: 3,
    },
    { label: 'Derived Data Props', key: 'derivedDataPropCount', value: m.derivedDataPropCount, weight: 2 },
    {
      label: 'Shared Dependencies',
      key: 'sharedDependencyCount',
      value: m.sharedDependencyCount,
      weight: 1,
    },
  ];
}

/**
 * Responsive metric card grid (2/3/4 cols).
 * Each card carries `id="metric-<key>"` so {@link LikelyIssuesSection}
 * chips can `scrollIntoView` and toggle a transient ring highlight.
 */
export function MetricsSection({ metrics, highlightedMetric }: MetricsSectionProps) {
  const rows = handleGetMetricRows(metrics);

  return (
    <section className="rounded-lg border bg-card p-6">
      <h2 className="text-lg font-semibold">Metrics</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Cards with a primary stripe carry a scoring weight of 2 or higher.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {rows.map((row) => {
          const isHighlighted = highlightedMetric === row.key;
          return (
            <div
              key={row.key}
              id={`metric-${row.key}`}
              className={cn(
                'group scroll-mt-24 rounded-md border bg-card p-3 transition-all duration-300',
                'hover:border-foreground/30 hover:shadow-sm',
                row.weight >= 2 && 'border-l-2 border-l-primary',
                isHighlighted &&
                  'scale-[1.02] ring-2 ring-primary ring-offset-2 ring-offset-background',
              )}
            >
              <p className="text-xs text-muted-foreground">{row.label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums leading-none">{row.value}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
