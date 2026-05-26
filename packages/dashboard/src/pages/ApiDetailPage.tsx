import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApiIndex } from '@/api/queries';
import type { ApiCallSite } from '@page-dep-map/shared';

function decodeId(slug: string | undefined) {
  return slug ? decodeURIComponent(slug) : '';
}

export function ApiDetailPage() {
  const { id } = useParams<{ id: string }>();
  const decoded = decodeId(id);
  const { data, isLoading, error } = useApiIndex();

  const endpoint = useMemo(() => {
    if (!data) return null;
    return data.endpoints.find((e) => e.id === decoded) ?? null;
  }, [data, decoded]);

  if (isLoading) {
    return <div className="text-muted-foreground">Loading…</div>;
  }
  if (error || !data) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        API index not available.
      </div>
    );
  }
  if (!endpoint) {
    return (
      <div className="space-y-2">
        <Link to="/apis" className="text-sm text-muted-foreground hover:underline">
          ← Back to API list
        </Link>
        <div className="rounded-lg border border-dashed p-6">
          <p className="font-semibold">Endpoint not found.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            <code className="font-mono">{decoded}</code> does not appear in
            the index. It may have been removed since the last analysis.
          </p>
        </div>
      </div>
    );
  }

  // Group call sites by page so the tree reads naturally:
  //   Page A
  //    ├─ component a (line)
  //    └─ component b (line)
  //   Page B
  //    └─ ...
  const grouped = new Map<string, ApiCallSite[]>();
  for (const site of endpoint.callSites) {
    const list = grouped.get(site.pageName) ?? [];
    list.push(site);
    grouped.set(site.pageName, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/apis" className="text-sm text-muted-foreground hover:underline">
          ← Back to API list
        </Link>
        <h1 className="mt-2 font-mono text-2xl font-semibold">
          <span className="mr-3 text-rose-500">{endpoint.method}</span>
          {endpoint.path}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {endpoint.referenceCount} call site
          {endpoint.referenceCount === 1 ? '' : 's'} across{' '}
          {endpoint.pages.length} page
          {endpoint.pages.length === 1 ? '' : 's'} · top confidence:{' '}
          {endpoint.topConfidence}
        </p>
      </div>

      <div className="space-y-4">
        {[...grouped.entries()].map(([pageName, sites]) => (
          <section
            key={pageName}
            className="overflow-hidden rounded-lg border bg-card"
          >
            <header className="flex items-baseline justify-between border-b bg-muted/30 px-4 py-2.5">
              <Link
                to={`/pages/${encodeURIComponent(pageName)}`}
                className="font-mono text-sm font-semibold hover:underline"
              >
                {pageName}
              </Link>
              <span className="font-mono text-xs text-muted-foreground">
                {sites[0]?.pageFilePath}
              </span>
            </header>
            <ul className="divide-y">
              {sites.map((site, i) => (
                <li key={i} className="flex items-baseline gap-3 px-4 py-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {site.callShape}
                  </span>
                  <span className="flex-1 font-mono text-sm">
                    {site.componentName}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {site.filePath}:{site.line}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
