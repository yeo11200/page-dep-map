import type { PropFlow } from '@page-dep-map/shared';
import { cn } from '@/lib/utils';

interface PropFlowSectionProps {
  flows: PropFlow[];
}

export function PropFlowSection({ flows }: PropFlowSectionProps) {
  if (flows.length === 0) {
    return (
      <section className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Prop Flows</h2>
        <p className="mt-2 text-sm text-muted-foreground">No prop flows detected.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border bg-card p-6">
      <h2 className="text-lg font-semibold">
        Prop Flows <span className="text-sm font-normal text-muted-foreground">({flows.length})</span>
      </h2>
      <div className="mt-4 space-y-3">
        {flows.map((flow) => (
          <div
            key={`${flow.propName}-${flow.sourceComponent}`}
            className={cn(
              'rounded-md border p-3',
              flow.isUnusedCandidate && 'border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950',
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-medium">{flow.propName}</span>
              {flow.isPassThroughOnly && (
                <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
                  pass-through
                </span>
              )}
              {flow.isUnusedCandidate && (
                <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-800 dark:bg-orange-900 dark:text-orange-300">
                  unused candidate
                </span>
              )}
              <span className="ml-auto text-xs text-muted-foreground">depth: {flow.depth}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              {flow.targetPath.map((comp, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <span className="text-muted-foreground/50">{'\u2192'}</span>}
                  <span className="font-mono">{comp}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
