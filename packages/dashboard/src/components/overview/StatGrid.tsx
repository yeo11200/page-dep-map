import type { ProjectSummary } from '@page-dep-map/shared';

interface StatGridProps {
  summary: ProjectSummary;
}

interface StatCardProps {
  label: string;
  value: string | number;
  description: string;
}

function StatCard({ label, value, description }: StatCardProps) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

export function StatGrid({ summary }: StatGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Total Pages"
        value={summary.totalPages}
        description="Pages analyzed in this project"
      />
      <StatCard
        label="Avg Complexity"
        value={summary.avgComplexityScore.toFixed(1)}
        description="Average complexity score across all pages"
      />
      <StatCard
        label="Critical Pages"
        value={summary.criticalPages}
        description="Pages with critical risk level"
      />
      <StatCard
        label="Warning Pages"
        value={summary.warningPages}
        description="Pages with warning risk level"
      />
    </div>
  );
}
