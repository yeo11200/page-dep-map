import { useNavigate } from 'react-router-dom';
import type { PageSummary } from '@page-dep-map/shared';
import { toFileSlug } from '@/lib/utils';
import { RiskBadge } from '@/components/shared/RiskBadge';
import { ScoreBar } from '@/components/shared/ScoreBar';

interface TopRiskPagesProps {
  pages: PageSummary[];
}

export function TopRiskPages({ pages }: TopRiskPagesProps) {
  const navigate = useNavigate();
  const topPages = [...pages]
    .sort((a, b) => b.complexityScore - a.complexityScore)
    .slice(0, 5);

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="text-sm font-medium text-muted-foreground">Top Risk Pages</h3>
      <div className="mt-4 space-y-3">
        {topPages.map((page) => (
          <button
            key={page.pageName}
            onClick={() => navigate(`/pages/${toFileSlug(page.pageName)}`)}
            className="flex w-full items-center gap-4 rounded-md p-3 text-left transition-colors hover:bg-accent"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{page.pageName}</p>
              <p className="truncate text-xs text-muted-foreground">{page.filePath}</p>
            </div>
            <ScoreBar
              score={page.complexityScore}
              riskLevel={page.riskLevel}
              className="w-32"
            />
            <RiskBadge level={page.riskLevel} />
          </button>
        ))}
      </div>
    </div>
  );
}
