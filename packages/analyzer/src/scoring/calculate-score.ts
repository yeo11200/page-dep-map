import type { Weights } from '@page-dep-map/shared';
import { DEFAULT_WEIGHTS } from '@page-dep-map/shared';

/**
 * 분석 메트릭 입력 — 스코어 계산에 필요한 값들.
 */
export interface ScoreInput {
  propsCount: number;
  requiredPropsCount: number;
  maxDrillingDepth: number;
  passThroughPropsCount: number;
  hookCount: number;
  queryCount: number;
  storeUsageCount: number;
  contextUsageCount: number;
  effectCount: number;
  conditionalBranchCount: number;
  childComponentCount: number;
  derivedDataPropCount: number;
  sharedDependencyCount: number;
}

/**
 * Complexity score를 계산한다.
 * SPEC 2.1 — 기본 점수식.
 *
 * storeContextUsageCount = storeUsageCount + contextUsageCount (합산)
 * 각 메트릭 × 해당 가중치의 합.
 */
export function calculateScore(
  input: ScoreInput,
  weights?: Partial<Weights>,
): number {
  const w: Weights = { ...DEFAULT_WEIGHTS, ...weights };

  return (
    input.propsCount * w.propsCount +
    input.requiredPropsCount * w.requiredPropsCount +
    input.maxDrillingDepth * w.maxDrillingDepth +
    input.passThroughPropsCount * w.passThroughPropsCount +
    input.hookCount * w.hookCount +
    input.queryCount * w.queryCount +
    (input.storeUsageCount + input.contextUsageCount) *
      w.storeContextUsageCount +
    input.effectCount * w.effectCount +
    input.conditionalBranchCount * w.conditionalBranchCount +
    input.childComponentCount * w.childComponentCount +
    input.derivedDataPropCount * w.derivedDataPropCount +
    input.sharedDependencyCount * w.sharedDependencyCount
  );
}
