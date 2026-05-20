import type { DirectProp } from '@page-dep-map/shared';

interface DirectPropsSectionProps {
  props: DirectProp[];
}

export function DirectPropsSection({ props }: DirectPropsSectionProps) {
  if (props.length === 0) {
    return (
      <section className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Direct Props</h2>
        <p className="mt-2 text-sm text-muted-foreground">No direct props.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border bg-card p-6">
      <h2 className="text-lg font-semibold">
        Direct Props{' '}
        <span className="text-sm font-normal text-muted-foreground">({props.length})</span>
      </h2>
      <div className="mt-4 max-h-[28rem] overflow-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))]">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Name</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Type</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Required</th>
            </tr>
          </thead>
          <tbody>
            {props.map((prop) => (
              <tr key={prop.name} className="border-t even:bg-muted/30">
                <td className="px-3 py-2 font-mono text-xs">{prop.name}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                  {prop.type ?? '—'}
                </td>
                <td className="px-3 py-2">
                  {prop.required ? (
                    <span className="text-xs font-medium text-red-600 dark:text-red-400">required</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">optional</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
