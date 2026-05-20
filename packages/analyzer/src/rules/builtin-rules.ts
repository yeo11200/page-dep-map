import type {
  BuiltinRuleId,
  RuleSeverity,
  PageSummary,
} from '@page-dep-map/shared';

/**
 * 내장 규칙 정의.
 * SPEC 3.1 — 12개 규칙.
 */
export interface BuiltinRule {
  id: BuiltinRuleId;
  severity: RuleSeverity;
  /** 기본 threshold (조건에 사용되는 값). 설정에서 오버라이드 가능. */
  defaultThreshold?: number;
  condition: (page: PageSummary, threshold?: number) => boolean;
  message: (page: PageSummary) => string;
}

export const BUILTIN_RULES: BuiltinRule[] = [
  {
    id: 'DRILL_DEEP',
    severity: 'warning',
    defaultThreshold: 3,
    condition: (page, threshold = 3) => page.maxDrillingDepth >= threshold,
    message: (page) =>
      `props drilling depth가 ${page.maxDrillingDepth}단계로 높습니다. Context 또는 composition 패턴 검토를 권장합니다.`,
  },
  {
    id: 'PASS_THROUGH',
    severity: 'warning',
    defaultThreshold: 2,
    condition: (page, threshold = 2) =>
      page.passThroughPropsCount >= threshold,
    message: (page) =>
      `중간 전달만 하는 props가 ${page.passThroughPropsCount}개입니다. 하위 컴포넌트가 직접 데이터를 가져오는 것을 검토하세요.`,
  },
  {
    id: 'EFFECT_HEAVY',
    severity: 'warning',
    defaultThreshold: 4,
    condition: (page, threshold = 4) => page.effectCount >= threshold,
    message: (page) =>
      `useEffect가 ${page.effectCount}개로 사이드이펙트 복잡도가 높습니다. custom hook 분리를 검토하세요.`,
  },
  {
    id: 'DATA_ORCHESTRATOR',
    severity: 'critical',
    condition: (page) =>
      page.queryCount >= 3 && page.childComponentCount >= 6,
    message: (page) =>
      `쿼리 ${page.queryCount}개 + 자식 ${page.childComponentCount}개로, 페이지가 데이터 orchestration 책임을 과도하게 가질 수 있습니다.`,
  },
  {
    id: 'DERIVED_HEAVY',
    severity: 'info',
    defaultThreshold: 2,
    condition: (page, threshold = 2) =>
      page.derivedDataPropCount >= threshold,
    message: (page) =>
      `상위에서 가공된 데이터 전달이 ${page.derivedDataPropCount}개입니다. 하위 컴포넌트의 책임 경계 재검토가 필요합니다.`,
  },
  {
    id: 'SHARED_HEAVY',
    severity: 'info',
    defaultThreshold: 10,
    condition: (page, threshold = 10) =>
      page.sharedDependencyCount >= threshold,
    message: (page) =>
      `공통 모듈 의존이 ${page.sharedDependencyCount}개입니다. 변경 시 영향도 확인이 필요합니다.`,
  },
  {
    id: 'MANY_PROPS',
    severity: 'warning',
    defaultThreshold: 10,
    condition: (page, threshold = 10) => page.propsCount >= threshold,
    message: (page) =>
      `props가 ${page.propsCount}개로 인터페이스가 복잡합니다. 객체 grouping 또는 분리를 검토하세요.`,
  },
  {
    id: 'MANY_REQUIRED',
    severity: 'warning',
    defaultThreshold: 8,
    condition: (page, threshold = 8) =>
      page.requiredPropsCount >= threshold,
    message: (page) =>
      `필수 props가 ${page.requiredPropsCount}개로 결합도가 높습니다.`,
  },
  {
    id: 'SPREAD_DETECTED',
    severity: 'info',
    condition: (_page) => false, // Evaluated separately via spreadPropsDetected flag
    message: () =>
      `spread props ({...props})가 사용되어 정확한 prop flow 추적이 제한됩니다.`,
  },
  {
    id: 'MANY_CONDITIONS',
    severity: 'warning',
    defaultThreshold: 8,
    condition: (page, threshold = 8) =>
      page.conditionalBranchCount >= threshold,
    message: (page) =>
      `조건 분기가 ${page.conditionalBranchCount}개로 인지 복잡도가 높습니다. 전략 패턴 또는 컴포넌트 분리를 검토하세요.`,
  },
  {
    id: 'EFFECT_NO_QUERY',
    severity: 'info',
    defaultThreshold: 3,
    condition: (page, threshold = 3) =>
      page.effectCount >= threshold && page.queryCount === 0,
    message: () =>
      `useEffect로 직접 데이터를 가져오고 있을 수 있습니다. React Query 도입을 검토하세요.`,
  },
  {
    id: 'STORE_AND_PROPS',
    severity: 'info',
    condition: (page) =>
      page.storeUsageCount + page.contextUsageCount >= 2 &&
      page.propsCount >= 5,
    message: () =>
      `전역 상태와 props를 동시에 많이 사용합니다. 데이터 소스가 혼재되어 추적이 어려울 수 있습니다.`,
  },
];
