import type {
  PageSummary,
  LikelyIssue,
  RulesConfig,
  BuiltinRuleOverride,
  CustomRuleDefinition,
  BuiltinRuleId,
} from '@page-dep-map/shared';
import { BUILTIN_RULES } from './builtin-rules.js';

/**
 * 규칙 평가 순서 (SPEC 3.4):
 * 1. 기본 규칙을 모두 평가
 * 2. 설정 파일의 threshold 오버라이드 적용
 * 3. enabled: false 규칙 제거
 * 4. 커스텀 규칙 평가하여 추가
 * 5. severity 순서로 정렬 (critical → warning → info)
 */
export function evaluateRules(
  page: PageSummary,
  rulesConfig?: RulesConfig,
  spreadPropsDetected?: boolean,
): LikelyIssue[] {
  const issues: LikelyIssue[] = [];

  // Step 1 & 2: Evaluate built-in rules with optional threshold overrides
  for (const rule of BUILTIN_RULES) {
    // Step 3: Check if rule is disabled
    const override = rulesConfig?.[rule.id] as
      | BuiltinRuleOverride
      | undefined;
    if (override?.enabled === false) continue;

    // Special case: SPREAD_DETECTED uses a separate flag
    if (rule.id === 'SPREAD_DETECTED') {
      if (spreadPropsDetected) {
        issues.push({
          id: rule.id,
          severity: rule.severity,
          message: rule.message(page),
        });
      }
      continue;
    }

    // Determine threshold
    const threshold = override?.threshold ?? rule.defaultThreshold;

    // Evaluate condition
    if (rule.condition(page, threshold)) {
      issues.push({
        id: rule.id,
        severity: rule.severity,
        message: rule.message(page),
      });
    }
  }

  // Step 4: Evaluate custom rules
  const customRules = rulesConfig?.custom as
    | CustomRuleDefinition[]
    | undefined;
  if (customRules) {
    for (const custom of customRules) {
      if (custom.condition(page)) {
        issues.push({
          id: custom.id,
          severity: custom.severity,
          message: custom.message(page),
        });
      }
    }
  }

  // Step 5: Sort by severity (critical → warning → info)
  const severityOrder: Record<string, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  issues.sort(
    (a, b) =>
      (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99),
  );

  return issues;
}
