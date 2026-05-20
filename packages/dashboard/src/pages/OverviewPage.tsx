import { useSummary, usePages } from '@/api/queries';
import { StatGrid } from '@/components/overview/StatGrid';
import { RiskDistribution } from '@/components/overview/RiskDistribution';
import { TopRiskPages } from '@/components/overview/TopRiskPages';
import { EmptyState } from '@/components/shared/EmptyState';

export function OverviewPage() {
  const { data: summary, isLoading: summaryLoading, error: summaryError } = useSummary();
  const { data: pages, isLoading: pagesLoading, error: pagesError } = usePages();

  const isLoading = summaryLoading || pagesLoading;
  const error = summaryError || pagesError;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Overview</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-80 animate-pulse rounded-lg bg-muted" />
          <div className="h-80 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Overview</h1>
        <EmptyState
          title="Failed to load data"
          description={error.message}
          action={
            <button
              onClick={() => window.location.reload()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Retry
            </button>
          }
        />
      </div>
    );
  }

  if (!summary || !pages) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Overview</h1>
        <EmptyState
          title="No analysis data"
          description="Run the analyzer first to generate page dependency data."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-xs text-muted-foreground">
          Updated {new Date(summary.updatedAt).toLocaleString()}
        </p>
      </div>
      <StatGrid summary={summary} />
      <div className="grid gap-4 lg:grid-cols-2">
        <RiskDistribution pages={pages} />
        <TopRiskPages pages={pages} />
      </div>
    </div>
  );
}
