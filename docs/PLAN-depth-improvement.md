# Depth 개선 구현 계획 (v0.1.2)

작성: 2026-05-20
대상 버전: `@shinjinseop/page-dep-map@0.1.2`

## 1. 배경

현재 대시보드 Overview 상단의 **"Depth N"** 숫자는 사용자가 직관적으로 기대하는 *컴포넌트 트리 깊이*가 아니라, **prop drilling depth** 값이다. 그래서 다음과 같은 현상이 발생한다:

- `funding-accounts/create` 페이지 사례:
  - Child Components 3개 식별 (`MainLayout`, `FundingAccountCreateFormProvider`, `FundingAccountCreate`)
  - 그런데 페이지 자체가 prop을 받지 않음 → prop flow 0건 → **Depth: 0**
  - 사용자 기대: "이 페이지가 몇 단계 깊이의 컴포넌트 트리를 가지고 있는가" — 현재 측정 불가

또한 `collect-prop-flows.ts:70`에 다음 하드코딩이 있다:

```ts
const depth = 1; // Single-file depth for MVP
```

즉 prop drilling 자체도 cross-file 추적이 미구현 상태로, 페이지 파일 내부 1단계만 본다.

## 2. 목표

1. **Overview의 `Depth` 숫자를 "component tree depth"로 재정의**한다 — 페이지를 루트로 한 컴포넌트 트리의 최대 깊이.
2. **Prop drilling depth를 cross-file로 제대로 구현**하고, 그 값은 Prop Flow 섹션 안에서만 노출한다. Overview 상단 큰 숫자에는 영향을 주지 않는다.
3. 기존 `maxDrillingDepth` 기반 scoring/issues 로직은 보존(scoring 가중치 변경은 본 작업 밖).

## 3. 메트릭 정의

### componentTreeDepth (신규)

- **정의**: 페이지 컴포넌트를 깊이 0으로 두고, 자식 컴포넌트의 정의 파일을 재귀적으로 따라간 최대 깊이.
- **수집 단위**: 페이지당 1개의 정수.
- **종료 조건**:
  1. 자식 컴포넌트가 없으면 stop
  2. 자식의 정의 파일을 찾을 수 없으면(외부 라이브러리 등) stop
  3. visited 집합에 이미 있으면 stop (재귀/cycle 방지)
  4. `MAX_TREE_DEPTH = 10` 도달 시 stop (방어선)
- **외부 라이브러리 처리**: `node_modules/` 경로의 정의 파일은 따라가지 않음(외부는 분석 대상 외).
- **표시 위치**: Overview hero의 "Depth N" 슬롯, 그리고 PageSummary의 정렬/필터링용.

### maxDrillingDepth (기존, 의미 보정)

- **현재**: 같은 prop이 페이지에서 자식으로 전달되면 무조건 `depth = 1` 하드코딩.
- **변경 후**: cross-file로 추적. 페이지 → ChildA → GrandchildB로 동일 prop이 흘러가면 depth = 2. 같은 visited/MAX 가드 적용.
- **표시 위치**: Prop Flow 섹션, Score Breakdown.

## 4. 구현 범위

### 4.1 packages/shared

- `PageDetail`에 `componentTreeDepth: number` 추가
- `PageSummary`에 `componentTreeDepth: number` 추가
- 기본값/초기화 처리: 빈 페이지 → 0

### 4.2 packages/analyzer

#### (a) `collectors/resolve-component-source.ts` (신규)

- **목적**: 컴포넌트 이름 → 정의 파일 SourceFile 매핑
- **로직**:
  - `sourceFile.getImportDeclarations()` 순회
  - named/default import에서 컴포넌트 이름 매칭
  - `decl.getModuleSpecifierSourceFile()`로 SourceFile 획득
  - `node_modules/` 포함 경로면 `null` 반환
  - 결과: `Map<componentName, SourceFile>`

#### (b) `collectors/collect-component-tree-depth.ts` (신규)

- **시그니처**: `collectComponentTreeDepth(rootSource, rootComponentName, project, maxDepth=10): number`
- **로직**:
  - BFS or DFS (DFS 채택 — visited 관리 단순)
  - root에서 `collectChildren()`로 자식 이름 수집
  - 각 자식에 대해 resolver로 SourceFile 획득 → 없으면 leaf(현재 깊이 + 1)
  - 자식의 자식을 재귀 분석
  - `Math.max(...subDepths)` 반환

#### (c) `collectors/collect-prop-flows.ts` (수정)

- `const depth = 1` 라인 제거
- 자식 컴포넌트 정의 파일에서 동일 prop 이름의 prop이 다시 자식으로 전달되는지 재귀 추적
- 동일한 `MAX_TRACE_DEPTH = 5` 유지 (이미 정의됨)
- visited 집합 추가
- 결과: `propFlows[].depth`가 실제 단계 수를 반영

#### (d) `analyzer/index.ts` (수정)

- 페이지마다 `collectComponentTreeDepth()` 호출 결과를 `componentTreeDepth`로 채움
- output builder에 새 필드 전달

### 4.3 packages/dashboard

- `PageHeroSection.tsx:30` — `metrics.maxDrillingDepth` → `metrics.componentTreeDepth`로 교체. 라벨도 그대로 "Depth"라 화면 호환.
- `MetricsSection.tsx`에 "Component Tree Depth" 행 추가 (기존 Max Drilling Depth는 별도 보존)
- Prop Flow 섹션은 손대지 않음 — 이미 prop.depth를 사용하고 있어 cross-file 구현으로 값만 바뀜.

### 4.4 packages/analyzer 테스트

- `fixtures/app-router-project`에서 적어도 1개 페이지가 tree depth ≥ 2 나오는지 확인
- `fixtures/props-drilling`에서 cross-file drilling depth ≥ 2 나오는지 확인

## 5. 영향 분석

| 영역 | 변경 | Breaking? |
|---|---|---|
| `PageDetail`, `PageSummary` 스키마 | `componentTreeDepth` 필드 추가 | No (추가만) |
| dashboard "Depth" 숫자의 의미 | drilling → tree | **표시값 변경** (시각적 차이) |
| scoring 가중치 | 변경 없음 | No |
| 기존 `maxDrillingDepth` 사용처 | 의미가 더 정확해짐(값이 커질 수 있음) | scoring 영향 가능 — 모니터링 |
| 분석 시간 | cross-file 추적으로 늘어남 (예상 30~50%) | 수용 가능 |

## 6. 잠재 위험

- **순환 import**: A → B → A 같은 컴포넌트 의존이 있으면 무한 루프. visited 가드 필수.
- **Re-export 패턴**: `export { default as Foo } from './bar'` 같은 패턴에서 정의 파일을 못 찾을 수 있음 — 1차 구현에서는 미해결, 못 따라가면 leaf 처리.
- **Dynamic import**: `const Foo = lazy(() => import('./Foo'))` — 정적 분석으로는 처리 불가, leaf 처리.
- **HOC, render props**: `withRouter(Component)` 같은 패턴은 식별 어려움 — out of scope.
- **분석 시간 폭증**: project에 SourceFile이 너무 많아지면 메모리 증가. addSourceFileAtPath는 캐싱되므로 큰 문제는 없지만 fixtures가 아닌 실제 대형 프로젝트에서 검증 필요.

## 7. 작업 순서

1. [shared] `componentTreeDepth` 필드 추가
2. [analyzer] `resolve-component-source` 신규 구현
3. [analyzer] `collect-component-tree-depth` 신규 구현
4. [analyzer] `index.ts`에서 호출, output 채우기
5. [dashboard] Hero/Metrics 표시 업데이트
6. [analyzer] `collect-prop-flows`의 cross-file 추적 구현
7. [test] fixtures로 검증 케이스 추가
8. [release] 0.1.2 publish

## 8. 명시적으로 하지 않는 것

- HOC, lazy, dynamic import 처리
- Re-export chain 완전 해결
- scoring 가중치 재조정
- Component depth를 GraphViz 같은 시각화로 그리기 (지금은 숫자만)
- maxDepth 옵션을 CLI/config로 노출 (default 10 고정)

## 9. 검증 기준 (DoD)

- [ ] `npm run build` 성공
- [ ] `vitest run` 모든 기존 + 신규 테스트 통과
- [ ] `funding-accounts/create` 같은 prop 없는 페이지에서도 `Depth > 0` 표시
- [ ] `fixtures/props-drilling`에서 cross-file drilling depth ≥ 2 확인
- [ ] npm pack tarball에 노출 흔적 0건 (이전 정리된 상태 유지)
- [ ] 0.1.2 publish 후 `npx @shinjinseop/page-dep-map@0.1.2 --help` 정상
