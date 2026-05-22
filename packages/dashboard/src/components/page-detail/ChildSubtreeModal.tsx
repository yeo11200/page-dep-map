import { createContext, useContext, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import type { ComponentNode } from '@page-dep-map/shared';
import { useInspectBridge } from '@/hooks/use-inspect-bridge';

interface ChildSubtreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  node: ComponentNode | null;
}

interface InspectContextValue {
  isHelperAlive: boolean;
  focus: (payload: { componentName: string; filePath?: string | null; line?: number }) => void;
  clear: () => void;
}

const InspectContext = createContext<InspectContextValue | null>(null);

export function ChildSubtreeModal({ isOpen, onClose, node }: ChildSubtreeModalProps) {
  const bridge = useInspectBridge();
  // Mirror props/hooks into refs so the cleanup effect depends ONLY on
  // isOpen. Otherwise any new reference for `bridge` (changes on every
  // helper ack) or `onClose` (inline arrow from parent) would re-run the
  // effect and fire bridge.clear() right after each focus, wiping the
  // overlay on the host page.
  const bridgeRef = useRef(bridge);
  bridgeRef.current = bridge;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      document.removeEventListener('keydown', onKey);
      bridgeRef.current.clear();
    };
  }, [isOpen]);

  if (!isOpen || !node) return null;

  const totalDescendants = countDescendants(node);
  const cycleCount = countByFlag(node, 'cycle');

  return createPortal(
    <InspectContext.Provider value={bridge}>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onClick={onClose}
      >
        <div
          className="relative flex max-h-[88vh] w-full flex-col rounded-xl border bg-background shadow-2xl"
          style={{ maxWidth: 'min(1600px, 95vw)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <header className="flex items-start justify-between gap-4 border-b px-6 py-5">
            <div className="min-w-0">
              <h2 className="truncate font-mono text-xl font-semibold">{node.name}</h2>
              <p
                className="mt-1 truncate font-mono text-xs text-muted-foreground"
                title={node.filePath ?? undefined}
              >
                {node.filePath ?? 'External / unresolved'}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                <Stat label="Depth" value={node.depth} />
                <Stat label="Descendants" value={totalDescendants} />
                {node.meta && (
                  <>
                    <Stat label="Props" value={node.meta.propsCount} />
                    <Stat label="Hooks" value={node.meta.hookNames.length} />
                  </>
                )}
                {cycleCount > 0 && (
                  <Stat
                    label="Cycle"
                    value={cycleCount}
                    className="text-amber-600 dark:text-amber-400"
                  />
                )}
                <InspectStatus alive={bridge.isHelperAlive} />
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-md border px-2.5 py-1 text-sm hover:bg-muted"
              aria-label="Close"
            >
              ✕
            </button>
          </header>

          <div className="overflow-auto px-6 py-5">
            <div className="text-sm">
              <TreeNode node={node} depth={0} isRoot={true} />
            </div>
          </div>
        </div>
      </div>
    </InspectContext.Provider>,
    document.body,
  );
}

function InspectStatus({ alive }: { alive: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
        alive
          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
          : 'border-border bg-muted text-muted-foreground'
      }`}
      title={
        alive
          ? 'Inspect helper detected — Inspect buttons will highlight components on screen'
          : 'No inspect helper detected — install @shinjinseop/page-dep-map-vite-plugin to enable runtime highlighting'
      }
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${alive ? 'bg-emerald-500' : 'bg-muted-foreground/50'}`}
        aria-hidden
      />
      Inspect {alive ? 'connected' : 'offline'}
    </span>
  );
}

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-baseline gap-1 ${className ?? ''}`}>
      <span className="text-muted-foreground">{label}</span>
      <strong className="text-foreground tabular-nums">{value}</strong>
    </span>
  );
}

interface TreeNodeProps {
  node: ComponentNode;
  depth: number;
  isRoot: boolean;
}

function TreeNode({ node, depth, isRoot }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const displayPath = node.filePath && !isGeneratedPath(node.filePath) ? node.filePath : null;
  const visibleChildren = node.children;
  const childCount = visibleChildren.length;
  const flag = nodeFlag(node);
  const canExpand = Boolean(node.meta);
  const hasComment = Boolean(node.meta?.leadingComment);
  const codeLink = displayPath ? node.meta?.codeLink : undefined;

  const toggle = () => {
    if (canExpand) setExpanded((v) => !v);
  };
  const openCode = () => {
    if (codeLink) openCodeInEditor(codeLink);
  };

  const indentPx = depth * 20;
  const nameClass = node.external ? 'text-muted-foreground' : 'text-foreground font-medium';

  return (
    <div>
      <div
        className="group/node relative flex items-start gap-2 rounded-md py-1.5 pr-2 transition-colors hover:bg-muted/40"
        style={{ paddingLeft: indentPx + 8 }}
      >
        {hasComment && (
          <div className="pointer-events-none absolute bottom-full left-8 z-30 mb-2 hidden max-w-xl rounded-lg border border-border bg-background px-4 py-3 text-xs text-foreground shadow-2xl ring-1 ring-black/5 group-hover/node:block">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
              Comment
            </div>
            <div className="whitespace-pre-wrap font-sans leading-relaxed text-foreground">
              {node.meta?.leadingComment}
            </div>
            <div
              className="absolute left-4 top-full h-2 w-2 -translate-y-1 rotate-45 border-b border-r border-border bg-background"
              aria-hidden
            />
          </div>
        )}

        {/* Vertical guideline indicator */}
        {depth > 0 && (
          <div
            className="pointer-events-none absolute top-0 bottom-0 border-l border-border/60"
            style={{ left: indentPx - 10 }}
            aria-hidden
          />
        )}

        {/* Connector dot */}
        {!isRoot && (
          <div
            className="pointer-events-none absolute h-px w-2 bg-border/80"
            style={{ left: indentPx - 10, top: '1.25rem' }}
            aria-hidden
          />
        )}

        {/* Toggle */}
        {canExpand && childCount > 0 ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              toggle();
            }}
            className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs text-muted-foreground hover:bg-muted"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? '▼' : '▶'}
          </button>
        ) : canExpand ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              toggle();
            }}
            className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs text-muted-foreground/40 hover:bg-muted"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            ◦
          </button>
        ) : (
          <span className="mt-0.5 inline-block h-5 w-5 shrink-0" aria-hidden />
        )}

        {/* Name + meta line */}
        <div
          className={`min-w-0 flex-1 rounded-sm ${codeLink ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/60' : ''}`}
          onClick={openCode}
          role={codeLink ? 'button' : undefined}
          tabIndex={codeLink ? 0 : undefined}
          title={codeLink ? 'Open code in Cursor' : undefined}
          onKeyDown={(event) => {
            if (!codeLink) return;
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openCode();
            }
          }}
        >
          <div className="flex flex-wrap items-baseline gap-2">
            <span className={`font-mono ${nameClass}`}>{node.name}</span>
            {hasComment && (
              <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium uppercase text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                comment
              </span>
            )}
            {childCount > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {childCount} child{childCount === 1 ? '' : 'ren'}
              </span>
            )}
            {flag && (
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${flag.className}`}
              >
                {flag.label}
              </span>
            )}
            <InspectButton node={node} />
          </div>
          {displayPath && (
            <div
              className="mt-0.5 truncate font-mono text-xs text-muted-foreground/80"
              title={displayPath}
              dir="rtl"
              style={{ textAlign: 'left' }}
            >
              <bdi>{displayPath}</bdi>
            </div>
          )}
        </div>
      </div>

      {expanded && node.meta && (
        <NodeMetaPanel
          indentPx={indentPx + 28}
          meta={node.meta}
          filePath={node.filePath}
        />
      )}
      {visibleChildren.map((child: ComponentNode, idx: number) => (
        <TreeNode
          key={`${child.name}-${idx}`}
          node={child}
          depth={depth + 1}
          isRoot={false}
        />
      ))}
    </div>
  );
}

function InspectButton({ node }: { node: ComponentNode }) {
  const ctx = useContext(InspectContext);
  if (!ctx || node.external) return null;
  // Only show on parent components (those with an expand chevron). Leaf
  // components like Card / TableRow are usually generic primitives reused
  // across many places — inspecting them tends to be noise rather than
  // signal.
  if (!node.children || node.children.length === 0) return null;
  const disabled = !ctx.isHelperAlive;
  const handleClick = (e: ReactMouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    ctx.focus({
      componentName: node.name,
      filePath: node.filePath,
      line: node.meta?.codeLink ? extractLine(node.meta.codeLink) : undefined,
    });
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide transition-colors ${
        disabled
          ? 'cursor-not-allowed border-border/60 text-muted-foreground/50'
          : 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-300 dark:hover:bg-rose-900'
      }`}
      title={
        disabled
          ? 'Helper not connected. Add @shinjinseop/page-dep-map-vite-plugin to your dev app.'
          : 'Highlight this component on the running page'
      }
    >
      Inspect
    </button>
  );
}

function extractLine(codeLink: string): number | undefined {
  const match = codeLink.match(/:(\d+)(?::\d+)?$/);
  if (!match) return undefined;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : undefined;
}

interface NodeMetaPanelProps {
  indentPx: number;
  meta: ComponentNode['meta'];
  filePath: string | null;
}

function NodeMetaPanel({ indentPx, meta, filePath }: NodeMetaPanelProps) {
  if (!meta) return null;
  return (
    <div
      className="my-1 ml-2 rounded-md border-l-2 border-border/60 bg-muted/30 py-2 pl-3 pr-4 text-xs"
      style={{ marginLeft: indentPx }}
    >
      <MetaLine label="props">
        {meta.propsCount === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span>
            <strong className="tabular-nums">{meta.propsCount}</strong>
            <span className="text-muted-foreground"> · </span>
            <span className="font-mono">{meta.propNames.join(', ')}</span>
          </span>
        )}
      </MetaLine>
      <MetaLine label="hooks">
        {meta.hookNames.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span>
            <strong className="tabular-nums">{meta.hookNames.length}</strong>
            <span className="text-muted-foreground"> · </span>
            <span className="font-mono">{meta.hookNames.join(', ')}</span>
          </span>
        )}
      </MetaLine>
      <MetaLine label="api">
        {meta.apiNames.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="font-mono">{meta.apiNames.join(', ')}</span>
        )}
      </MetaLine>
      {meta.leadingComment && (
        <MetaLine label="comment">
          <span className="whitespace-pre-wrap font-sans text-muted-foreground">{meta.leadingComment}</span>
        </MetaLine>
      )}
      <MetaLine label="children">
        <strong className="tabular-nums">{meta.childComponentCount}</strong>
      </MetaLine>
      {filePath && !isGeneratedPath(filePath) && (
        <MetaLine label="file">
          {meta.codeLink ? (
            <button
              type="button"
              className="break-all text-left font-mono text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              onClick={() => openCodeInEditor(meta.codeLink!)}
            >
              {filePath}
            </button>
          ) : (
            <span className="font-mono text-muted-foreground">{filePath}</span>
          )}
        </MetaLine>
      )}
    </div>
  );
}

function MetaLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 py-0.5">
      <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}

function nodeFlag(node: ComponentNode): { label: string; className: string } | null {
  if (node.external) {
    return {
      label: 'external',
      className: 'bg-muted text-muted-foreground',
    };
  }
  if (node.cycle) {
    return {
      label: 'cycle',
      className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    };
  }
  if (node.truncated) {
    return {
      label: 'truncated',
      className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    };
  }
  return null;
}

function countDescendants(node: ComponentNode): number {
  let count = 0;
  for (const child of node.children) {
    count += 1 + countDescendants(child);
  }
  return count;
}

function countByFlag(node: ComponentNode, flag: 'external' | 'cycle' | 'truncated'): number {
  let count = node[flag] ? 1 : 0;
  for (const child of node.children) {
    count += countByFlag(child, flag);
  }
  return count;
}

function openCodeInEditor(vscodeLink: string) {
  const cursorLink = vscodeLink.replace(/^vscode:\/\//, 'cursor://');
  let fallbackTimer: number | undefined;

  const cancelFallback = () => {
    if (fallbackTimer) window.clearTimeout(fallbackTimer);
    window.removeEventListener('blur', cancelFallback);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };

  const handleVisibilityChange = () => {
    if (document.hidden) cancelFallback();
  };

  window.addEventListener('blur', cancelFallback, { once: true });
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.location.href = cursorLink;

  fallbackTimer = window.setTimeout(() => {
    cancelFallback();
    window.location.href = vscodeLink;
  }, 900);
}

function isGeneratedPath(filePath: string): boolean {
  return filePath.includes('/dist/') || filePath.includes('/build/') || filePath.endsWith('.d.ts');
}
