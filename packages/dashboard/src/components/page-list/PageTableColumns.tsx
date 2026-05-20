import { createColumnHelper } from '@tanstack/react-table';
import type { PageSummary } from '@page-dep-map/shared';
import { RiskBadge } from '@/components/shared/RiskBadge';
import { ScoreBar } from '@/components/shared/ScoreBar';

const col = createColumnHelper<PageSummary>();

export const columns = [
  col.accessor('pageName', {
    header: 'Page Name',
    cell: (info) => (
      <span className="font-medium">{info.getValue()}</span>
    ),
  }),
  col.accessor('filePath', {
    header: 'File Path',
    cell: (info) => (
      <span className="text-xs text-muted-foreground">{info.getValue()}</span>
    ),
  }),
  col.accessor('complexityScore', {
    header: 'Score',
    cell: (info) => (
      <ScoreBar
        score={info.getValue()}
        riskLevel={info.row.original.riskLevel}
        className="w-24"
      />
    ),
  }),
  col.accessor('riskLevel', {
    header: 'Risk',
    cell: (info) => <RiskBadge level={info.getValue()} />,
    filterFn: (row, _columnId, filterValue: string[]) => {
      if (!filterValue || filterValue.length === 0) return true;
      return filterValue.includes(row.original.riskLevel);
    },
  }),
  col.accessor('propsCount', {
    header: 'Props',
    cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
  }),
  col.accessor('hookCount', {
    header: 'Hooks',
    cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
  }),
  col.accessor('maxDrillingDepth', {
    header: 'Depth',
    cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
  }),
  col.accessor('childComponentCount', {
    header: 'Children',
    cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
  }),
];
