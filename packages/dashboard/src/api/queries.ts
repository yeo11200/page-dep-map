import { useQuery } from '@tanstack/react-query';
import type { ProjectSummary, PageSummary, PageDetail } from '@page-dep-map/shared';
import type { DependencyReport } from '@/types/dependency-report';
import { fetchSummary, fetchPages, fetchPageDetail, fetchDependencyReport } from './client';

export function useSummary() {
  return useQuery<ProjectSummary>({
    queryKey: ['summary'],
    queryFn: fetchSummary,
  });
}

export function usePages() {
  return useQuery<PageSummary[]>({
    queryKey: ['pages'],
    queryFn: fetchPages,
  });
}

export function usePageDetail(pageName: string) {
  return useQuery<PageDetail>({
    queryKey: ['page-detail', pageName],
    queryFn: () => fetchPageDetail(pageName),
    enabled: !!pageName,
  });
}

export function useDependencyReport() {
  return useQuery<DependencyReport>({
    queryKey: ['dependency-report'],
    queryFn: fetchDependencyReport,
    retry: false,
  });
}
