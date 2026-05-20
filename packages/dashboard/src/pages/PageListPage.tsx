import { usePages } from '@/api/queries';
import { PageTable } from '@/components/page-list/PageTable';
import { EmptyState } from '@/components/shared/EmptyState';

export function PageListPage() {
  const { data: pages, isLoading, error } = usePages();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Pages</h1>
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Pages</h1>
        <EmptyState
          title="Failed to load pages"
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

  if (!pages || pages.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Pages</h1>
        <EmptyState
          title="No pages found"
          description="Run the analyzer to generate page dependency data."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Pages</h1>
      <PageTable data={pages} />
    </div>
  );
}
