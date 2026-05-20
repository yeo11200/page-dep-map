/**
 * 페이지의 복잡도 수준을 나타내는 Risk Level.
 * complexity score 기반으로 판정된다.
 *
 * - healthy:  0~19
 * - moderate: 20~39
 * - warning:  40~59
 * - critical: 60+
 */
export type RiskLevel = 'healthy' | 'moderate' | 'warning' | 'critical';
