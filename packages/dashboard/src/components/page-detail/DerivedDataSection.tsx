interface DerivedDataSectionProps {
  derivedProps: string[];
  /** When true, render nothing instead of an empty card. Default: false. */
  hideWhenEmpty?: boolean;
}

export function DerivedDataSection({ derivedProps, hideWhenEmpty = false }: DerivedDataSectionProps) {
  if (derivedProps.length === 0) {
    if (hideWhenEmpty) return null;
    return (
      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-base font-semibold">Derived Data</h2>
        <p className="mt-2 text-sm text-muted-foreground">No derived data props detected.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="text-base font-semibold">
        Derived Data{' '}
        <span className="text-sm font-normal text-muted-foreground">({derivedProps.length})</span>
      </h2>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {derivedProps.map((prop) => (
          <li
            key={prop}
            className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs font-mono"
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
            {prop}
          </li>
        ))}
      </ul>
    </section>
  );
}
