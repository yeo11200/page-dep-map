import type { ProjectSummary, PageDetail } from '@page-dep-map/shared';

/**
 * 전체 프로젝트 분석 결과를 ProjectSummary로 조립한다.
 * Overview 대시보드 화면에서 사용된다.
 */
export function buildSummary(pages: PageDetail[]): ProjectSummary {
  const total = pages.length;

  if (total === 0) {
    return {
      totalPages: 0,
      avgComplexityScore: 0,
      criticalPages: 0,
      warningPages: 0,
      avgPropsCount: 0,
      avgDrillingDepth: 0,
      avgHookCount: 0,
      topRiskPages: [],
      updatedAt: new Date().toISOString(),
    };
  }

  const criticalPages = pages.filter(
    (p) => p.metrics.riskLevel === 'critical',
  ).length;
  const warningPages = pages.filter(
    (p) => p.metrics.riskLevel === 'warning',
  ).length;

  const sum = (fn: (p: PageDetail) => number) =>
    pages.reduce((acc, p) => acc + fn(p), 0);

  const avgComplexityScore =
    Math.round((sum((p) => p.metrics.complexityScore) / total) * 10) / 10;
  const avgPropsCount =
    Math.round((sum((p) => p.metrics.propsCount) / total) * 10) / 10;
  const avgDrillingDepth =
    Math.round((sum((p) => p.metrics.maxDrillingDepth) / total) * 10) / 10;
  const avgHookCount =
    Math.round((sum((p) => p.metrics.hookCount) / total) * 10) / 10;

  // Top risk pages: sorted by complexity score desc, top 5
  const topRiskPages = [...pages]
    .sort(
      (a, b) => b.metrics.complexityScore - a.metrics.complexityScore,
    )
    .slice(0, 5)
    .map((p) => p.pageName);

  return {
    totalPages: total,
    avgComplexityScore,
    criticalPages,
    warningPages,
    avgPropsCount,
    avgDrillingDepth,
    avgHookCount,
    topRiskPages,
    updatedAt: new Date().toISOString(),
  };
}
