import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApiIndex } from '@/api/queries';
import type {
  ApiCallSite,
  ApiConsumerEntry,
  ApiEndpoint,
} from '@page-dep-map/shared';

const KIND_STYLES: Record<ApiConsumerEntry['kind'], string> = {
  api: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  hook: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  component: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  page: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  unknown: 'bg-muted text-muted-foreground',
};

const IMPACT_STYLES: Record<
  ApiEndpoint['impact'],
  { ring: string; fg: string; bg: string; headline: string }
> = {
  critical: {
    ring: 'ring-rose-500/50',
    fg: 'text-rose-700 dark:text-rose-300',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    headline: 'Critical change risk — coordinate before shipping.',
  },
  high: {
    ring: 'ring-orange-500/50',
    fg: 'text-orange-700 dark:text-orange-300',
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    headline: 'High change risk — multiple consumers affected.',
  },
  medium: {
    ring: 'ring-amber-500/50',
    fg: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    headline: 'Moderate change risk — review consumers before editing.',
  },
  low: {
    ring: 'ring-emerald-500/40',
    fg: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    headline: 'Low change risk — narrow blast radius.',
  },
};

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
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>
            {endpoint.referenceCount} call site
            {endpoint.referenceCount === 1 ? '' : 's'}
          </span>
          <span>·</span>
          <span>
            {endpoint.pages.length} page
            {endpoint.pages.length === 1 ? '' : 's'}
          </span>
          <span>·</span>
          <span>
            {endpoint.consumerCount} consumer
            {endpoint.consumerCount === 1 ? '' : 's'}
          </span>
          <span>·</span>
          <span>top confidence: {endpoint.topConfidence}</span>
          {endpoint.tier === 'orphan' && (
            <span className="ml-2 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              orphan — no page reaches this
            </span>
          )}
        </p>
      </div>

      <ImpactPanel endpoint={endpoint} />

      {endpoint.consumers.length > 0 && <UsedBySection endpoint={endpoint} />}

      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Call sites by page
        </h2>
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

/**
 * The "한눈에 영향도" panel — bold tier + one-sentence headline +
 * inline breakdown so a BE engineer can decide in 2 seconds whether
 * this endpoint can be changed freely or needs a coordination thread.
 */
function ImpactPanel({ endpoint }: { endpoint: ApiEndpoint }) {
  const s = IMPACT_STYLES[endpoint.impact];
  const b = endpoint.impactBreakdown;
  const segments = [
    { label: 'pages', count: b.pages, color: 'bg-emerald-500' },
    { label: 'hooks', count: b.hooks, color: 'bg-violet-500' },
    { label: 'components', count: b.components, color: 'bg-sky-500' },
  ];
  const segTotal = segments.reduce((a, x) => a + x.count, 0);
  return (
    <section
      className={`space-y-3 rounded-lg p-4 ring-1 ring-inset ${s.bg} ${s.ring}`}
    >
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-3">
          <span
            className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wider ring-1 ring-inset ${s.fg} ${s.ring}`}
          >
            {endpoint.impact}
          </span>
          <p className={`text-sm font-medium ${s.fg}`}>{s.headline}</p>
        </div>
        {b.riskyPages > 0 && (
          <span className="rounded-md bg-rose-500/15 px-2 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-500/40 dark:text-rose-300">
            {b.riskyPages} risky page{b.riskyPages === 1 ? '' : 's'} consume this
          </span>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Editing this endpoint affects{' '}
        <strong className="text-foreground">{b.pages} page{b.pages === 1 ? '' : 's'}</strong>
        {' '}through{' '}
        <strong className="text-foreground">{b.hooks} hook{b.hooks === 1 ? '' : 's'}</strong>
        {' '}and{' '}
        <strong className="text-foreground">{b.components} component{b.components === 1 ? '' : 's'}</strong>
        {' '}({endpoint.directCallers.length} direct caller
        {endpoint.directCallers.length === 1 ? '' : 's'}).
      </p>

      {segTotal > 0 && (
        <div>
          <div className="flex h-2 overflow-hidden rounded-full bg-muted">
            {segments.map((seg) =>
              seg.count > 0 ? (
                <span
                  key={seg.label}
                  className={seg.color}
                  style={{ width: `${(seg.count / segTotal) * 100}%` }}
                  title={`${seg.count} ${seg.label}`}
                />
              ) : null,
            )}
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
            {segments.map((seg) => (
              <span key={seg.label}>
                <span className="font-mono font-semibold text-foreground">
                  {seg.count}
                </span>{' '}
                {seg.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Reverse call-graph view: every FE function/component that reaches
 * this endpoint, grouped by distance (hops) from the API call site.
 * Answers "어디 컴포넌트에 사용중인지" without making the user click
 * through every page detail.
 */
function UsedBySection({
  endpoint,
}: {
  endpoint: { consumers: ApiConsumerEntry[]; directCallers: ApiConsumerEntry[] };
}) {
  // Split the chain into role-based buckets so the page reads as
  // "what actually invokes this" + "render-tree path to a page" rather
  // than a long hop list. Most consumers in a deep React tree are
  // passive wrappers — keep them collapsed by default so the user
  // doesn't think 9 components are each independently using the hook.
  const buckets = useMemo(() => {
    // Direct callers (hop 1) are pre-computed by the analyzer.
    const direct = endpoint.directCallers;
    // Page entry points — clear label, always visible.
    const pages = endpoint.consumers
      .filter((c) => c.kind === 'page')
      .sort((a, b) => a.hops - b.hops);

    // Component consumers — split into "active" (the smallest-hop ones,
    // i.e. the components that actually invoke the hook in their body)
    // and "wrappers" (parent components that just include the active
    // ones in their JSX tree).
    const compConsumers = endpoint.consumers
      .filter((c) => c.kind === 'component')
      .sort((a, b) => a.hops - b.hops);
    const minCompHop = compConsumers[0]?.hops;
    const activeComponents = compConsumers.filter((c) => c.hops === minCompHop);
    const wrappers = compConsumers.filter((c) => c.hops > minCompHop!);

    // Hooks at hop > 1 — additional hook wrappers between the direct
    // caller and the first component. Surface separately so they don't
    // get hidden under "render path".
    const intermediateHooks = endpoint.consumers
      .filter((c) => c.kind === 'hook' && c.hops > 1)
      .sort((a, b) => a.hops - b.hops);

    return { direct, pages, activeComponents, wrappers, intermediateHooks };
  }, [endpoint]);

  const [showWrappers, setShowWrappers] = useState(false);

  const transitiveCount =
    buckets.activeComponents.length +
    buckets.wrappers.length +
    buckets.intermediateHooks.length +
    buckets.pages.length;

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Used by
        </h2>
        <p className="text-xs text-muted-foreground">
          {buckets.direct.length} direct caller
          {buckets.direct.length === 1 ? '' : 's'}
          {transitiveCount > 0 && (
            <>
              {' '}· {transitiveCount} transitive consumer
              {transitiveCount === 1 ? '' : 's'}
            </>
          )}
        </p>
      </div>

      {buckets.direct.length > 0 && (
        <Group
          label="Direct callers"
          hint="The api function passes through these — typically a useQuery/useMutation wrapper."
          tone="violet"
          entries={buckets.direct}
        />
      )}

      {buckets.intermediateHooks.length > 0 && (
        <Group
          label="Intermediate hooks"
          hint="Custom hooks that wrap the direct caller."
          tone="indigo"
          entries={buckets.intermediateHooks}
        />
      )}

      {buckets.activeComponents.length > 0 && (
        <Group
          label="Used in component"
          hint="React component that actually invokes the hook in its body."
          tone="sky"
          entries={buckets.activeComponents}
        />
      )}

      {buckets.wrappers.length > 0 && (
        <div className="rounded-md border bg-muted/20">
          <button
            type="button"
            onClick={() => setShowWrappers((s) => !s)}
            className="flex w-full items-baseline justify-between px-3 py-2 text-left hover:bg-muted/40"
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Render path ({buckets.wrappers.length} parent component
              {buckets.wrappers.length === 1 ? '' : 's'})
            </span>
            <span className="text-[10px] text-muted-foreground">
              {showWrappers ? '▲ hide' : '▼ show'}
            </span>
          </button>
          {showWrappers && (
            <ul className="divide-y border-t">
              {buckets.wrappers.map((c) => (
                <ConsumerRow
                  key={`${c.filePath}:${c.name}:${c.hops}`}
                  c={c}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {buckets.pages.length > 0 && (
        <Group
          label="Pages"
          hint="Entry-point pages whose render tree includes this endpoint."
          tone="emerald"
          entries={buckets.pages}
        />
      )}

      {buckets.direct.length > 0 && transitiveCount === 0 && (
        <p className="text-xs text-muted-foreground">
          No further transitive consumers — the direct caller
          {buckets.direct.length === 1 ? ' is' : 's are'} the only path into this endpoint.
        </p>
      )}
    </section>
  );
}

const GROUP_TONES: Record<
  string,
  { border: string; bg: string; text: string }
> = {
  violet: {
    border: 'border-violet-200 dark:border-violet-900',
    bg: 'bg-violet-50/60 dark:bg-violet-950/30',
    text: 'text-violet-700 dark:text-violet-300',
  },
  indigo: {
    border: 'border-indigo-200 dark:border-indigo-900',
    bg: 'bg-indigo-50/60 dark:bg-indigo-950/30',
    text: 'text-indigo-700 dark:text-indigo-300',
  },
  sky: {
    border: 'border-sky-200 dark:border-sky-900',
    bg: 'bg-sky-50/60 dark:bg-sky-950/30',
    text: 'text-sky-700 dark:text-sky-300',
  },
  emerald: {
    border: 'border-emerald-200 dark:border-emerald-900',
    bg: 'bg-emerald-50/60 dark:bg-emerald-950/30',
    text: 'text-emerald-700 dark:text-emerald-300',
  },
};

function Group({
  label,
  hint,
  tone,
  entries,
}: {
  label: string;
  hint?: string;
  tone: string;
  entries: ApiConsumerEntry[];
}) {
  const t = GROUP_TONES[tone] ?? GROUP_TONES.violet;
  return (
    <div className={`rounded-md border px-3 py-2.5 ${t.border} ${t.bg}`}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className={`text-xs font-semibold uppercase tracking-wider ${t.text}`}>
          {label}
          <span className="ml-1.5 text-[10px] font-normal opacity-70">
            ({entries.length})
          </span>
        </p>
        {hint && (
          <p className="text-[10px] text-muted-foreground">{hint}</p>
        )}
      </div>
      <ul className="space-y-1">
        {entries.map((c) => (
          <ConsumerRow key={`${c.filePath}:${c.name}:${c.hops}`} c={c} />
        ))}
      </ul>
    </div>
  );
}

function ConsumerRow({
  c,
  withHopBadge = true,
}: {
  c: ApiConsumerEntry;
  withHopBadge?: boolean;
}) {
  const kindCls = KIND_STYLES[c.kind];
  return (
    <li className="flex items-baseline gap-3 px-3 py-1.5">
      <span
        className={`inline-flex min-w-[4.5rem] justify-center rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${kindCls}`}
      >
        {c.kind}
      </span>
      <span className="flex-1 font-mono text-sm">{c.name}</span>
      {withHopBadge && (
        <span className="font-mono text-[10px] text-muted-foreground">
          hop {c.hops}
        </span>
      )}
      <span className="font-mono text-xs text-muted-foreground">
        {c.filePath || '—'}
      </span>
    </li>
  );
}
