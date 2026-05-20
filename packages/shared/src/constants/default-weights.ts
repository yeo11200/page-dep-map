import type { Weights } from '../types/scoring.js';

/** SPEC 섹션 2.2에 정의된 기본 가중치 */
export const DEFAULT_WEIGHTS: Weights = {
  propsCount: 1,
  requiredPropsCount: 1,
  maxDrillingDepth: 3,
  passThroughPropsCount: 3,
  hookCount: 1,
  queryCount: 2,
  storeContextUsageCount: 2,
  effectCount: 3,
  conditionalBranchCount: 1,
  childComponentCount: 1,
  derivedDataPropCount: 2,
  sharedDependencyCount: 1,
} as const satisfies Weights;
