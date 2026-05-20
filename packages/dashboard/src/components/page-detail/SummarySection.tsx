import type { PageDetail } from '@page-dep-map/shared';

interface SummarySectionProps {
  detail: PageDetail;
}

/**
 * Compact location summary — file path and route path only.
 * Risk level / score / gauge live in {@link PageHeroSection}.
 */
export function SummarySection({ detail }: SummarySectionProps) {
  return (
    <section className="rounded-lg border bg-card px-5 py-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            File Path
          </p>
          <p className="mt-0.5 truncate text-sm font-mono" title={detail.filePath}>
            {detail.filePath}
          </p>
        </div>
        {detail.routePath && (
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Route Path
            </p>
            <p className="mt-0.5 truncate text-sm font-mono" title={detail.routePath}>
              {detail.routePath}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
