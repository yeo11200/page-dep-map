---
name: dashboard-guide
description: "Page Dependency Map의 대시보드 UI(packages/dashboard) 구현 가이드. React + Vite + shadcn/ui + TanStack Table + Recharts 기반 3개 화면 구현 절차를 정의한다. dashboard-engineer 에이전트가 참조한다."
user-invocable: false
---

# Dashboard Guide

packages/dashboard 패키지의 구현 절차를 정의한다.

## 구현 순서

1. Vite + React + TypeScript 프로젝트 설정
2. shadcn/ui 초기화 + Tailwind CSS 설정
3. 레이아웃 (AppLayout, Sidebar, Header)
4. API 클라이언트 + TanStack Query hooks
5. Overview 화면
6. Page List 화면 (TanStack Table)
7. Page Detail 화면 (7개 섹션)
8. 공유 컴포넌트 (RiskBadge, SeverityBadge, ScoreBar)

## API 연결

대시보드는 CLI의 Express 서버가 제공하는 API를 사용한다:

```
GET /api/summary     → ProjectSummary
GET /api/pages       → PageSummary[]
GET /api/pages/:name → PageDetail
```

### 개발 중 Mock 데이터

실제 API가 준비되기 전에 mock JSON으로 개발한다:

```ts
// src/api/client.ts
const BASE_URL = import.meta.env.DEV
  ? '/mock'            // 개발 시 public/mock/ 의 JSON 파일
  : '/api';            // 프로덕션 시 Express API
```

`public/mock/` 디렉토리에 mock JSON 파일을 배치하여 Vite dev server가 서빙.

## 화면별 구현 상세

### Overview (PRD 7.5)

| 컴포넌트 | 내용 |
|---------|------|
| StatGrid | 총 페이지, 평균 complexity, warning 수, critical 수 |
| RiskDistribution | 도넛 차트 — healthy/moderate/warning/critical 분포 (Recharts PieChart) |
| TopRiskPages | 상위 5개 risk 페이지 카드 (pageName, score, riskLevel, route) |

### Page List (PRD 7.6)

TanStack Table 기반. 주요 기능:

- **컬럼**: pageName, routePath, complexityScore, riskLevel, propsCount, queryCount, hookCount, effectCount, maxDrillingDepth, passThroughPropsCount
- **정렬**: 모든 숫자 컬럼에 클릭 정렬 (asc/desc 토글)
- **검색**: pageName, routePath 텍스트 검색 (column filter)
- **필터**: riskLevel 멀티셀렉트, complexityScore 범위 슬라이더
- **행 클릭**: Page Detail로 이동 (`/pages/:pageName`)

### Page Detail (PRD 7.7)

7개 섹션을 탭 또는 스크롤 섹션으로 구성:

1. **Summary** — pageName, filePath, routePath, complexityScore, riskLevel 배지
2. **Direct Props** — 테이블 (name, required 배지, type)
3. **Dependencies** — hooks/queries/stores/contexts/sharedModules를 카테고리별 태그 목록
4. **Prop Flow** — 테이블 (propName, targetPath, depth, isPassThrough 배지)
5. **Deepest Props** — path 시각화 (breadcrumb 스타일)
6. **Derived Data** — derivedDataProps 목록
7. **Likely Issues** — severity별 카드 (SeverityBadge + 메시지)
8. **Metrics** — 전체 수치 지표 그리드 (2~3열)

## 컬러 시스템

```ts
export const RISK_COLORS = {
  healthy: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  moderate: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  warning: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
  critical: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
} as const;

export const SEVERITY_COLORS = {
  critical: { bg: 'bg-red-100', text: 'text-red-700' },
  warning: { bg: 'bg-orange-100', text: 'text-orange-700' },
  info: { bg: 'bg-blue-100', text: 'text-blue-700' },
} as const;
```

## Vite 설정

```ts
// vite.config.ts
export default defineConfig({
  base: './',  // 상대 경로 — Express에서 서브패스 서빙 가능
  plugins: [react()],
});
```

## 완료 기준

- [ ] 3개 화면 모두 렌더링 성공 (Overview, List, Detail)
- [ ] TanStack Table 정렬/검색/필터 동작
- [ ] Page List에서 행 클릭 → Page Detail 이동
- [ ] risk level, severity 별 컬러 표시
- [ ] mock 데이터 기반 전체 UI 동작
- [ ] `vite build` 성공
- [ ] 반응형 레이아웃 (최소 1024px 이상)
