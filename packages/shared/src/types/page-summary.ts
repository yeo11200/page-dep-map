import type { RiskLevel } from './common.js';

/**
 * 페이지별 분석 결과 요약.
 * Page List 테이블의 한 행에 해당한다.
 */
export interface PageSummary {
  pageName: string;
  filePath: string;
  routePath?: string;
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
  componentTreeDepth: number;
  maxDrillingDepth: number;
  passThroughPropsCount: number;
  derivedDataPropCount: number;
  sharedDependencyCount: number;
  deepestPropNames: string[];
  unusedCandidateProps: string[];
  mainDependencyModules: string[];
  likelyIssues: string[];
}
