import type { PageSummary, PageDetail } from '@page-dep-map/shared';

/**
 * PageDetail → PageSummary 변환.
 * Page List 테이블에 표시할 요약 정보를 추출한다.
 */
export function buildPageSummary(detail: PageDetail): PageSummary {
  return {
    pageName: detail.pageName,
    filePath: detail.filePath,
    routePath: detail.routePath,
    complexityScore: detail.metrics.complexityScore,
    riskLevel: detail.metrics.riskLevel,
    propsCount: detail.metrics.propsCount,
    requiredPropsCount: detail.metrics.requiredPropsCount,
    optionalPropsCount: detail.metrics.optionalPropsCount,
    queryCount: detail.metrics.queryCount,
    storeUsageCount: detail.metrics.storeUsageCount,
    contextUsageCount: detail.metrics.contextUsageCount,
    hookCount: detail.metrics.hookCount,
    effectCount: detail.metrics.effectCount,
    conditionalBranchCount: detail.metrics.conditionalBranchCount,
    childComponentCount: detail.metrics.childComponentCount,
    maxDrillingDepth: detail.metrics.maxDrillingDepth,
    passThroughPropsCount: detail.metrics.passThroughPropsCount,
    derivedDataPropCount: detail.metrics.derivedDataPropCount,
    sharedDependencyCount: detail.metrics.sharedDependencyCount,
    deepestPropNames: detail.deepestProps.map((p) => p.name),
    unusedCandidateProps: detail.propFlows
      .filter((f) => f.isUnusedCandidate)
      .map((f) => f.propName),
    mainDependencyModules: detail.sharedModules,
    likelyIssues: detail.likelyIssues.map((i) => i.message),
  };
}
