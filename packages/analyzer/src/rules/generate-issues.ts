import type {
  PageSummary,
  LikelyIssue,
  RulesConfig,
} from '@page-dep-map/shared';
import { evaluateRules } from './rule-engine.js';

/**
 * PageSummary로부터 likely issues를 생성한다.
 * rule-engine을 호출하여 모든 규칙을 평가한다.
 */
export function generateIssues(
  page: PageSummary,
  rulesConfig?: RulesConfig,
  spreadPropsDetected?: boolean,
): LikelyIssue[] {
  return evaluateRules(page, rulesConfig, spreadPropsDetected);
}
