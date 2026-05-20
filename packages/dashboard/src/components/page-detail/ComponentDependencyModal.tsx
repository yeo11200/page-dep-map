import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Box, ChevronRight, FileCode2, GitBranch, Package, X } from 'lucide-react';
import type { DependencyTreeNode } from '@/types/dependency-report';
import { cn } from '@/lib/utils';

interface ComponentDependencyModalProps {
  node: DependencyTreeNode | null;
  isOpen: boolean;
  onClose: () => void;
}

function flattenNodes(root: DependencyTreeNode): DependencyTreeNode[] {
  const nodes: DependencyTreeNode[] = [];
  const visit = (node: DependencyTreeNode) => {
    nodes.push(node);
    node.children.forEach(visit);
  };

  visit(root);
  return nodes;
}

function getNodeMeta(node: DependencyTreeNode) {
  if (node.isCircularRef) {
    return {
      label: 'circular',
      className: 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200',
      Icon: AlertCircle,
    };
  }

  if (node.kind === 'external') {
    return {
      label: 'external',
      className: 'border-dashed bg-muted/30 text-muted-foreground',
      Icon: Package,
    };
  }

  return {
    label: node.kind,
    className: 'bg-card text-foreground',
    Icon: Box,
  };
}

function DependencyNodeCard({
  node,
  isSelected,
  onSelect,
}: {
  node: DependencyTreeNode;
  isSelected: boolean;
  onSelect: (node: DependencyTreeNode) => void;
}) {
  const meta = getNodeMeta(node);
  const Icon = meta.Icon;

  return (
    <button
      type="button"
      onClick={() => onSelect(node)}
      className={cn(
        'group w-full rounded-lg border p-3 text-left shadow-sm transition hover:border-primary/50 hover:bg-accent',
        meta.className,
        isSelected && 'border-primary bg-accent ring-1 ring-primary/20',
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            'mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-background',
            node.kind === 'external' && 'border-dashed',
            node.isCircularRef && 'border-red-300 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-900 dark:text-red-200',
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-mono text-sm font-semibold">{node.name}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
              {meta.label}
            </span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              children {node.children.length}
            </span>
          </span>
        </span>
      </div>
      {(node.filePath || node.importSource) && (
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          {node.filePath && <p className="truncate font-mono">{node.filePath}</p>}
          {node.importSource && <p className="truncate font-mono">import: {node.importSource}</p>}
        </div>
      )}
    </button>
  );
}

function DependencyTree({
  node,
  selectedId,
  onSelect,
}: {
  node: DependencyTreeNode;
  selectedId: string;
  onSelect: (node: DependencyTreeNode) => void;
}) {
  return (
    <li className="relative pl-5">
      <span className="absolute left-0 top-5 h-px w-4 bg-border" />
      <DependencyNodeCard node={node} isSelected={selectedId === node.id} onSelect={onSelect} />
      {node.children.length > 0 && (
        <ul className="relative mt-3 space-y-3 before:absolute before:left-0 before:top-0 before:h-full before:w-px before:bg-border">
          {node.children.map((child) => (
            <DependencyTree
              key={`${child.id}-${child.name}`}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function SelectedNodePanel({ node }: { node: DependencyTreeNode }) {
  const meta = getNodeMeta(node);
  const Icon = meta.Icon;

  return (
    <aside className="rounded-lg border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-mono text-base font-semibold">{node.name}</h3>
          <p className="mt-1 text-xs uppercase text-muted-foreground">{meta.label}</p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-md bg-muted/50 p-2">
          <dt className="text-xs text-muted-foreground">Depth</dt>
          <dd className="mt-1 font-bold tabular-nums">{node.depth}</dd>
        </div>
        <div className="rounded-md bg-muted/50 p-2">
          <dt className="text-xs text-muted-foreground">Children</dt>
          <dd className="mt-1 font-bold tabular-nums">{node.children.length}</dd>
        </div>
        <div className="rounded-md bg-muted/50 p-2">
          <dt className="text-xs text-muted-foreground">Kind</dt>
          <dd className="mt-1 truncate font-mono text-xs">{node.kind}</dd>
        </div>
      </dl>

      <div className="mt-4 space-y-3 text-sm">
        {node.filePath && (
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <FileCode2 className="h-3.5 w-3.5" />
              File
            </p>
            <p className="break-all rounded-md bg-muted/50 p-2 font-mono text-xs">{node.filePath}</p>
          </div>
        )}
        {node.importSource && (
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Import</p>
            <p className="break-all rounded-md bg-muted/50 p-2 font-mono text-xs">{node.importSource}</p>
          </div>
        )}
        {node.children.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Direct children</p>
            <div className="flex flex-wrap gap-1.5">
              {node.children.map((child) => (
                <span
                  key={`${child.id}-${child.name}`}
                  className={cn(
                    'rounded border bg-muted/40 px-2 py-1 font-mono text-xs',
                    child.kind === 'external' && 'border-dashed text-muted-foreground',
                  )}
                >
                  {child.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function DepthSummary({ node }: { node: DependencyTreeNode }) {
  const nodes = useMemo(() => flattenNodes(node), [node]);
  const depths = useMemo(() => {
    const groups = new Map<number, DependencyTreeNode[]>();
    nodes.forEach((item) => {
      const depth = item.depth - node.depth;
      groups.set(depth, [...(groups.get(depth) ?? []), item]);
    });
    return [...groups.entries()].sort(([a], [b]) => a - b).slice(0, 4);
  }, [node.depth, nodes]);

  return (
    <div className="grid gap-2 sm:grid-cols-4">
      {depths.map(([depth, items]) => (
        <div key={depth} className="rounded-md border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">{depth === 0 ? 'Root' : `Depth ${depth}`}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{items.length}</p>
        </div>
      ))}
    </div>
  );
}

export function ComponentDependencyModal({
  node,
  isOpen,
  onClose,
}: ComponentDependencyModalProps) {
  const [selectedNode, setSelectedNode] = useState<DependencyTreeNode | null>(node);

  useEffect(() => {
    setSelectedNode(node);
  }, [node]);

  if (!isOpen || !node || !selectedNode) return null;

  const totalNodes = flattenNodes(node).length;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 mx-4 flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold">Component Dependency Map</h2>
              <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                <GitBranch className="h-3.5 w-3.5" />
                {totalNodes} nodes
              </span>
            </div>
            <div className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
              <span className="truncate font-mono font-medium text-foreground">{node.name}</span>
              {node.filePath && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate font-mono text-xs">{node.filePath}</span>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b px-5 py-3">
          <DepthSummary node={node} />
        </div>

        <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-h-0 overflow-auto px-5 py-4">
            <div className="min-w-[520px]">
              <DependencyNodeCard
                node={node}
                isSelected={selectedNode.id === node.id}
                onSelect={setSelectedNode}
              />
              {node.children.length > 0 ? (
                <ul className="relative mt-4 space-y-3 before:absolute before:left-0 before:top-0 before:h-full before:w-px before:bg-border">
                  {node.children.map((child) => (
                    <DependencyTree
                      key={`${child.id}-${child.name}`}
                      node={child}
                      selectedId={selectedNode.id}
                      onSelect={setSelectedNode}
                    />
                  ))}
                </ul>
              ) : (
                <p className="mt-4 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  No child components found.
                </p>
              )}
            </div>
          </div>
          <div className="border-t bg-muted/20 p-4 lg:border-l lg:border-t-0">
            <SelectedNodePanel node={selectedNode} />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
