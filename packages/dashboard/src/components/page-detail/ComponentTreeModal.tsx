import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { PageDetail, PageSummary } from '@page-dep-map/shared';
import { RiskBadge } from '@/components/shared/RiskBadge';
import { SeverityBadge } from '@/components/shared/SeverityBadge';
import { cn, toFileSlug } from '@/lib/utils';
import { RISK_COLORS } from '@/lib/colors';

interface ComponentTreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  componentName: string;
  parentFilePath?: string;
  allPages: PageSummary[];
  fetchDetail: (slug: string) => Promise<PageDetail>;
}

interface BreadcrumbItem {
  name: string;
  slug: string;
}

export function ComponentTreeModal({
  isOpen,
  onClose,
  componentName,
  parentFilePath,
  allPages,
  fetchDetail,
}: ComponentTreeModalProps) {
  const [detail, setDetail] = useState<PageDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);

  /**
   * 자식 컴포넌트 이름으로 분석 데이터를 찾는다.
   * contextDir: 현재 컴포넌트의 디렉토리 — 같은/인접 디렉토리 우선 매칭.
   *
   * 매칭 우선순위:
   * 1. 파일명이 정확히 일치하는 것 (last segment === name)
   * 2. index.tsx인 경우 부모 폴더명이 일치하는 것
   * 3. 동일 디렉토리 내 매칭을 최우선
   * 4. fuzzy 매칭은 하지 않음 — 정확하지 않으면 "미분석"으로 표시
   */
  const findPageSlug = useCallback(
    (name: string, contextDir?: string): string | null => {
      // Collect all exact matches (filename === name OR folder/index === name)
      const exactMatches = allPages.filter((p) => {
        const parts = p.pageName.split('/');
        const last = parts[parts.length - 1];
        if (last === name) return true;
        if (last === 'index' && parts.length >= 2 && parts[parts.length - 2] === name) return true;
        return false;
      });

      if (exactMatches.length === 0) return null;
      if (exactMatches.length === 1) return toFileSlug(exactMatches[0].pageName);

      // Multiple matches — use contextDir to disambiguate
      if (contextDir) {
        // Prefer match in same or nearby directory
        const dirParts = contextDir.split('/');
        let bestMatch = exactMatches[0];
        let bestScore = 0;

        for (const match of exactMatches) {
          const matchParts = match.pageName.split('/');
          let shared = 0;
          for (let i = 0; i < Math.min(dirParts.length, matchParts.length); i++) {
            if (dirParts[i] === matchParts[i]) shared++;
            else break;
          }
          if (shared > bestScore) {
            bestScore = shared;
            bestMatch = match;
          }
        }
        return toFileSlug(bestMatch.pageName);
      }

      return toFileSlug(exactMatches[0].pageName);
    },
    [allPages],
  );

  // Get the directory of the current component for context-aware matching
  const currentDir = detail?.filePath
    ? detail.filePath.split('/').slice(0, -1).join('/')
    : parentFilePath?.split('/').slice(0, -1).join('/');

  const loadComponent = useCallback(
    async (name: string, contextDir?: string) => {
      const slug = findPageSlug(name, contextDir);
      if (!slug) {
        setError(`"${name}" — analysis data not found (external library or unanalyzed component)`);
        setDetail(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await fetchDetail(slug);
        setDetail(data);
        setBreadcrumbs((prev) => [...prev, { name, slug }]);
      } catch {
        setError(`Failed to load "${name}"`);
        setDetail(null);
      } finally {
        setLoading(false);
      }
    },
    [fetchDetail, findPageSlug],
  );

  // Load initial component
  useEffect(() => {
    if (isOpen && componentName) {
      setBreadcrumbs([]);
      setDetail(null);
      const initDir = parentFilePath?.split('/').slice(0, -1).join('/');
      loadComponent(componentName, initDir);
    }
  }, [isOpen, componentName, parentFilePath, loadComponent]);

  // Lock background scroll while the modal is open.
  // Dashboard layout can scroll on <html>, <body>, <main>, or #root depending
  // on content height — lock them all, and also block wheel/touchmove on window
  // as a final guard (modal internal scroll container handles its own events
  // before they reach window).
  useEffect(() => {
    if (!isOpen) return;
    const html = document.documentElement;
    const body = document.body;
    const main = document.querySelector('main');
    const root = document.getElementById('root');

    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyTouch: body.style.touchAction,
      mainOverflow: main?.style.overflow ?? '',
      rootOverflow: root?.style.overflow ?? '',
    };

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.touchAction = 'none';
    if (main) main.style.overflow = 'hidden';
    if (root) root.style.overflow = 'hidden';

    // Event-level guard — prevent default only when the target is outside
    // the modal's internal scroll area.
    const isInsideModalScroll = (target: EventTarget | null) => {
      if (!(target instanceof Node)) return false;
      return !!(target as Element).closest?.('[data-modal-scroll]');
    };
    const blockIfOutside = (e: Event) => {
      if (!isInsideModalScroll(e.target)) e.preventDefault();
    };
    window.addEventListener('wheel', blockIfOutside, { passive: false });
    window.addEventListener('touchmove', blockIfOutside, { passive: false });

    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      body.style.touchAction = prev.bodyTouch;
      if (main) main.style.overflow = prev.mainOverflow;
      if (root) root.style.overflow = prev.rootOverflow;
      window.removeEventListener('wheel', blockIfOutside);
      window.removeEventListener('touchmove', blockIfOutside);
    };
  }, [isOpen]);

  const handleChildClick = (childName: string) => {
    // Use current component's directory as context for child lookup
    const dir = detail?.filePath?.split('/').slice(0, -1).join('/');
    loadComponent(childName, dir);
  };

  const handleBreadcrumbClick = async (index: number) => {
    const target = breadcrumbs[index];
    if (!target) return;
    setLoading(true);
    try {
      const data = await fetchDetail(target.slug);
      setDetail(data);
      setBreadcrumbs((prev) => prev.slice(0, index + 1));
    } catch {
      setError('Failed to navigate');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold truncate">Component Tree</h2>
            {/* Breadcrumbs */}
            {breadcrumbs.length > 0 && (
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground overflow-x-auto">
                {breadcrumbs.map((bc, i) => (
                  <span key={i} className="flex items-center gap-1 shrink-0">
                    {i > 0 && <span className="text-muted-foreground/50">&rarr;</span>}
                    <button
                      onClick={() => handleBreadcrumbClick(i)}
                      className={cn(
                        'hover:text-foreground transition-colors',
                        i === breadcrumbs.length - 1
                          ? 'font-semibold text-foreground'
                          : 'hover:underline',
                      )}
                    >
                      {bc.name}
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-4 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div data-modal-scroll className="flex-1 overflow-y-auto overscroll-contain px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200">
              {error}
            </div>
          )}

          {detail && !loading && <ComponentSummary detail={detail} onChildClick={handleChildClick} findPageSlug={findPageSlug} />}
        </div>
      </div>
    </div>,
    document.body,
  );
}

interface ComponentSummaryProps {
  detail: PageDetail;
  onChildClick: (name: string) => void;
  findPageSlug: (name: string, contextDir?: string) => string | null;
}

function ComponentSummary({ detail, onChildClick, findPageSlug }: ComponentSummaryProps) {
  const m = detail.metrics;
  const riskColor = RISK_COLORS[m.riskLevel];
  const contextDir = detail.filePath?.split('/').slice(0, -1).join('/');

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-sm text-muted-foreground truncate">{detail.filePath}</span>
        <RiskBadge level={m.riskLevel} />
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', riskColor.bg, riskColor.text)}>
          Score: {m.complexityScore}
        </span>
      </div>

      {/* Key metrics grid */}
      <div className="grid grid-cols-4 gap-3">
        <MetricCard label="Props" value={m.propsCount} />
        <MetricCard label="Hooks" value={m.hookCount} />
        <MetricCard label="Effects" value={m.effectCount} warn={m.effectCount >= 4} />
        <MetricCard label="Queries" value={m.queryCount} />
        <MetricCard label="Children" value={m.childComponentCount} />
        <MetricCard label="Conditions" value={m.conditionalBranchCount} />
        <MetricCard label="Depth" value={m.maxDrillingDepth} warn={m.maxDrillingDepth >= 3} />
        <MetricCard label="Pass-through" value={m.passThroughPropsCount} warn={m.passThroughPropsCount >= 2} />
      </div>

      {/* Likely Issues */}
      {detail.likelyIssues.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Issues</h3>
          <div className="space-y-1.5">
            {detail.likelyIssues.map((issue, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <SeverityBadge severity={issue.severity} />
                <span>{issue.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hooks list */}
      {detail.hooks.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Hooks ({detail.hooks.length})</h3>
          <div className="flex flex-wrap gap-1.5">
            {detail.hooks.map((h, i) => (
              <span key={i} className="rounded bg-muted px-2 py-0.5 text-xs font-mono">{h}</span>
            ))}
          </div>
        </div>
      )}

      {/* Child Components — the clickable tree! */}
      {detail.childComponents.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Child Components ({detail.childComponents.length})
          </h3>
          <div className="grid gap-1.5">
            {detail.childComponents.map((child) => {
              const isAnalyzed = findPageSlug(child, contextDir) !== null;
              return (
                <button
                  key={child}
                  onClick={() => isAnalyzed && onChildClick(child)}
                  disabled={!isAnalyzed}
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                    isAnalyzed
                      ? 'hover:bg-muted hover:border-foreground/20 cursor-pointer'
                      : 'opacity-50 cursor-default',
                  )}
                >
                  <span className={cn(
                    'inline-block h-2 w-2 rounded-full shrink-0',
                    isAnalyzed ? 'bg-blue-500' : 'bg-gray-300',
                  )} />
                  <span className="font-mono">{child}</span>
                  {isAnalyzed && (
                    <span className="ml-auto text-xs text-muted-foreground">&rarr; drill in</span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full bg-blue-500 mr-1" />
            = analyzed, click to drill in
          </p>
        </div>
      )}

      {/* Direct Props */}
      {detail.directProps.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Props ({detail.directProps.length})</h3>
          <div className="flex flex-wrap gap-1.5">
            {detail.directProps.map((p) => (
              <span
                key={p.name}
                className={cn(
                  'rounded px-2 py-0.5 text-xs font-mono',
                  p.required ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200' : 'bg-muted',
                )}
              >
                {p.name}{!p.required && '?'}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={cn(
      'rounded-lg border px-3 py-2 text-center',
      warn ? 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950' : '',
    )}>
      <div className={cn('text-lg font-bold', warn ? 'text-orange-600' : '')}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
