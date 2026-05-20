# PRD — Page Dependency Map Dashboard

## 프로젝트명

**Page Dependency Map Dashboard**

## 문서 버전

v1.0

## 문서 목적

프론트엔드 코드베이스의 페이지별 구조 복잡도와 데이터 의존성을 자동 분석하고, 이를 대시보드 형태로 시각화하여 **리팩토링 우선순위 식별**, **props drilling 탐지**, **구조적 리스크 가시화**를 가능하게 한다.

---

# 1. Problem Statement

현재 프론트엔드 코드베이스에서 페이지별 구조 복잡도와 데이터 흐름을 직관적으로 파악하기 어렵다.

다음과 같은 문제가 존재한다.

* 어떤 페이지가 가장 복잡한지 감으로만 판단한다.
* props drilling이 발생하는 구간을 체계적으로 파악하지 못한다.
* 상위 컴포넌트가 과도하게 데이터 가공 책임을 가지는지 정량적으로 보지 못한다.
* query/state/context/effect 사용이 과도한 페이지를 빠르게 식별하기 어렵다.
* 리팩토링 우선순위가 주관적 판단에 의존한다.
* 신규 입사자나 팀원이 페이지 구조를 이해하는 데 시간이 많이 든다.

---

# 2. Goal

1. 페이지별 구조 정보를 자동 수집한다.
2. 페이지별 complexity score를 계산한다.
3. props drilling, pass-through props, effect/query/state 과다 사용 등 구조적 리스크를 식별한다.
4. 대시보드에서 전체/페이지별 구조 상태를 한눈에 볼 수 있게 한다.
5. 리팩토링 후보 페이지를 우선순위 기준으로 도출한다.

---

# 3. Non-Goal (MVP)

* 런타임 성능 측정
* 실제 사용자 트래픽 기반 관측
* 실시간 모니터링
* PR/GitHub 변경 이력 연동
* ESLint 플러그인 제작
* 자동 리팩토링 코드 수정
* 모든 코드 패턴에 대한 완전한 AST 정확도 보장
* dynamic import, HOC, render prop, metaprogramming 등 고난도 케이스의 완벽 지원

---

# 4. Target Users

**Primary:** 프론트엔드 개발자, 프론트엔드 리드, 아키텍처/플랫폼 담당자
**Secondary:** 신규 입사자, 코드리뷰어, 기술 부채 관리 담당자

---

# 5. Distribution Format

**Single NPM package with CLI + embedded dashboard**

```bash
npx page-dep-map ./src                    # analyze + auto-open dashboard
npx page-dep-map analyze ./src -o ./out   # JSON output only
npx page-dep-map serve ./out              # serve existing results
```

---

# 6. Functional Requirements

## 6.1 정적 분석기

각 페이지마다 추출:
- 페이지 이름, 파일 경로, route path 추정값
- 직접 받는 props (required / optional)
- 내부 hooks, queries, stores, contexts
- 자식 컴포넌트 목록
- 하위로 전달하는 props, pass-through props 후보
- 최대 drilling depth, 가장 깊게 전달되는 prop
- 주요 의존 모듈
- effect 수, 조건 분기 수, 하위 컴포넌트 수
- derived data props 후보, shared/common component 의존 수

## 6.2 Complexity Score

설정 가능한 가중치 기반 점수 계산.
Risk Level: healthy(0~19), moderate(20~39), warning(40~59), critical(60+).

## 6.3 Likely Issues

규칙 기반 자동 생성 (drilling depth, pass-through, effect 과다, data orchestration 등).

## 6.4 Dashboard

MVP 화면:
1. **Overview** — 전체 코드베이스 상태 요약
2. **Page List** — 정렬/검색/필터 가능한 페이지 테이블
3. **Page Detail** — 구조 세부 정보 (props, dependencies, prop flows, issues)

## 6.5 데이터 Export

분석 결과를 JSON으로 export.

---

# 7. Data Model

## ProjectSummary

```ts
interface ProjectSummary {
  totalPages: number;
  avgComplexityScore: number;
  criticalPages: number;
  warningPages: number;
  avgPropsCount: number;
  avgDrillingDepth: number;
  avgHookCount: number;
  topRiskPages: string[];
  updatedAt: string;
}
```

## PageSummary

```ts
interface PageSummary {
  pageName: string;
  filePath: string;
  routePath?: string;
  complexityScore: number;
  riskLevel: 'healthy' | 'moderate' | 'warning' | 'critical';
  propsCount: number;
  requiredPropsCount: number;
  optionalPropsCount: number;
  queryCount: number;
  storeUsageCount: number;
  contextUsageCount: number;
  hookCount: number;
  effectCount: number;
  conditionalBranchCount: number;
  childComponentCount: number;
  maxDrillingDepth: number;
  passThroughPropsCount: number;
  derivedDataPropCount: number;
  sharedDependencyCount: number;
  deepestPropNames: string[];
  unusedCandidateProps: string[];
  mainDependencyModules: string[];
  likelyIssues: string[];
}
```

## PageDetail

```ts
interface PageDetail {
  pageName: string;
  filePath: string;
  routePath?: string;
  directProps: Array<{
    name: string;
    required: boolean;
    type?: string;
  }>;
  hooks: string[];
  queries: string[];
  stores: string[];
  contexts: string[];
  sharedModules: string[];
  childComponents: string[];
  propFlows: Array<{
    propName: string;
    sourceComponent: string;
    targetPath: string[];
    depth: number;
    isPassThroughOnly: boolean;
    isUnusedCandidate: boolean;
  }>;
  deepestProps: Array<{
    name: string;
    depth: number;
    path: string[];
  }>;
  derivedDataProps: string[];
  likelyIssues: Array<{
    id: string;
    severity: 'critical' | 'warning' | 'info';
    message: string;
  }>;
  metrics: {
    complexityScore: number;
    riskLevel: 'healthy' | 'moderate' | 'warning' | 'critical';
    propsCount: number;
    requiredPropsCount: number;
    optionalPropsCount: number;
    queryCount: number;
    storeUsageCount: number;
    contextUsageCount: number;
    hookCount: number;
    effectCount: number;
    conditionalBranchCount: number;
    childComponentCount: number;
    maxDrillingDepth: number;
    passThroughPropsCount: number;
    derivedDataPropCount: number;
    sharedDependencyCount: number;
  };
}
```

---

# 8. Tech Stack

- **Analyzer:** TypeScript + ts-morph + Node.js
- **Dashboard:** React + Vite + TanStack Table + Recharts + shadcn/ui
- **CLI:** Commander.js + Express (embedded server)
- **Build:** pnpm workspace monorepo

---

# 9. Acceptance Criteria

## AC-01
Given 분석 대상 프로젝트가 존재할 때
When 분석기를 실행하면
Then 페이지 목록과 페이지별 summary JSON이 생성되어야 한다.

## AC-02
Given 특정 페이지가 props drilling depth 3 이상일 때
When 분석 결과를 확인하면
Then 해당 페이지의 max drilling depth가 3 이상으로 기록되어야 하고 likely issue가 생성되어야 한다.

## AC-03
Given 특정 페이지에 query/state/effect 사용이 존재할 때
When Page Detail 화면에 진입하면
Then 해당 의존성이 각각 표시되어야 한다.

## AC-04
Given 사용자가 Page List에서 complexity score 기준 정렬을 선택할 때
When 정렬이 적용되면
Then complexity score 내림차순으로 페이지가 보여야 한다.

## AC-05
Given 사용자가 특정 페이지를 클릭할 때
When 상세 화면으로 이동하면
Then props, dependencies, prop flows, likely issues를 볼 수 있어야 한다.

---

# 10. Definition of Done

1. 프로젝트 소스코드를 분석해 페이지 목록을 식별할 수 있다.
2. 페이지별 summary/detail JSON이 생성된다.
3. complexity score가 계산된다.
4. likely issues가 생성된다.
5. Overview/Page List/Page Detail 화면이 동작한다.
6. 최소 1개 샘플 프로젝트에서 정상 동작한다.
7. README에 실행 방법과 한계가 문서화된다.

---

# 10. Related Documents

- `PLAN.md` — 구현 계획 (Day 1~5, 모듈 구조, 테스트 전략)
- `SPEC.md` — 분석 규칙 명세 (AST 수집, 스코어링, 이슈 규칙)
- `FILE-TREE.md` — 상세 프로젝트 파일 구조
