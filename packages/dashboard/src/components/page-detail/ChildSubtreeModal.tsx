import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ComponentNode } from '@page-dep-map/shared';

interface ChildSubtreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  node: ComponentNode | null;
}

export function ChildSubtreeModal({ isOpen, onClose, node }: ChildSubtreeModalProps) {
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
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !node) return null;

  const totalDescendants = countDescendants(node);
  const externalCount = countByFlag(node, 'external');
  const cycleCount = countByFlag(node, 'cycle');

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[85vh] w-full max-w-4xl flex-col rounded-lg border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b px-6 py-4">
          <div className="min-w-0">
            <h2 className="truncate font-mono text-lg font-semibold">{node.name}</h2>
            <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground" title={node.filePath ?? undefined}>
              {node.filePath ?? 'External / unresolved'}
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>Depth <strong className="text-foreground">{node.depth}</strong></span>
              <span>·</span>
              <span><strong className="text-foreground">{totalDescendants}</strong> descendant{totalDescendants === 1 ? '' : 's'}</span>
              {node.meta && (
                <>
                  <span>·</span>
                  <span><strong className="text-foreground">{node.meta.propsCount}</strong> props</span>
                  <span>·</span>
                  <span><strong className="text-foreground">{node.meta.hookNames.length}</strong> hooks</span>
                </>
              )}
              {externalCount > 0 && (
                <>
                  <span>·</span>
                  <span>{externalCount} external</span>
                </>
              )}
              {cycleCount > 0 && (
                <>
                  <span>·</span>
                  <span className="text-amber-600 dark:text-amber-400">{cycleCount} cycle</span>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md border px-2 py-1 text-sm hover:bg-muted"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="overflow-auto px-6 py-4">
          <div className="font-mono text-sm">
            <TreeNode node={node} prefix="" isLast={true} isRoot={true} />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

interface TreeNodeProps {
  node: ComponentNode;
  prefix: string;
  isLast: boolean;
  isRoot: boolean;
}

function TreeNode({ node, prefix, isLast, isRoot }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const connector = isRoot ? '' : isLast ? '└─ ' : '├─ ';
  const childPrefix = isRoot ? '' : prefix + (isLast ? '   ' : '│  ');

  const compactPath = compactFilePath(node.filePath);
  const childCount = node.children.length;
  const flag = nodeFlag(node);
  const canExpand = Boolean(node.meta);

  const toggle = () => {
    if (canExpand) setExpanded((v) => !v);
  };

  return (
    <div>
      <div className="flex items-baseline gap-2 whitespace-pre py-0.5">
        <span className="text-muted-foreground">{prefix}{connector}</span>
        {canExpand ? (
          <button
            type="button"
            onClick={toggle}
            className="inline-flex items-baseline gap-2 rounded px-1 -mx-1 transition-colors hover:bg-muted"
          >
            <span className="text-muted-foreground text-xs">{expanded ? '▼' : '▶'}</span>
            <span className={node.external ? 'text-muted-foreground' : 'text-foreground'}>{node.name}</span>
            {childCount > 0 && (
              <span className="text-xs text-muted-foreground">({childCount})</span>
            )}
            {compactPath && (
              <span
                className="truncate text-xs text-muted-foreground/80"
                title={node.filePath ?? undefined}
              >
                — {compactPath}
              </span>
            )}
          </button>
        ) : (
          <>
            <span className={node.external ? 'text-muted-foreground' : 'text-foreground'}>{node.name}</span>
            {compactPath && (
              <span
                className="truncate text-xs text-muted-foreground/80"
                title={node.filePath ?? undefined}
              >
                — {compactPath}
              </span>
            )}
          </>
        )}
        {flag && (
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${flag.className}`}>
            {flag.label}
          </span>
        )}
      </div>
      {expanded && node.meta && (
        <NodeMetaPanel prefix={childPrefix} meta={node.meta} filePath={node.filePath} />
      )}
      {node.children.map((child: ComponentNode, idx: number) => (
        <TreeNode
          key={`${child.name}-${idx}`}
          node={child}
          prefix={childPrefix}
          isLast={idx === node.children.length - 1}
          isRoot={false}
        />
      ))}
    </div>
  );
}

interface NodeMetaPanelProps {
  prefix: string;
  meta: ComponentNode['meta'];
  filePath: string | null;
}

function NodeMetaPanel({ prefix, meta, filePath }: NodeMetaPanelProps) {
  if (!meta) return null;
  const indent = prefix + '   ';
  return (
    <div className="my-1 text-xs">
      <MetaLine prefix={indent} label="props" value={
        meta.propsCount === 0
          ? <span className="text-muted-foreground">—</span>
          : <span>{meta.propsCount} ({meta.propNames.join(', ')})</span>
      } />
      <MetaLine prefix={indent} label="hooks" value={
        meta.hookNames.length === 0
          ? <span className="text-muted-foreground">—</span>
          : <span>{meta.hookNames.length} ({meta.hookNames.join(', ')})</span>
      } />
      <MetaLine prefix={indent} label="children" value={
        <span>{meta.childComponentCount}</span>
      } />
      {filePath && (
        <MetaLine prefix={indent} label="file" value={
          <span className="font-mono text-muted-foreground">{filePath}</span>
        } />
      )}
    </div>
  );
}

interface MetaLineProps {
  prefix: string;
  label: string;
  value: React.ReactNode;
}

function MetaLine({ prefix, label, value }: MetaLineProps) {
  return (
    <div className="flex items-baseline gap-2 whitespace-pre">
      <span className="text-muted-foreground">{prefix}</span>
      <span className="w-16 shrink-0 text-muted-foreground">{label}:</span>
      <span className="min-w-0">{value}</span>
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

function compactFilePath(filePath: string | null): string | null {
  if (!filePath) return null;
  const parts = filePath.split('/').filter(Boolean);
  if (parts.length === 0) return filePath;
  if (parts.length === 1) return parts[0]!;
  return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
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
