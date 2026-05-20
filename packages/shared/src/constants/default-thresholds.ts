import type { Thresholds } from '../types/scoring.js';

/** SPEC 섹션 2.4에 정의된 기본 임계값 */
export const DEFAULT_THRESHOLDS: Thresholds = {
  moderate: 20,
  warning: 40,
  critical: 60,
} as const satisfies Thresholds;
