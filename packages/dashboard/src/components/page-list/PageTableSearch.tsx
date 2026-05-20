interface PageTableSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function PageTableSearch({ value, onChange }: PageTableSearchProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search pages..."
      className="h-9 w-64 rounded-md border bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
    />
  );
}
