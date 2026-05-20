# FILE-TREE.md — 상세 프로젝트 구조

## 배포 형태

Single NPM package — `page-dep-map`

```
npx page-dep-map ./src
npx page-dep-map analyze ./src -o ./out
npx page-dep-map serve ./out
```

---

## 전체 구조

```
page-dep-map/
├── package.json                    # root monorepo
├── pnpm-workspace.yaml
├── tsconfig.base.json              # 공유 TS 설정
├── README.md
├── LICENSE
│
├── vitest.config.ts                # 공유 vitest 설정
├── packages/
│   ├── shared/                     # 공유 타입 + 설정 스키마
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── types/
│   │       │   ├── project-summary.ts    # ProjectSummary interface
│   │       │   ├── page-summary.ts       # PageSummary interface
│   │       │   ├── page-detail.ts        # PageDetail interface
│   │       │   ├── config.ts             # Config interface
│   │       │   ├── scoring.ts            # Weights, Thresholds types
│   │       │   └── rules.ts              # RuleDefinition, Severity types
│   │       ├── constants/
│   │       │   ├── default-weights.ts
│   │       │   ├── default-thresholds.ts
│   │       │   └── default-patterns.ts
│   │       └── utils/
│   │           └── route-path.ts         # 파일경로 → route path 변환
│   │
│   ├── analyzer/                   # 정적 분석 엔진
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   ├── __tests__/
│   │   │   ├── collect-pages.test.ts
│   │   │   ├── collect-props.test.ts
│   │   │   ├── collect-hooks.test.ts
│   │   │   ├── collect-prop-flows.test.ts
│   │   │   ├── calculate-score.test.ts
│   │   │   └── generate-issues.test.ts
│   │   └── src/
│   │       ├── index.ts                  # analyzeProject() 진입점
│   │       ├── project.ts                # ts-morph Project 초기화
│   │       │
│   │       ├── collectors/
│   │       │   ├── collect-pages.ts      # 페이지 파일 탐색
│   │       │   ├── collect-props.ts      # props 추출 (required/optional/type)
│   │       │   ├── collect-hooks.ts      # hooks 분류 (query/store/context/effect/hook)
│   │       │   ├── collect-children.ts   # 자식 컴포넌트 식별
│   │       │   ├── collect-prop-flows.ts # prop 전달 추적 + pass-through 판별
│   │       │   ├── collect-derived.ts    # derived data props 탐지
│   │       │   ├── collect-shared.ts     # shared/common dependency 수집
│   │       │   └── collect-conditionals.ts # 조건 분기 카운팅
│   │       │
│   │       ├── scoring/
│   │       │   ├── calculate-score.ts    # complexity score 계산
│   │       │   └── risk-level.ts         # risk level 판정
│   │       │
│   │       ├── rules/
│   │       │   ├── generate-issues.ts    # likely issues 생성
│   │       │   ├── builtin-rules.ts      # 기본 규칙 정의
│   │       │   └── rule-engine.ts        # 규칙 평가 엔진
│   │       │
│   │       ├── output/
│   │       │   ├── build-summary.ts      # ProjectSummary 생성
│   │       │   ├── build-page-summary.ts # PageSummary 생성
│   │       │   ├── build-page-detail.ts  # PageDetail 생성
│   │       │   └── write-json.ts         # JSON 파일 출력
│   │       │
│   │       └── config/
│   │           ├── load-config.ts        # 설정 파일 로딩
│   │           ├── merge-config.ts       # 기본값 + 사용자 설정 병합
│   │           └── validate-config.ts    # 설정 유효성 검증
│   │
│   ├── cli/                        # CLI 진입점
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   └── src/
│   │       ├── index.ts                  # bin 진입점
│   │       ├── commands/
│   │       │   ├── analyze.ts            # analyze 커맨드
│   │       │   ├── serve.ts              # serve 커맨드
│   │       │   └── default.ts            # 기본 커맨드 (analyze + serve)
│   │       ├── server/
│   │       │   ├── create-server.ts      # express 서버 생성
│   │       │   └── api-routes.ts         # /api/summary, /api/pages, /api/pages/:name
│   │       └── utils/
│   │           ├── open-browser.ts       # 브라우저 자동 오픈
│   │           └── spinner.ts            # 진행률 표시
│   │
│   └── dashboard/                  # React SPA (Vite)
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── router.tsx                # React Router 설정
│           │
│           ├── api/
│           │   ├── client.ts             # fetch wrapper
│           │   ├── queries.ts            # TanStack Query hooks
│           │   └── types.ts              # API response types (re-export from shared)
│           │
│           ├── pages/
│           │   ├── OverviewPage.tsx       # Overview 화면
│           │   ├── PageListPage.tsx       # Page List 화면
│           │   └── PageDetailPage.tsx     # Page Detail 화면
│           │
│           ├── components/
│           │   ├── layout/
│           │   │   ├── AppLayout.tsx      # 메인 레이아웃 (sidebar + header)
│           │   │   ├── Sidebar.tsx
│           │   │   └── Header.tsx
│           │   │
│           │   ├── overview/
│           │   │   ├── StatCard.tsx       # 단일 지표 카드
│           │   │   ├── StatGrid.tsx       # 지표 카드 그리드
│           │   │   ├── RiskDistribution.tsx  # risk level 분포 차트
│           │   │   └── TopRiskPages.tsx   # 상위 risk 페이지 목록
│           │   │
│           │   ├── page-list/
│           │   │   ├── PageTable.tsx      # TanStack Table 메인
│           │   │   ├── PageTableColumns.tsx  # 컬럼 정의
│           │   │   ├── PageTableFilters.tsx  # 필터 UI
│           │   │   └── PageTableSearch.tsx   # 검색 UI
│           │   │
│           │   ├── page-detail/
│           │   │   ├── SummarySection.tsx     # 요약 정보
│           │   │   ├── DirectPropsSection.tsx # props 테이블
│           │   │   ├── DependenciesSection.tsx # hooks/queries/stores/contexts
│           │   │   ├── PropFlowSection.tsx    # prop flow 테이블
│           │   │   ├── DeepestPropsSection.tsx # 최심 props 경로
│           │   │   ├── DerivedDataSection.tsx  # 가공 데이터 목록
│           │   │   ├── LikelyIssuesSection.tsx # 이슈 카드
│           │   │   └── MetricsSection.tsx      # 전체 지표 그리드
│           │   │
│           │   └── shared/
│           │       ├── RiskBadge.tsx       # risk level 배지
│           │       ├── SeverityBadge.tsx   # issue severity 배지
│           │       ├── ScoreBar.tsx        # score 시각 바
│           │       └── EmptyState.tsx      # 데이터 없을 때 표시
│           │
│           ├── lib/
│           │   ├── utils.ts               # cn() 등 유틸
│           │   └── colors.ts              # risk level 컬러 맵
│           │
│           └── styles/
│               └── globals.css            # Tailwind + shadcn 기본 스타일
│
├── fixtures/                       # 테스트용 샘플 프로젝트
│   ├── simple-page/
│   │   └── app/
│   │       └── page.tsx                  # props 없는 단순 페이지
│   │
│   ├── props-drilling/
│   │   └── app/
│   │       ├── page.tsx                  # 3단계 drilling
│   │       ├── components/
│   │       │   ├── Parent.tsx
│   │       │   ├── Middle.tsx
│   │       │   └── Child.tsx
│   │
│   ├── heavy-queries/
│   │   └── app/
│   │       └── users/
│   │           └── page.tsx              # query 5개 + child 8개
│   │
│   ├── spread-props/
│   │   └── app/
│   │       └── page.tsx                  # {...props} 사용
│   │
│   ├── app-router-project/
│   │   ├── tsconfig.json
│   │   └── app/
│   │       ├── page.tsx
│   │       ├── users/
│   │       │   ├── page.tsx
│   │       │   └── [id]/
│   │       │       └── page.tsx
│   │       └── (dashboard)/
│   │           └── settings/
│   │               └── page.tsx
│   │
│   └── pages-router-project/
│       ├── tsconfig.json
│       └── pages/
│           ├── index.tsx
│           ├── users/
│           │   ├── index.tsx
│           │   └── [id].tsx
│           └── settings.tsx
│
└── docs/
    ├── PLAN.md                     # 이 문서
    ├── SPEC.md                     # 분석 규칙 명세
    └── FILE-TREE.md                # 이 파일
```

---

## 패키지별 의존성

### Root devDependencies

```json
{
  "devDependencies": {
    "vitest": "^3.0.0",
    "typescript": "^5.7.0",
    "tsup": "^8.0.0"
  }
}
```

### packages/shared

```json
{
  "name": "@page-dep-map/shared",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" }
  },
  "dependencies": {}
}
```

### packages/analyzer

```json
{
  "name": "@page-dep-map/analyzer",
  "dependencies": {
    "@page-dep-map/shared": "workspace:*",
    "ts-morph": "^24.0.0",
    "fast-glob": "^3.3.0"
  }
}
```

### packages/cli

```json
{
  "name": "page-dep-map",
  "bin": {
    "page-dep-map": "./dist/index.js"
  },
  "dependencies": {
    "@page-dep-map/analyzer": "workspace:*",
    "@page-dep-map/shared": "workspace:*",
    "commander": "^12.0.0",
    "express": "^4.21.0",
    "open": "^10.0.0",
    "ora": "^8.0.0",
    "chalk": "^5.0.0"
  }
}
```

### packages/dashboard

```json
{
  "name": "@page-dep-map/dashboard",
  "dependencies": {
    "@page-dep-map/shared": "workspace:*",
    "@tanstack/react-query": "^5.0.0",
    "@tanstack/react-table": "^8.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "react-router-dom": "^6.0.0",
    "recharts": "^2.0.0"
  },
  "devDependencies": {
    "vite": "^6.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "tailwindcss": "^3.0.0",
    "autoprefixer": "^10.0.0",
    "postcss": "^8.0.0"
  }
}
```

---

## 빌드 파이프라인

```
1. shared     → tsc → dist/           (타입 + JS)
2. analyzer   → tsup → dist/          (번들링)
3. dashboard  → vite build → dist/    (정적 SPA)
4. cli        → tsup → dist/          (번들링, dashboard dist 포함)
```

### Dashboard Embedding Build Script

```json
// root package.json scripts
{
  "scripts": {
    "build": "pnpm -r build",
    "build:shared": "cd packages/shared && tsc",
    "build:analyzer": "cd packages/analyzer && tsup",
    "build:dashboard": "cd packages/dashboard && vite build",
    "build:cli": "cd packages/cli && tsup",
    "postbuild:dashboard": "cp -r packages/dashboard/dist packages/cli/dashboard",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

빌드 순서: shared → analyzer → dashboard → postbuild:dashboard (복사) → cli

### CLI 패키지의 dashboard 포함 방식

```ts
// cli/src/server/create-server.ts
import path from 'path';
import express from 'express';

export function createServer(analysisDir: string, port: number) {
  const app = express();

  // 정적 SPA 서빙 (빌드 시 dashboard dist를 cli에 복사)
  const dashboardDir = path.join(__dirname, '../dashboard');
  app.use(express.static(dashboardDir));

  // API 라우트
  app.get('/api/summary', (req, res) => {
    // analysisDir에서 project-summary.json 읽기
  });
  app.get('/api/pages', (req, res) => {
    // analysisDir에서 pages/*.json 목록
  });
  app.get('/api/pages/:name', (req, res) => {
    // analysisDir에서 pages/{name}.json 읽기
  });

  // SPA fallback
  app.get('*', (req, res) => {
    res.sendFile(path.join(dashboardDir, 'index.html'));
  });

  return app;
}
```

---

## 설정 파일 위치

분석 대상 프로젝트 루트에 배치:

```
target-project/
├── page-dep-map.config.ts    # TypeScript 설정 (권장)
├── page-dep-map.config.js    # JavaScript 설정
├── .pagedeprc.json            # JSON 설정
└── package.json               # "pageDepMap" 필드도 지원
```

로딩 우선순위:
1. `--config` CLI 플래그
2. `page-dep-map.config.ts`
3. `page-dep-map.config.js`
4. `.pagedeprc.json`
5. `package.json`의 `"pageDepMap"` 필드
6. 기본값

---

## 출력 구조

```
page-dep-map-output/             # 기본 출력 디렉토리
├── project-summary.json         # ProjectSummary
└── pages/
    ├── UserDetailPage.json      # PageDetail
    ├── BillingHistoryPage.json
    ├── DashboardPage.json
    └── SettingsPage.json
```
