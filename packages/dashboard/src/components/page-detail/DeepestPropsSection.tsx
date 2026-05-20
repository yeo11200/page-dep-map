import type { DeepestProp } from '@page-dep-map/shared';

interface DeepestPropsSectionProps {
  props: DeepestProp[];
}

export function DeepestPropsSection({ props }: DeepestPropsSectionProps) {
  if (props.length === 0) {
    return (
      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-base font-semibold">Deepest Props</h2>
        <p className="mt-2 text-sm text-muted-foreground">No deep prop drilling detected.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="text-base font-semibold">
        Deepest Props{' '}
        <span className="text-sm font-normal text-muted-foreground">({props.length})</span>
      </h2>
      <div className="mt-3 space-y-2">
        {props.map((prop) => (
          <div key={prop.name} className="rounded-md border p-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-medium">{prop.name}</span>
              <span className="text-xs text-muted-foreground">depth: {prop.depth}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              {prop.path.map((comp, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <span className="text-muted-foreground/50">{'→'}</span>}
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
