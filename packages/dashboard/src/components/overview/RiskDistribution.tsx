import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { PageSummary, RiskLevel } from '@page-dep-map/shared';
import { RISK_COLORS } from '@/lib/colors';

interface RiskDistributionProps {
  pages: PageSummary[];
}

const RISK_ORDER: RiskLevel[] = ['healthy', 'moderate', 'warning', 'critical'];

export function RiskDistribution({ pages }: RiskDistributionProps) {
  const counts = RISK_ORDER.map((level) => ({
    name: level.charAt(0).toUpperCase() + level.slice(1),
    value: pages.filter((p) => p.riskLevel === level).length,
    level,
  })).filter((d) => d.value > 0);

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="text-sm font-medium text-muted-foreground">Risk Distribution</h3>
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={counts}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
            >
              {counts.map((entry) => (
                <Cell
                  key={entry.level}
                  fill={RISK_COLORS[entry.level].fill}
                  stroke="transparent"
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid hsl(var(--border))',
                backgroundColor: 'hsl(var(--card))',
                color: 'hsl(var(--card-foreground))',
              }}
              formatter={(value: number) => [`${value} pages`, '']}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
