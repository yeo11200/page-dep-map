import { useQuery, useSuspenseQuery, useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { useContext, useEffect, useLayoutEffect } from 'react';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';
import { ThemeContext } from '@/contexts/theme';
import { Header } from '@/components/common/Header';
import { Sidebar } from '@/components/shared/Sidebar';
import { Footer } from '@/components/common/Footer';
import { Chart } from '@/components/ui/Chart';
import { DataTable } from '@/components/ui/DataTable';
import { StatCard } from '@/components/ui/StatCard';
import { FilterBar } from '@/components/common/FilterBar';
import { Pagination } from '@/components/ui/Pagination';
import { formatCurrency } from '@/utils/format';

interface DashboardPageProps {
  organizationId: string;
  dateRange: { start: string; end: string };
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  onExport: () => void;
  locale?: string;
  debug?: boolean;
  refreshInterval?: number;
  maxItems?: number;
  showSidebar?: boolean;
}

export default function DashboardPage({
  organizationId,
  dateRange,
  filters,
  onFilterChange,
  onExport,
  locale = 'ko',
  debug,
  refreshInterval = 30000,
  maxItems = 100,
  showSidebar = true,
}: DashboardPageProps) {
  const auth = useAuthStore((s) => s.user);
  const theme = useThemeStore((s) => s.theme);
  const themeCtx = useContext(ThemeContext);

  const { data: revenue } = useQuery({
    queryKey: ['revenue', organizationId, dateRange],
    queryFn: () => fetch(`/api/revenue?org=${organizationId}`).then(r => r.json()),
  });

  const { data: users } = useSuspenseQuery({
    queryKey: ['users', organizationId],
    queryFn: () => fetch(`/api/users?org=${organizationId}`).then(r => r.json()),
  });

  const { data: activities, fetchNextPage } = useInfiniteQuery({
    queryKey: ['activities', organizationId],
    queryFn: ({ pageParam }) => fetch(`/api/activities?page=${pageParam}`).then(r => r.json()),
    getNextPageParam: (last: any) => last.nextPage,
    initialPageParam: 1,
  });

  const { data: orders } = useQuery({
    queryKey: ['orders', organizationId, filters],
    queryFn: () => fetch(`/api/orders?org=${organizationId}`).then(r => r.json()),
  });

  const { data: metrics } = useQuery({
    queryKey: ['metrics', organizationId],
    queryFn: () => fetch(`/api/metrics?org=${organizationId}`).then(r => r.json()),
  });

  const exportMutation = useMutation({
    mutationFn: () => fetch('/api/export', { method: 'POST' }).then(r => r.json()),
  });

  useEffect(() => {
    document.title = `Dashboard - ${organizationId}`;
  }, [organizationId]);

  useEffect(() => {
    const timer = setInterval(() => {
      console.log('Refreshing...');
    }, refreshInterval);
    return () => clearInterval(timer);
  }, [refreshInterval]);

  useLayoutEffect(() => {
    document.body.classList.add('dashboard-layout');
    return () => document.body.classList.remove('dashboard-layout');
  }, []);

  useEffect(() => {
    if (debug) {
      console.log('Debug mode enabled');
    }
  }, [debug]);

  const formattedRevenue = revenue ? formatCurrency(revenue.total) : '...';
  const activeUsers = users?.filter((u: any) => u.active);
  const sortedOrders = orders?.sort((a: any, b: any) => b.date - a.date);

  return (
    <div>
      <Header />
      {showSidebar && <Sidebar />}
      <main>
        {auth ? (
          <div>
            <FilterBar filters={filters} onChange={onFilterChange} />
            <StatCard title="Revenue" value={formattedRevenue} />
            <StatCard title="Active Users" value={activeUsers?.length ?? 0} />
            {theme === 'dark' ? (
              <Chart data={revenue} dark />
            ) : (
              <Chart data={revenue} />
            )}
            {sortedOrders && sortedOrders.length > 0 ? (
              <DataTable rows={sortedOrders} maxItems={maxItems} />
            ) : (
              <p>No orders</p>
            )}
            <Pagination
              onNext={() => fetchNextPage()}
            />
            <button onClick={onExport}>Export</button>
          </div>
        ) : (
          <p>Please log in</p>
        )}
      </main>
      <Footer />
    </div>
  );
}
