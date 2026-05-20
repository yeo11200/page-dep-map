/**
 * Complexity score 계산에 사용되는 가중치.
 * SPEC 섹션 2.2의 12개 메트릭 항목에 대응한다.
 */
export interface Weights {
  propsCount: number;
  requiredPropsCount: number;
  maxDrillingDepth: number;
  passThroughPropsCount: number;
  hookCount: number;
  queryCount: number;
  storeContextUsageCount: number;
  effectCount: number;
  conditionalBranchCount: number;
  childComponentCount: number;
  derivedDataPropCount: number;
  sharedDependencyCount: number;
}

/**
 * Risk Level 판정에 사용되는 임계값.
 * score >= critical → 'critical'
 * score >= warning  → 'warning'
 * score >= moderate → 'moderate'
 * 그 외             → 'healthy'
 */
export interface Thresholds {
  moderate: number;
  warning: number;
  critical: number;
}
