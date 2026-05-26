import { useMemo, useState } from 'react';
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

type SortKey =
  | 'path'
  | 'method'
  | 'refs'
  | 'pages'
  | 'direct'
  | 'consumers'
  | 'tier'
  | 'impact';
type SortDir = 'asc' | 'desc';
type TierFilter = 'all' | 'reached' | 'orphan';
type ImpactFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';

const IMPACT_RANK: Record<ApiEndpoint['impact'], number> = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0,
};

function encodeId(id: string) {
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
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('impact');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const availableMethods = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    for (const ep of data.endpoints) set.add(ep.method);
    return [...set].sort();
  }, [data]);

  const filteredSorted = useMemo(() => {
    if (!data) return [];
    const needle = search.trim().toLowerCase();
    let list = data.endpoints.filter((ep) => {
      if (tierFilter !== 'all' && ep.tier !== tierFilter) return false;
      if (methodFilter !== 'all' && ep.method !== methodFilter) return false;
      if (impactFilter !== 'all' && ep.impact !== impactFilter) return false;
      if (needle && !ep.path.toLowerCase().includes(needle)) return false;
      return true;
    });
    // Sort copy so React keeps stable refs.
    list = [...list];
    const dir = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      const aVal = sortValue(a, sortKey);
      const bVal = sortValue(b, sortKey);
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * dir;
      }
      return String(aVal).localeCompare(String(bVal)) * dir;
    });
    return list;
  }, [data, search, tierFilter, methodFilter, impactFilter, sortKey, sortDir]);

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

  const { stats, unresolved } = data;
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(key);
      setSortDir(key === 'path' || key === 'method' || key === 'tier' ? 'asc' : 'desc');
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">APIs</h1>
        <p className="text-sm text-muted-foreground">
          {stats.totalEndpoints} endpoints · {stats.reachedEndpoints ?? 0}{' '}
          reached · {stats.orphanEndpoints ?? 0} orphan ·{' '}
          {stats.hotEndpoints} hot · {stats.uncategorized} unresolved
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/20 px-4 py-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by path…"
          className="flex-1 min-w-[16rem] rounded-md border bg-background px-3 py-1.5 font-mono text-sm"
        />
        <FilterPill
          label="Impact"
          value={impactFilter}
          options={['all', 'critical', 'high', 'medium', 'low']}
          onChange={(v) => setImpactFilter(v as ImpactFilter)}
        />
        <FilterPill
          label="Tier"
          value={tierFilter}
          options={['all', 'reached', 'orphan']}
          onChange={(v) => setTierFilter(v as TierFilter)}
        />
        <FilterPill
          label="Method"
          value={methodFilter}
          options={['all', ...availableMethods]}
          onChange={setMethodFilter}
        />
        <span className="text-xs text-muted-foreground">
          {filteredSorted.length} of {data.endpoints.length}
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <SortHeader label="Impact" sortKey="impact" current={sortKey} dir={sortDir} onClick={toggleSort} className="w-28" />
              <SortHeader label="Method" sortKey="method" current={sortKey} dir={sortDir} onClick={toggleSort} className="w-[5.5rem]" />
              <SortHeader label="Path" sortKey="path" current={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Pages" sortKey="pages" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" className="w-20" />
              <SortHeader label="Direct" sortKey="direct" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" className="w-20" />
              <SortHeader label="Consumers" sortKey="consumers" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" className="w-24" />
              <SortHeader label="Tier" sortKey="tier" current={sortKey} dir={sortDir} onClick={toggleSort} className="w-24" />
            </tr>
          </thead>
          <tbody>
            {filteredSorted.map((ep: ApiEndpoint) => (
              <tr
                key={ep.id}
                className={`border-b last:border-b-0 hover:bg-muted/40 ${
                  ep.tier === 'orphan' ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''
                }`}
              >
                <td className="px-4 py-2.5">
                  <ImpactBadge impact={ep.impact} riskyPages={ep.impactBreakdown.riskyPages} />
                </td>
                <td className="px-4 py-2.5">
                  <MethodBadge method={ep.method} />
                </td>
                <td className="px-4 py-2.5 font-mono">
                  <Link to={`/apis/${encodeId(ep.id)}`} className="text-foreground hover:underline">
                    {ep.path}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">
                  {ep.pages.length}
                </td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {ep.directCallers?.length ?? 0}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">
                  {ep.consumerCount > 0 ? ep.consumerCount : <span className="text-muted-foreground/40">—</span>}
                </td>
                <td className="px-4 py-2.5">
                  <TierBadge tier={ep.tier} />
                </td>
              </tr>
            ))}
            {filteredSorted.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No endpoints match the current filters.
                </td>
              </tr>
            )}
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

function sortValue(ep: ApiEndpoint, key: SortKey): string | number {
  switch (key) {
    case 'path':
      return ep.path;
    case 'method':
      return ep.method;
    case 'refs':
      return ep.referenceCount;
    case 'pages':
      return ep.pages.length;
    case 'direct':
      return ep.directCallers?.length ?? 0;
    case 'consumers':
      return ep.consumerCount;
    case 'tier':
      // Reached first when sorted ascending — orphans bubble up on desc.
      return ep.tier === 'reached' ? 0 : ep.tier === 'orphan' ? 1 : 2;
    case 'impact':
      return IMPACT_RANK[ep.impact];
  }
}

function SortHeader({
  label,
  sortKey,
  current,
  dir,
  onClick,
  align,
  className,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onClick: (key: SortKey) => void;
  align?: 'left' | 'right';
  className?: string;
}) {
  const isActive = current === sortKey;
  const arrow = isActive ? (dir === 'asc' ? '▲' : '▼') : '';
  return (
    <th
      className={`px-4 py-2.5 ${align === 'right' ? 'text-right' : ''} ${className ?? ''}`}
    >
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-foreground ${
          isActive ? 'text-foreground' : ''
        }`}
      >
        {label}
        {arrow && <span className="text-[10px]">{arrow}</span>}
      </button>
    </th>
  );
}

function FilterPill({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-xs">
      <span className="font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border bg-background px-2 py-1 font-mono"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}

function ImpactBadge({
  impact,
  riskyPages,
}: {
  impact: ApiEndpoint['impact'];
  riskyPages: number;
}) {
  // Single colored pill that summarizes change-impact severity. The
  // outer bar is filled so the eye catches critical/high rows at a
  // glance even when scrolling. Risky pages get a small dot suffix to
  // flag the "this endpoint feeds a fragile page" overlay.
  const styles: Record<ApiEndpoint['impact'], { bg: string; text: string; label: string }> = {
    critical: {
      bg: 'bg-rose-500/15 ring-rose-500/40',
      text: 'text-rose-700 dark:text-rose-300',
      label: 'critical',
    },
    high: {
      bg: 'bg-orange-500/15 ring-orange-500/40',
      text: 'text-orange-700 dark:text-orange-300',
      label: 'high',
    },
    medium: {
      bg: 'bg-amber-500/15 ring-amber-500/40',
      text: 'text-amber-700 dark:text-amber-300',
      label: 'medium',
    },
    low: {
      bg: 'bg-emerald-500/15 ring-emerald-500/40',
      text: 'text-emerald-700 dark:text-emerald-300',
      label: 'low',
    },
  };
  const s = styles[impact];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${s.bg} ${s.text}`}
    >
      {s.label}
      {riskyPages > 0 && (
        <span
          className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-rose-500"
          title={`${riskyPages} risky page(s) consume this endpoint`}
        />
      )}
    </span>
  );
}

function TierBadge({ tier }: { tier: ApiEndpoint['tier'] }) {
  if (tier === 'reached') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        reached
      </span>
    );
  }
  if (tier === 'orphan') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        orphan
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
      {tier}
    </span>
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
