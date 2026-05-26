import { Link } from 'react-router-dom';
import { useApiIndex } from '@/api/queries';
import type { ApiEndpoint } from '@page-dep-map/shared';

const METHOD_STYLES: Record<string, string> = {
  GET: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  POST: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  PUT: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  PATCH: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  DELETE: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
};

function encodeId(id: string) {
  // Make the endpoint id URL-safe for routing.
  return encodeURIComponent(id);
}

function MethodBadge({ method }: { method: string }) {
  const cls = METHOD_STYLES[method] ?? 'bg-muted text-muted-foreground';
  return (
    <span
      className={`inline-flex min-w-[3.5rem] justify-center rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase ${cls}`}
    >
      {method}
    </span>
  );
}

export function ApiListPage() {
  const { data, isLoading, error } = useApiIndex();

  if (isLoading) {
    return <div className="text-muted-foreground">Loading API index…</div>;
  }
  if (error || !data) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">API index not available.</p>
        <p className="mt-1">
          Re-run <code className="font-mono">page-dep-map analyze</code> with a
          version that emits <code className="font-mono">api-index.json</code>{' '}
          (≥ 0.2.0).
        </p>
      </div>
    );
  }

  const { endpoints, stats, unresolved } = data;

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">APIs</h1>
        <p className="text-sm text-muted-foreground">
          {stats.totalEndpoints} endpoints · {stats.hotEndpoints} hot ·{' '}
          {stats.deadEndpoints} dead · {stats.uncategorized} unresolved
        </p>
      </header>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-[5.5rem] px-4 py-2.5">Method</th>
              <th className="px-4 py-2.5">Path</th>
              <th className="w-24 px-4 py-2.5 text-right">References</th>
              <th className="w-32 px-4 py-2.5">Pages</th>
              <th className="w-28 px-4 py-2.5">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {endpoints.map((ep: ApiEndpoint) => (
              <tr key={ep.id} className="border-b last:border-b-0 hover:bg-muted/40">
                <td className="px-4 py-2.5">
                  <MethodBadge method={ep.method} />
                </td>
                <td className="px-4 py-2.5 font-mono">
                  <Link
                    to={`/apis/${encodeId(ep.id)}`}
                    className="text-foreground hover:underline"
                  >
                    {ep.path}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {ep.referenceCount}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {ep.pages.length}
                </td>
                <td className="px-4 py-2.5">
                  <ConfidenceDot confidence={ep.topConfidence} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {unresolved.length > 0 && (
        <section className="rounded-lg border border-dashed p-4">
          <h2 className="text-sm font-semibold">
            Unresolved call sites ({unresolved.length})
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            These calls were detected but could not be statically resolved to
            an endpoint (computed URLs, generic clients, etc.).
          </p>
        </section>
      )}
    </div>
  );
}

function ConfidenceDot({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  const color =
    confidence === 'high'
      ? 'bg-emerald-500'
      : confidence === 'medium'
        ? 'bg-amber-500'
        : 'bg-muted-foreground/50';
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {confidence}
    </span>
  );
}
