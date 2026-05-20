import type { LikelyIssue, PageMetrics } from '@page-dep-map/shared';
import { SeverityBadge } from '@/components/shared/SeverityBadge';

/** Metric keys used as DOM ids in MetricsSection (id="metric-<key>"). */
export type MetricKey =
  | 'propsCount'
  | 'requiredPropsCount'
  | 'optionalPropsCount'
  | 'queryCount'
  | 'storeUsageCount'
  | 'contextUsageCount'
  | 'hookCount'
  | 'effectCount'
  | 'conditionalBranchCount'
  | 'childComponentCount'
  | 'maxDrillingDepth'
  | 'passThroughPropsCount'
  | 'derivedDataPropCount'
  | 'sharedDependencyCount';

interface MetricChip {
  key: MetricKey;
  label: string;
}

export function handleGetIssueMetricChips(issueId: string, metrics: PageMetrics): MetricChip[] {
  switch (issueId) {
    case 'DRILL_DEEP':
      return [{ key: 'maxDrillingDepth', label: `drilling: ${metrics.maxDrillingDepth}` }];
    case 'PASS_THROUGH':
      return [
        { key: 'passThroughPropsCount', label: `pass-through: ${metrics.passThroughPropsCount}` },
      ];
    case 'EFFECT_HEAVY':
      return [{ key: 'effectCount', label: `effects: ${metrics.effectCount}` }];
    case 'DATA_ORCHESTRATOR':
      return [
        { key: 'queryCount', label: `queries: ${metrics.queryCount}` },
        { key: 'childComponentCount', label: `children: ${metrics.childComponentCount}` },
      ];
    case 'DERIVED_HEAVY':
      return [{ key: 'derivedDataPropCount', label: `derived: ${metrics.derivedDataPropCount}` }];
    case 'SHARED_HEAVY':
      return [
        { key: 'sharedDependencyCount', label: `shared: ${metrics.sharedDependencyCount}` },
      ];
    case 'MANY_PROPS':
      return [{ key: 'propsCount', label: `props: ${metrics.propsCount}` }];
    case 'MANY_REQUIRED':
      return [{ key: 'requiredPropsCount', label: `required: ${metrics.requiredPropsCount}` }];
    case 'MANY_CONDITIONS':
      return [
        {
          key: 'conditionalBranchCount',
          label: `conditions: ${metrics.conditionalBranchCount}`,
        },
      ];
    case 'EFFECT_NO_QUERY':
      return [
        { key: 'effectCount', label: `effects: ${metrics.effectCount}` },
        { key: 'queryCount', label: `queries: ${metrics.queryCount}` },
      ];
    case 'STORE_AND_PROPS':
      return [
        { key: 'storeUsageCount', label: `stores: ${metrics.storeUsageCount}` },
        { key: 'propsCount', label: `props: ${metrics.propsCount}` },
      ];
    default:
      return [];
  }
}

interface LikelyIssuesSectionProps {
  issues: LikelyIssue[];
  /** Used to surface the actual metric count next to each chip. */
  metrics: PageMetrics;
  onMetricClick?: (key: MetricKey) => void;
}

export function LikelyIssuesSection({
  issues,
  metrics,
  onMetricClick,
}: LikelyIssuesSectionProps) {
  if (issues.length === 0) {
    return (
      <section className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Likely Issues</h2>
        <p className="mt-2 text-sm text-muted-foreground">No structural issues detected.</p>
      </section>
    );
  }

  const sorted = [...issues].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  return (
    <section className="rounded-lg border bg-card p-6">
      <h2 className="text-lg font-semibold">
        Likely Issues{' '}
        <span className="text-sm font-normal text-muted-foreground">({issues.length})</span>
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Click a metric chip to jump to its card below.
      </p>
      <div className="mt-4 space-y-3">
        {sorted.map((issue) => {
          const metricChips = handleGetIssueMetricChips(issue.id, metrics);
          return (
            <div
              key={issue.id}
              className="flex items-start gap-3 rounded-md border p-3 transition-colors hover:bg-muted/30"
            >
              <SeverityBadge severity={issue.severity} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-mono font-medium text-muted-foreground">
                  {issue.id}
                </p>
                <p className="mt-0.5 text-sm">{issue.message}</p>
                {metricChips.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {metricChips.map(({ key, label }) => {
                      return (
                        <a
                          key={key}
                          href={`#metric-${key}`}
                          onClick={() => onMetricClick?.(key)}
                          className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs font-mono hover:bg-accent"
                        >
                          {label}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
