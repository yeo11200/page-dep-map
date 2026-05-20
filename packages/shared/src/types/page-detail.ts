import type { RiskLevel } from './common.js';
import type { LikelyIssue } from './rules.js';

/** 페이지가 직접 받는 개별 prop 정보 */
export interface DirectProp {
  name: string;
  required: boolean;
  type?: string;
}

/** prop이 컴포넌트 트리를 따라 전달되는 흐름 */
export interface PropFlow {
  propName: string;
  sourceComponent: string;
  targetPath: string[];
  depth: number;
  isPassThroughOnly: boolean;
  isUnusedCandidate: boolean;
}

/** 가장 깊게 전달되는 prop 정보 */
export interface DeepestProp {
  name: string;
  depth: number;
  path: string[];
}

/** 페이지의 정량적 메트릭 */
export interface PageMetrics {
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
 * 페이지별 상세 분석 결과.
 * Page Detail 화면에서 사용된다.
 */
export interface PageDetail {
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
  metrics: PageMetrics;
}
