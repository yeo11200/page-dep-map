---
name: pdm-orchestrator
description: "Page Dependency Map 프로젝트의 에이전트 팀을 조율하는 오케스트레이터. 'page-dep-map 구현해줘', 'PDM 빌드', '대시보드 만들어줘', '정적 분석기 구현', 'page dependency map' 같은 요청에 사용. Make sure to use this skill whenever the user mentions page dependency map, page-dep-map, 페이지 의존성 맵, 구조 분석 대시보드, or wants to build/implement the PDM project."
---

# Page Dependency Map Orchestrator

Page Dependency Map 프로젝트의 에이전트 팀을 조율하여 전체 시스템(Shared + Analyzer + Dashboard + CLI)을 구축하는 통합 스킬.

## 실행 모드: 에이전트 팀

## 에이전트 구성

| 팀원 | 에이전트 타입 | 역할 | 스킬 | 출력 |
|------|-------------|------|------|------|
| shared-arch | shared-architect | 공유 타입/상수 | shared-types-guide | packages/shared/ |
| analyzer-eng | analyzer-engineer | 정적 분석 엔진 | analyzer-guide | packages/analyzer/ + fixtures/ |
| dashboard-eng | dashboard-engineer | 대시보드 UI | dashboard-guide | packages/dashboard/ |
| cli-eng | cli-engineer | CLI + 서버 | cli-guide | packages/cli/ |
| qa | qa-inspector | 통합 검증 | (에이전트 내장) | _workspace/qa-reports/ |

## 워크플로우

### Phase 1: 준비

1. 사용자 입력 확인 — 프로젝트 디렉토리, 설정 요구사항
2. `docs/PRD.md`, `docs/SPEC.md`, `docs/FILE-TREE.md`, `docs/PLAN.md` 존재 확인
3. `_workspace/` 생성
4. root 패키지 스캐폴딩 (package.json, pnpm-workspace.yaml, tsconfig.base.json, vitest.config.ts)

### Phase 2: 타입 기반 구축 (Team 1)

**목표**: Shared 타입 패키지 완성 + 검증

1. 팀 생성:
   ```
   TeamCreate(
     team_name: "pdm-foundation",
     members: [
       { name: "shared-arch", agent_type: "shared-architect", model: "opus",
         prompt: "docs/PRD.md의 Data Model과 docs/SPEC.md의 설정 스키마를 읽고, packages/shared/ 패키지를 구현하라. shared-types-guide 스킬을 참조하라. 완료 시 리더에게 알려라." },
       { name: "qa", agent_type: "qa-inspector", model: "opus",
         prompt: "shared-arch의 작업을 모니터링하다가 타입 정의가 완료되면 PRD Data Model과의 정합성을 검증하라. 문제 발견 시 즉시 shared-arch에게 SendMessage하라." }
     ]
   )
   ```

2. 작업 등록:
   ```
   TaskCreate(tasks: [
     { title: "타입 정의 (ProjectSummary, PageSummary, PageDetail)", assignee: "shared-arch" },
     { title: "설정 스키마 타입 (Config, Weights, Thresholds, Rules)", assignee: "shared-arch" },
     { title: "기본 상수 정의 (가중치, 임계값, 패턴)", assignee: "shared-arch" },
     { title: "route-path 유틸리티", assignee: "shared-arch" },
     { title: "타입 정합성 검증", assignee: "qa", depends_on: ["타입 정의 (ProjectSummary, PageSummary, PageDetail)"] }
   ])
   ```

3. 완료 대기 → 팀 정리 (TeamDelete)

### Phase 3: 병렬 구현 (Team 2)

**목표**: Analyzer + Dashboard 병렬 구현

1. 새 팀 생성:
   ```
   TeamCreate(
     team_name: "pdm-builders",
     members: [
       { name: "analyzer-eng", agent_type: "analyzer-engineer", model: "opus",
         prompt: "packages/shared/의 타입을 사용하여 packages/analyzer/를 구현하라. docs/SPEC.md가 구현 기준이다. analyzer-guide 스킬을 참조하라. fixtures/ 테스트 데이터도 작성하라. JSON 출력 스키마 확정 시 dashboard-eng에게 알려라." },
       { name: "dashboard-eng", agent_type: "dashboard-engineer", model: "opus",
         prompt: "packages/shared/의 타입을 사용하여 packages/dashboard/를 구현하라. docs/PRD.md의 대시보드 요구사항을 따르라. dashboard-guide 스킬을 참조하라. mock 데이터로 먼저 개발하고, analyzer-eng의 JSON 스키마가 확정되면 반영하라." },
       { name: "qa", agent_type: "qa-inspector", model: "opus",
         prompt: "analyzer-eng와 dashboard-eng의 작업을 점진적으로 검증하라. 특히 1) analyzer JSON 출력이 shared 타입과 일치하는지, 2) dashboard API hook이 shared 타입을 사용하는지, 3) 양쪽의 JSON 스키마가 일치하는지를 교차 비교하라. 문제 발견 시 해당 에이전트에게 즉시 SendMessage하라." }
     ]
   )
   ```

2. 작업 등록:
   ```
   TaskCreate(tasks: [
     { title: "Analyzer: 패키지 설정 + ts-morph 초기화", assignee: "analyzer-eng" },
     { title: "Analyzer: collect-pages + collect-props + collect-hooks", assignee: "analyzer-eng" },
     { title: "Analyzer: collect-children + collect-prop-flows", assignee: "analyzer-eng" },
     { title: "Analyzer: collect-derived + collect-shared + collect-conditionals", assignee: "analyzer-eng" },
     { title: "Analyzer: calculate-score + generate-issues", assignee: "analyzer-eng" },
     { title: "Analyzer: JSON 출력 + 테스트 fixture", assignee: "analyzer-eng" },
     { title: "Dashboard: Vite + shadcn/ui 설정", assignee: "dashboard-eng" },
     { title: "Dashboard: 레이아웃 + API 클라이언트", assignee: "dashboard-eng" },
     { title: "Dashboard: Overview 화면", assignee: "dashboard-eng" },
     { title: "Dashboard: Page List 화면 (TanStack Table)", assignee: "dashboard-eng" },
     { title: "Dashboard: Page Detail 화면 (7개 섹션)", assignee: "dashboard-eng" },
     { title: "QA: Analyzer JSON ↔ Shared 타입 검증", assignee: "qa", depends_on: ["Analyzer: JSON 출력 + 테스트 fixture"] },
     { title: "QA: Dashboard API ↔ Shared 타입 검증", assignee: "qa", depends_on: ["Dashboard: API 클라이언트 + TanStack Query"] },
     { title: "QA: Analyzer JSON ↔ Dashboard API 교차 검증", assignee: "qa", depends_on: ["QA: Analyzer JSON ↔ Shared 타입 검증", "QA: Dashboard API ↔ Shared 타입 검증"] }
   ])
   ```

3. **팀원 간 통신 규칙:**
   - analyzer-eng → dashboard-eng: JSON 스키마 확정, API 엔드포인트 경로 공유
   - dashboard-eng → analyzer-eng: 데이터 형식 요청사항
   - qa → analyzer-eng: JSON 타입 불일치 리포트
   - qa → dashboard-eng: API 타입 불일치 리포트
   - qa → 양쪽: 경계면 불일치 발견 시 양쪽 모두에게 알림

4. 완료 대기 → 팀 정리

### Phase 4: CLI 통합 (Team 3)

**목표**: CLI + Express 서버 구현 + 전체 통합

1. 새 팀 생성:
   ```
   TeamCreate(
     team_name: "pdm-integration",
     members: [
       { name: "cli-eng", agent_type: "cli-engineer", model: "opus",
         prompt: "packages/analyzer/와 packages/dashboard/가 완성되었다. packages/cli/를 구현하라. cli-guide 스킬을 참조하라. Commander.js CLI + Express 서버를 구현하고, dashboard dist를 임베딩하라." },
       { name: "qa", agent_type: "qa-inspector", model: "opus",
         prompt: "cli-eng의 작업을 검증하라. 1) API 라우트 응답이 shared 타입과 일치하는지, 2) 전체 pnpm build 성공하는지, 3) fixture 프로젝트에서 전체 파이프라인이 동작하는지 확인하라." }
     ]
   )
   ```

2. 작업 등록:
   ```
   TaskCreate(tasks: [
     { title: "CLI: Commander.js 프레임워크 + 3개 커맨드", assignee: "cli-eng" },
     { title: "CLI: Express 서버 + API 라우트", assignee: "cli-eng" },
     { title: "CLI: 설정 파일 로딩", assignee: "cli-eng" },
     { title: "CLI: Dashboard 임베딩 + NPM 패키지 빌드", assignee: "cli-eng" },
     { title: "QA: 전체 빌드 검증", assignee: "qa", depends_on: ["CLI: Dashboard 임베딩 + NPM 패키지 빌드"] },
     { title: "QA: E2E 파이프라인 검증", assignee: "qa", depends_on: ["QA: 전체 빌드 검증"] }
   ])
   ```

3. 완료 대기 → 팀 정리

### Phase 5: 정리 + 문서화

1. 리더(오케스트레이터)가 직접 수행:
   - README.md 작성 (설치, 실행, 설정, 한계)
   - `_workspace/` 보존
   - 사용자에게 최종 결과 보고

## 데이터 흐름

```
[docs/PRD.md + SPEC.md + FILE-TREE.md]
          ↓
    [shared-arch] → packages/shared/ (타입/상수)
          ↓
    ┌─────┴─────┐
    ↓           ↓
[analyzer-eng] [dashboard-eng]   ← SendMessage로 JSON 스키마 조율
    ↓           ↓
packages/     packages/
analyzer/     dashboard/
    └─────┬─────┘
          ↓
      [cli-eng] → packages/cli/ (CLI + Express + 임베딩)
          ↓
      [qa] → 전체 통합 검증
          ↓
      최종 NPM 패키지
```

## 에러 핸들링

| 상황 | 전략 |
|------|------|
| shared 타입과 SPEC 불일치 | qa가 감지 → shared-arch에 수정 요청 → 수정 후 재검증 |
| analyzer JSON이 shared 타입 불일치 | qa가 감지 → analyzer-eng에 수정 요청 |
| dashboard API 타입 불일치 | qa가 감지 → dashboard-eng에 수정 요청 |
| 경계면 양쪽 불일치 | qa가 양쪽 모두에 알림, 리더가 중재 |
| 빌드 실패 | qa가 에러 로그를 해당 에이전트에 전달, 1회 재시도 |
| fixture 테스트 실패 | qa가 기대값/실제값 비교를 analyzer-eng에 전달 |
| 팀원 과반 실패 | 사용자에게 알리고 진행 여부 확인 |

## 테스트 시나리오

### 정상 흐름
1. 사용자가 "page-dep-map 구현해줘" 요청
2. Phase 1: root 스캐폴딩 완료
3. Phase 2: shared 타입 완성 + QA 검증 통과
4. Phase 3: analyzer + dashboard 병렬 구현, QA 점진적 검증
5. Phase 4: CLI 통합 + 전체 빌드 성공
6. Phase 5: README 생성, 사용자에게 `npx page-dep-map ./sample` 실행 안내
7. 예상 결과: packages/shared, analyzer, dashboard, cli 모두 구현, 전체 빌드 성공

### 에러 흐름
1. Phase 3에서 analyzer의 JSON 출력이 shared 타입과 불일치
2. qa가 감지하여 analyzer-eng에게 구체적 수정 요청
3. analyzer-eng가 수정 후 qa에게 재검증 요청
4. 재검증 통과 → Phase 4로 진행
5. 수정 불가 시 리더에게 에스컬레이션
