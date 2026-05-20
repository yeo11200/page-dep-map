import type {
  PageDetail,
  PageMetrics,
  DirectProp,
  PropFlow,
  DeepestProp,
  LikelyIssue,
  RiskLevel,
} from '@page-dep-map/shared';

/** build-page-detail에 필요한 모든 분석 결과 */
export interface PageAnalysisData {
  pageName: string;
  filePath: string;
  routePath?: string;
  directProps: DirectProp[];
  hooks: string[];
  queries: string[];
  stores: string[];
  contexts: string[];
  sharedModules: string[];
  childComponents: string[];
  propFlows: PropFlow[];
  deepestProps: DeepestProp[];
  derivedDataProps: string[];
  likelyIssues: LikelyIssue[];
  // metrics
  complexityScore: number;
  riskLevel: RiskLevel;
  propsCount: number;
  requiredPropsCount: number;
  optionalPropsCount: number;
  queryCount: number;
  storeUsageCount: number;
  contextUsageCount: number;
  hookCount: number;
  effectCount: number;
  conditionalBranchCount: number;
  childComponentCount: number;
  maxDrillingDepth: number;
  passThroughPropsCount: number;
  derivedDataPropCount: number;
  sharedDependencyCount: number;
}

/**
 * 개별 페이지의 상세 분석 결과를 PageDetail 형태로 조립한다.
 */
export function buildPageDetail(data: PageAnalysisData): PageDetail {
  const metrics: PageMetrics = {
    complexityScore: data.complexityScore,
    riskLevel: data.riskLevel,
    propsCount: data.propsCount,
    requiredPropsCount: data.requiredPropsCount,
    optionalPropsCount: data.optionalPropsCount,
    queryCount: data.queryCount,
    storeUsageCount: data.storeUsageCount,
    contextUsageCount: data.contextUsageCount,
    hookCount: data.hookCount,
    effectCount: data.effectCount,
    conditionalBranchCount: data.conditionalBranchCount,
    childComponentCount: data.childComponentCount,
    maxDrillingDepth: data.maxDrillingDepth,
    passThroughPropsCount: data.passThroughPropsCount,
    derivedDataPropCount: data.derivedDataPropCount,
    sharedDependencyCount: data.sharedDependencyCount,
  };

  return {
    pageName: data.pageName,
    filePath: data.filePath,
    routePath: data.routePath,
    directProps: data.directProps,
    hooks: data.hooks,
    queries: data.queries,
    stores: data.stores,
    contexts: data.contexts,
    sharedModules: data.sharedModules,
    childComponents: data.childComponents,
    propFlows: data.propFlows,
    deepestProps: data.deepestProps,
    derivedDataProps: data.derivedDataProps,
    likelyIssues: data.likelyIssues,
    metrics,
  };
}
