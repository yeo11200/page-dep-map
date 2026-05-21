import { useState } from 'react';
import type { PageDetail, PageSummary, ComponentNode } from '@page-dep-map/shared';
import type { DependencyTreeNode } from '@/types/dependency-report';
import { ChildSubtreeModal } from './ChildSubtreeModal';

interface DependenciesSectionProps {
  detail: PageDetail;
  allPages: PageSummary[];
  onChildClick?: (childName: string) => void;
  dependencyChildren?: DependencyTreeNode[];
  onComponentClick?: (node: DependencyTreeNode) => void;
}

interface ListBlockProps {
  title: string;
  items: string[];
}

function ListBlock({ title, items }: ListBlockProps) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <ul className="mt-2 space-y-1">
        {items.map((item) => (
          <li key={item} className="text-sm font-mono">{item}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Check if a child component name has analysis data.
 * Uses exact match only — filename must equal the component name.
 */
function isChildAnalyzed(childName: string, allPages: PageSummary[], contextDir?: string): boolean {
  return allPages.some((p) => {
    const parts = p.pageName.split('/');
    const last = parts[parts.length - 1];
    if (last === childName) return true;
    if (last === 'index' && parts.length >= 2 && parts[parts.length - 2] === childName) return true;
    return false;
  });
}

export function DependenciesSection({
  detail,
  allPages,
  onChildClick,
  dependencyChildren = [],
  onComponentClick,
}: DependenciesSectionProps) {
  const [activeNode, setActiveNode] = useState<ComponentNode | null>(null);

  const findTreeNode = (name: string): ComponentNode | null => {
    const tree = detail.childComponentTree ?? [];
    const baseName = name.includes('.') ? name.split('.')[0]! : name;
    return tree.find((n) => n.name === name || n.name === baseName) ?? null;
  };

  const handleOpenSubtree = (name: string) => {
    const node = findTreeNode(name);
    if (node) setActiveNode(node);
  };

  const nonChildSections = [
    { title: 'Hooks', items: detail.hooks },
    { title: 'Queries', items: detail.queries },
    { title: 'Stores', items: detail.stores },
    { title: 'Contexts', items: detail.contexts },
    { title: 'Shared Modules', items: detail.sharedModules },
  ];
  const visibleChildComponents = (detail.childComponentTree ?? [])
    .filter((node) => !node.external)
    .map((node) => node.name);

  const hasNonChild = nonChildSections.some((s) => s.items.length > 0);
  const hasChildren = visibleChildComponents.length > 0;

  return (
    <section className="rounded-lg border bg-card p-6">
      <h2 className="text-lg font-semibold">Dependencies</h2>
      {!hasNonChild && !hasChildren ? (
        <p className="mt-2 text-sm text-muted-foreground">No dependencies detected.</p>
      ) : (
        <div className="mt-4 space-y-6">
          {hasNonChild && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {nonChildSections.map((s) => (
                <ListBlock key={s.title} title={s.title} items={s.items} />
              ))}
            </div>
          )}

          {hasChildren && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                Child Components ({visibleChildComponents.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {visibleChildComponents.map((child) => {
                  const treeNode = findTreeNode(child);
                  const descendantCount = treeNode ? countDescendantsLocal(treeNode) : 0;
                  return (
                    <button
                      key={child}
                      type="button"
                      onClick={() => handleOpenSubtree(child)}
                      className="inline-flex items-center gap-1.5 rounded-md border bg-muted/50 px-3 py-1.5 text-sm font-mono transition-colors hover:border-foreground/20 hover:bg-muted"
                      title={treeNode?.filePath ?? 'External or unresolved component'}
                    >
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${
                          treeNode?.external ? 'bg-muted-foreground/40' : 'bg-emerald-500'
                        }`}
                      />
                      {child}
                      {descendantCount > 0 && (
                        <span className="text-xs text-muted-foreground">+{descendantCount}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      <ChildSubtreeModal
        isOpen={activeNode !== null}
        onClose={() => setActiveNode(null)}
        node={activeNode}
      />
    </section>
  );
}

function countDescendantsLocal(node: ComponentNode): number {
  let count = 0;
  for (const child of node.children) {
    count += 1 + countDescendantsLocal(child);
  }
  return count;
}
