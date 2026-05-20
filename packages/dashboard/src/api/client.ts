import type { ProjectSummary, PageSummary, PageDetail } from '@page-dep-map/shared';
import type { DependencyReport } from '@/types/dependency-report';

const isDev = import.meta.env.DEV;

async function fetchJSON<T>(path: string): Promise<T> {
  const url = isDev ? `/mock${path}.json` : `/api${path}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export function fetchSummary(): Promise<ProjectSummary> {
  return fetchJSON<ProjectSummary>('/summary');
}

export function fetchPages(): Promise<PageSummary[]> {
  return fetchJSON<PageSummary[]>('/pages');
}

export function fetchPageDetail(slug: string): Promise<PageDetail> {
  return fetchJSON<PageDetail>(`/pages/${slug}`);
}

export function fetchDependencyReport(): Promise<DependencyReport> {
  return fetchJSON<DependencyReport>('/dependency-report');
}
