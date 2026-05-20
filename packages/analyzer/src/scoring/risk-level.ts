import type { RiskLevel, Thresholds } from '@page-dep-map/shared';
import { DEFAULT_THRESHOLDS } from '@page-dep-map/shared';

/**
 * Complexity score로부터 Risk Level을 판정한다.
 * SPEC 2.4 — Risk Level 판정.
 *
 * score >= critical → 'critical'
 * score >= warning  → 'warning'
 * score >= moderate → 'moderate'
 * 그 외             → 'healthy'
 */
export function getRiskLevel(
  score: number,
  thresholds?: Partial<Thresholds>,
): RiskLevel {
  const t: Thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };

  if (score >= t.critical) return 'critical';
  if (score >= t.warning) return 'warning';
  if (score >= t.moderate) return 'moderate';
  return 'healthy';
}
