import type { PageSummary } from './page-summary.js';

/** 이슈 규칙의 심각도 */
export type RuleSeverity = 'critical' | 'warning' | 'info';

/** 분석에서 탐지된 구조적 이슈 */
export interface LikelyIssue {
  id: string;
  severity: RuleSeverity;
  message: string;
}

/** SPEC 섹션 3.1에 정의된 내장 규칙 ID */
export type BuiltinRuleId =
  | 'DRILL_DEEP'
  | 'PASS_THROUGH'
  | 'EFFECT_HEAVY'
  | 'DATA_ORCHESTRATOR'
  | 'DERIVED_HEAVY'
  | 'SHARED_HEAVY'
  | 'MANY_PROPS'
  | 'MANY_REQUIRED'
  | 'SPREAD_DETECTED'
  | 'MANY_CONDITIONS'
  | 'EFFECT_NO_QUERY'
  | 'STORE_AND_PROPS';

/** 내장 규칙의 설정 오버라이드 */
export interface BuiltinRuleOverride {
  threshold?: number;
  enabled?: boolean;
}

/** 사용자 정의 커스텀 규칙 */
export interface CustomRuleDefinition {
  id: string;
  condition: (page: PageSummary) => boolean;
  message: (page: PageSummary) => string;
  severity: RuleSeverity;
}

/** 규칙 설정 전체 (내장 규칙 오버라이드 + 커스텀 규칙) */
export interface RulesConfig {
  [key: string]: BuiltinRuleOverride | CustomRuleDefinition[] | undefined;
  custom?: CustomRuleDefinition[];
}
