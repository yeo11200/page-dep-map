import type { PageDetail, PageMetrics, RiskLevel } from '@page-dep-map/shared';
import { RiskBadge } from '@/components/shared/RiskBadge';
import { ScoreBar } from '@/components/shared/ScoreBar';
import { ScoreBreakdown } from './ScoreBreakdown';
import { cn } from '@/lib/utils';
import { RISK_COLORS, RISK_DARK_COLORS } from '@/lib/colors';

interface PageHeroSectionProps {
  detail: PageDetail;
  onBackToPages?: () => void;
}

const RISK_SCORE_TEXT: Record<RiskLevel, string> = {
  healthy: 'text-green-600 dark:text-green-400',
  moderate: 'text-yellow-600 dark:text-yellow-400',
  warning: 'text-orange-600 dark:text-orange-400',
  critical: 'text-red-600 dark:text-red-400',
};

interface KpiStat {
  label: string;
  value: number;
}

function buildKpiBar(metrics: PageMetrics): KpiStat[] {
  return [
    { label: 'Props', value: metrics.propsCount },
    { label: 'Hooks', value: metrics.hookCount },
    { label: 'Queries', value: metrics.queryCount },
    { label: 'Depth', value: metrics.maxDrillingDepth },
  ];
}

/**
 * Hero zone for the page-detail screen.
 * Header: back affordance + page name + file/route paths.
 * Left: oversized complexity score + RiskBadge + ScoreBar.
 * Right: ScoreBreakdown top contributors.
 * Footer: inline KPI bar (Props · Hooks · Queries · Depth).
 */
export function PageHeroSection({ detail, onBackToPages }: PageHeroSectionProps) {
  const { metrics } = detail;
  const score = metrics.complexityScore;
  const risk = metrics.riskLevel;
  const lightColor = RISK_COLORS[risk];
  const darkColor = RISK_DARK_COLORS[risk];
  const kpis = buildKpiBar(metrics);

  return (
    <section
      className={cn(
        'rounded-xl border-2 p-6 sm:p-8',
        lightColor.bg,
        lightColor.border,
        darkColor.bg,
        darkColor.border,
      )}
    >
      <header className="mb-6">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          {onBackToPages && (
            <button
              type="button"
              onClick={onBackToPages}
              className="shrink-0 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              &larr; Pages
            </button>
          )}
          <h1 className="min-w-0 truncate text-2xl font-bold sm:text-3xl">{detail.pageName}</h1>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-mono text-muted-foreground">
          <span className="truncate" title={detail.filePath}>
            {detail.filePath}
          </span>
          {detail.routePath && (
            <>
              <span aria-hidden>·</span>
              <span className="truncate" title={detail.routePath}>
                {detail.routePath}
              </span>
            </>
          )}
        </div>
      </header>

      <div className="grid gap-6 border-y py-6 dark:border-foreground/10 lg:grid-cols-[minmax(12rem,0.8fr)_minmax(0,1.6fr)] lg:gap-10">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={cn(
                'text-5xl font-bold tabular-nums leading-none',
                RISK_SCORE_TEXT[risk],
              )}
            >
              {score}
            </span>
            <RiskBadge level={risk} className="px-3 py-1 text-sm" />
          </div>

          <ScoreBar score={score} riskLevel={risk} showValue={false} className="max-w-64" />
        </div>

        <div className="min-w-0">
          <div className="mb-3 text-sm font-semibold capitalize">Risk: {risk}</div>
          <ScoreBreakdown metrics={metrics} topN={5} />
        </div>
      </div>

      <footer className="pt-4">
        <dl className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {kpis.map((kpi, i) => (
            <div key={kpi.label} className="flex items-center gap-3">
              {i > 0 && <span aria-hidden>·</span>}
              <div className="flex items-baseline gap-1.5">
                <dt>{kpi.label}</dt>
                <dd className="font-semibold text-foreground tabular-nums">{kpi.value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </footer>
    </section>
  );
}
