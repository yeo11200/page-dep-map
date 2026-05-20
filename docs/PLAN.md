# PLAN.md — Page Dependency Map Dashboard

## Distribution Format

Single NPM package with CLI + embedded dashboard.

```
npx page-dep-map ./src                    # analyze + auto-open dashboard
npx page-dep-map analyze ./src -o ./out   # JSON output only
npx page-dep-map serve ./out              # serve existing results
```

---

## Phase 1: Foundation (Day 1~2)

### Day 1: 프로젝트 초기화 + 분석기 코어

#### Tasks

1. **프로젝트 스캐폴딩**
   - monorepo 구조 (pnpm workspace)
   - TypeScript 설정 (shared tsconfig)
   - 공유 타입 패키지 생성

2. **페이지 탐색기 구현** (`collect-pages.ts`)
   - 설정 파일에서 page glob 패턴 읽기
   - Next.js App Router: `app/**/page.tsx`
   - Next.js Pages Router: `pages/**/*.tsx`
   - 커스텀 패턴 지원
   - route path 추정 로직

3. **Props 수집기 구현** (`collect-props.ts`)
   - ts-morph로 컴포넌트 함수 시그니처 파싱
   - interface/type alias에서 props 추출
   - required / optional 구분
   - type 문자열 추출

4. **Hooks 수집기 구현** (`collect-hooks.ts`)
   - `use*` 패턴 호출 식별
   - React Query hooks 분류 (`useQuery`, `useMutation`, `useSuspenseQuery`)
   - Zustand/Jotai store hooks 분류
   - Context hooks (`useContext`) 분류
   - `useEffect`/`useLayoutEffect` 카운팅
   - 커스텀 hook vs 라이브러리 hook 구분

#### DoD (Day 1)
- [ ] `pnpm dev` 로 전체 빌드 가능
- [ ] 샘플 프로젝트에서 페이지 목록 탐색 성공
- [ ] 페이지별 props, hooks, queries, stores, contexts, effects 수집 성공
- [ ] 공유 타입 패키지에서 import 가능

---

### Day 2: Prop Flow 추적 + 스코어링

#### Tasks

5. **자식 컴포넌트 수집기** (`collect-children.ts`)
   - JSX 내 컴포넌트 호출 식별
   - `<ComponentName />` 패턴 파싱
   - 로컬 vs import 컴포넌트 구분

6. **Prop Flow 추적기** (`collect-prop-flows.ts`)
   - 부모 → 자식 prop 전달 추적
   - 부모에서 사용하는 prop vs 전달만 하는 prop 구분
   - pass-through 판별: 부모가 읽지 않고 자식에게만 전달
   - drilling depth 계산 (기본 maxTraceDepth: 5, SPEC.md 1.5 참조)
   - deepest prop path 기록
   - spread props fallback: `{...props}` 패턴은 `passThroughCandidate` 플래그

7. **Derived Data Props 탐지** (`collect-derived-data.ts`)
   - 부모 컴포넌트 내 변수 할당 → 자식 prop으로 전달되는 패턴
   - `const x = a.b.c` → `<Child x={x} />` 패턴 감지
   - `useMemo`, 일반 변환 모두 포함

8. **Shared Dependencies 수집** (`collect-shared-deps.ts`)
   - import 경로에서 `common/`, `shared/`, `components/common` 등 패턴 매칭
   - 설정 파일로 패턴 커스터마이징 가능

9. **조건 분기 수집** (`collect-conditionals.ts`)
   - `if`, `switch`, ternary (`? :`), `&&` 패턴 카운팅
   - JSX 내부 조건 렌더링 포함

10. **Complexity Score 계산기** (`calculate-score.ts`)
    - SPEC.md 기반 가중치 적용
    - 설정 파일에서 가중치 오버라이드 가능
    - risk level 판정

11. **Likely Issues 생성기** (`generate-likely-issues.ts`)
    - SPEC.md 기반 규칙 적용
    - 커스텀 규칙 추가 가능

12. **JSON 출력기** (`output-json.ts`)
    - `project-summary.json` 생성
    - `pages/{pageName}.json` 생성
    - ProjectSummary, PageSummary, PageDetail 타입 준수

#### DoD (Day 2)
- [ ] 샘플 프로젝트에서 prop flow 추적 동작
- [ ] pass-through props 탐지 성공
- [ ] drilling depth 계산 정확
- [ ] complexity score 계산 완료
- [ ] likely issues 생성 완료
- [ ] JSON 파일 출력 성공
- [ ] project-summary.json + pages/*.json 스키마 검증 통과

---

## Phase 2: CLI + Dashboard (Day 3~4)

### Day 3: CLI 패키지 + Dashboard Overview/List

#### Tasks

13. **CLI 구현** (`cli/`)
    - `page-dep-map <dir>` : analyze + serve
    - `page-dep-map analyze <dir> -o <out>` : analyze only
    - `page-dep-map serve <dir>` : serve only
    - 옵션: `--port`, `--no-open`, `--config`
    - 설정 파일 로딩 (`page-dep-map.config.ts` or `.pagedeprc.json`)
    - 분석 진행률 표시 (ora spinner)

14. **Dashboard 서버** (`server/`)
    - 분석 완료 후 로컬 HTTP 서버 실행
    - pre-built SPA 정적 파일 서빙
    - `/api/summary` → project-summary.json
    - `/api/pages` → pages list
    - `/api/pages/:name` → page detail
    - 브라우저 자동 오픈

15. **Dashboard: Overview 화면**
    - 총 페이지 수, 평균 complexity, warning/critical 수
    - risk level 분포 차트 (도넛 or 바)
    - 상위 5 risk pages 카드
    - 평균 props/drilling/hooks 지표 카드

16. **Dashboard: Page List 화면**
    - TanStack Table 기반 테이블
    - 컬럼: pageName, routePath, complexityScore, riskLevel, propsCount, requiredPropsCount, queryCount, hookCount, effectCount, maxDrillingDepth, passThroughPropsCount
    - 정렬: 모든 숫자 컬럼 클릭 정렬
    - 검색: pageName / routePath 텍스트 검색
    - 필터: risk level 멀티셀렉트, complexity range 슬라이더
    - 행 클릭 → Page Detail 이동

#### DoD (Day 3)
- [ ] `npx page-dep-map analyze ./sample` 로 JSON 생성 성공
- [ ] `npx page-dep-map serve ./output` 로 대시보드 브라우저 오픈
- [ ] Overview 화면에서 전체 지표 표시
- [ ] Page List 에서 정렬/검색/필터 동작

---

### Day 4: Dashboard Page Detail + 마무리

#### Tasks

17. **Dashboard: Page Detail 화면**
    - Summary 섹션: name, path, route, score, risk badge
    - Direct Props 섹션: 테이블 (name, required, type)
    - Dependencies 섹션: hooks, queries, stores, contexts 목록
    - Prop Flow 섹션: flow 테이블 (propName, target, depth, passThrough 여부)
    - Deepest Props 섹션: path 시각화
    - Derived Data 섹션: 목록
    - Likely Issues 섹션: 카드 리스트 (severity + message)
    - Metrics 섹션: 모든 수치 지표 그리드

18. **Dashboard 스타일링**
    - shadcn/ui 기반 컴포넌트
    - risk level 컬러 체계: healthy(green), moderate(yellow), warning(orange), critical(red)
    - 반응형 레이아웃
    - 다크모드 지원

19. **설정 파일 구조 확정**
    - `page-dep-map.config.ts` 스키마
    - 가중치, threshold, page glob, shared dependency 패턴 등

#### DoD (Day 4)
- [ ] Page Detail 전체 섹션 렌더링 성공
- [ ] props, dependencies, prop flows, likely issues 모두 표시
- [ ] risk level 별 색상 표시
- [ ] 설정 파일로 가중치/threshold 변경 가능

---

## Phase 3: 통합 + 안정화 (Day 5)

### Day 5: 통합 테스트 + 문서화 + 빌드

#### Tasks

20. **샘플 프로젝트 검증**
    - 최소 1개 실제 Next.js 프로젝트에서 전체 파이프라인 실행
    - 결과 수동 검증
    - edge case 확인 (spread props, empty pages, no props pages)

21. **NPM 패키지 빌드**
    - analyzer: esbuild/tsup 번들링
    - dashboard: Vite build → 정적 파일
    - CLI: bin entry point 설정
    - package.json: bin, files, exports 설정

22. **문서화**
    - README.md: 설치, 실행, 설정, 한계
    - 설정 파일 예시
    - 스크린샷 추가

23. **E2E 스모크 테스트**
    - `npx page-dep-map analyze ./sample` → JSON 생성 확인
    - `npx page-dep-map serve ./output` → 서버 시작 확인
    - Overview, List, Detail 페이지 접근 가능 확인

#### DoD (Day 5)
- [ ] 샘플 프로젝트에서 전체 파이프라인 정상 동작
- [ ] `npm pack` 으로 패키지 생성 가능
- [ ] README 완성
- [ ] 알려진 한계 문서화

---

## Test Strategy

### Unit Tests

| 모듈 | 테스트 내용 |
|------|------------|
| collect-pages | glob 패턴별 페이지 탐색 정확도 |
| collect-props | required/optional 구분, type 추출 |
| collect-hooks | hook 종류별 분류 정확도 |
| collect-prop-flows | pass-through 판별, depth 계산 |
| calculate-score | 가중치 적용 정확도, risk level 판정 |
| generate-likely-issues | 규칙별 트리거 조건 |

### Integration Tests

| 시나리오 | 검증 내용 |
|----------|----------|
| 단순 페이지 (props 없음) | 빈 결과 정상 처리 |
| props drilling 3단계 | depth 3, likely issue 생성 |
| query 3개 + child 6개 | orchestration 이슈 생성 |
| spread props 페이지 | fallback 처리, 경고 플래그 |
| Next.js App Router 프로젝트 | page.tsx 탐색 성공 |
| Next.js Pages Router 프로젝트 | pages/*.tsx 탐색 성공 |

### E2E Tests

| 시나리오 | 검증 내용 |
|----------|----------|
| `analyze` 커맨드 | JSON 파일 생성 |
| `serve` 커맨드 | 서버 시작 + 브라우저 오픈 |
| 기본 커맨드 (analyze+serve) | 전체 파이프라인 |
| Dashboard Overview | 지표 렌더링 |
| Dashboard List | 테이블 + 정렬 + 검색 |
| Dashboard Detail | 전체 섹션 렌더링 |

### Test Fixtures

```
fixtures/
  simple-page/           # props 없는 단순 페이지
  props-drilling/        # 3단계 drilling
  heavy-queries/         # query 과다 사용
  spread-props/          # spread operator 사용
  app-router-project/    # Next.js App Router
  pages-router-project/  # Next.js Pages Router
```

---

## Risk Mitigation

| 리스크 | 대응 |
|--------|------|
| ts-morph 성능 (대형 프로젝트) | 분석 대상 파일만 로드, 캐시 전략 |
| Prop flow 재귀 무한루프 | max depth limit (기본 5) |
| 분석 정확도 기대치 초과 | MVP는 heuristic 명시, confidence 플래그 |
| Dashboard 번들 크기 | Vite tree-shaking, 필수 컴포넌트만 포함 |
| 다양한 프로젝트 구조 대응 | 설정 파일로 패턴 커스터마이징 |
