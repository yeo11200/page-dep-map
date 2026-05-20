import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toFileSlug } from '@/lib/utils';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import type { PageSummary, RiskLevel } from '@page-dep-map/shared';
import { cn } from '@/lib/utils';
import { columns } from './PageTableColumns';
import { PageTableSearch } from './PageTableSearch';
import { PageTableFilters } from './PageTableFilters';

interface PageTableProps {
  data: PageSummary[];
}

export function PageTable({ data }: PageTableProps) {
  const navigate = useNavigate();
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'complexityScore', desc: true },
  ]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const riskFilter = useMemo(() => {
    const found = columnFilters.find((f) => f.id === 'riskLevel');
    return (found?.value as RiskLevel[]) ?? [];
  }, [columnFilters]);

  function setRiskFilter(levels: RiskLevel[]) {
    setColumnFilters((prev) => {
      const without = prev.filter((f) => f.id !== 'riskLevel');
      if (levels.length === 0) return without;
      return [...without, { id: 'riskLevel', value: levels }];
    });
  }

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, columnFilters },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const search = filterValue.toLowerCase();
      return (
        row.original.pageName.toLowerCase().includes(search) ||
        row.original.filePath.toLowerCase().includes(search)
      );
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <PageTableSearch value={globalFilter} onChange={setGlobalFilter} />
        <PageTableFilters selected={riskFilter} onChange={setRiskFilter} />
        <span className="ml-auto text-xs text-muted-foreground">
          {table.getFilteredRowModel().rows.length} of {data.length} pages
        </span>
      </div>

      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b bg-muted/50">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className={cn(
                      'px-4 py-3 text-left text-xs font-medium text-muted-foreground',
                      header.column.getCanSort() && 'cursor-pointer select-none hover:text-foreground',
                    )}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{ asc: ' \u2191', desc: ' \u2193' }[header.column.getIsSorted() as string] ?? ''}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => navigate(`/pages/${toFileSlug(row.original.pageName)}`)}
                className="cursor-pointer border-b transition-colors last:border-0 hover:bg-accent/50"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
