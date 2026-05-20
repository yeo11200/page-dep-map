import type { PageDetail, PageSummary } from '@page-dep-map/shared';
import type { DependencyTreeNode } from '@/types/dependency-report';

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
  const nonChildSections = [
    { title: 'Hooks', items: detail.hooks },
    { title: 'Queries', items: detail.queries },
    { title: 'Stores', items: detail.stores },
    { title: 'Contexts', items: detail.contexts },
    { title: 'Shared Modules', items: detail.sharedModules },
  ];

  const hasNonChild = nonChildSections.some((s) => s.items.length > 0);
  const hasChildren = detail.childComponents.length > 0;

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
                Child Components ({detail.childComponents.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {detail.childComponents.map((child) => {
                  const analyzed = isChildAnalyzed(child, allPages);
                  const dependencyNode = dependencyChildren.find((node) => node.name === child);
                  if (dependencyNode && dependencyNode.kind !== 'external') {
                    return (
                      <button
                        key={child}
                        type="button"
                        onClick={() => onComponentClick?.(dependencyNode)}
                        className="inline-flex items-center gap-1.5 rounded-md border bg-muted/50 px-3 py-1.5 text-sm font-mono transition-colors hover:border-foreground/20 hover:bg-muted"
                        title={dependencyNode.filePath ?? dependencyNode.importSource}
                      >
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {child}
                        <span className="text-xs text-muted-foreground">
                          {dependencyNode.children.length}
                        </span>
                      </button>
                    );
                  }
                  if (analyzed) {
                    return (
                      <button
                        key={child}
                        onClick={() => onChildClick?.(child)}
                        className="inline-flex items-center gap-1.5 rounded-md border bg-muted/50 px-3 py-1.5 text-sm font-mono transition-colors hover:bg-muted hover:border-foreground/20"
                      >
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
                        {child}
                        <svg width="12" height="12" viewBox="0 0 12 12" className="text-muted-foreground">
                          <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                      </button>
                    );
                  }
                  return (
                    <span
                      key={child}
                      className="inline-flex items-center gap-1.5 rounded-md border border-dashed px-3 py-1.5 text-sm font-mono text-muted-foreground"
                      title="External or unanalyzed component"
                    >
                      {child}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
