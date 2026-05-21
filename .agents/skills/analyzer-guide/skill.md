---
name: analyzer-guide
description: "Page Dependency Map의 정적 분석 엔진(packages/analyzer) 구현 가이드. ts-morph 기반 AST 수집, prop flow 추적, scoring, likely issues 구현 절차를 정의한다. analyzer-engineer 에이전트가 참조한다."
user-invocable: false
---

# Analyzer Guide

packages/analyzer 패키지의 구현 절차를 정의한다. SPEC.md가 정확한 규칙 명세이고, 이 스킬은 구현 전략과 ts-morph 활용 패턴을 안내한다.

## 구현 순서

1. 패키지 스캐폴딩 + ts-morph Project 초기화
2. collect-pages → collect-props → collect-hooks (기본 수집)
3. collect-children → collect-prop-flows (관계 추적)
4. collect-derived → collect-shared → collect-conditionals (보조 수집)
5. calculate-score → generate-issues (분석)
6. build-summary → build-page-detail → write-json (출력)
7. 테스트 fixture 작성

## ts-morph 핵심 패턴

### Project 초기화

```ts
import { Project } from 'ts-morph';

const project = new Project({
  tsConfigFilePath: config.tsConfigPath,
  skipAddingFilesFromTsConfig: true, // 성능: 필요한 파일만 로드
});
// 분석 대상 파일만 추가
const sourceFiles = project.addSourceFilesAtPaths(pageGlobs);
```

### 컴포넌트 함수 식별

```ts
// default export된 함수 또는 arrow function을 페이지 컴포넌트로 식별
function findPageComponent(sourceFile: SourceFile) {
  // Case 1: export default function
  const defaultExport = sourceFile.getDefaultExportSymbol();
  // Case 2: named export + default
  // Case 3: arrow function with export
}
```

### Props 추출 (SPEC 1.2)

```ts
// 함수의 첫 번째 파라미터에서 타입을 추출
// destructuring이면 binding elements에서 prop names 추출
// 타입 alias/interface 참조면 해당 타입의 properties 순회
```

### JSX 자식 컴포넌트 식별 (SPEC 1.4)

```ts
// JsxOpeningElement, JsxSelfClosingElement에서 태그명 추출
// 대문자 시작이면 컴포넌트, 소문자면 HTML element
// Fragment, Suspense 등 React 내장은 제외
```

### Prop Flow 추적 (SPEC 1.5)

핵심 난이도가 가장 높은 부분. 단계별 접근:

1. **1단계**: 현재 컴포넌트의 props가 JSX attribute로 자식에게 전달되는지 확인
2. **2단계**: 전달된 prop이 자식 컴포넌트 파일에서 다시 하위로 전달되는지 확인
3. **재귀**: maxTraceDepth까지 반복

pass-through 판별: prop이 JSX 전달 **외에** 다른 곳에서 참조되지 않으면 pass-through.

**"참조"의 정의**: SPEC 1.5의 "다른 곳에서 참조" 목록을 확인하라.

상세 규칙은 반드시 `docs/SPEC.md` 섹션 1.5를 읽고 구현하라.

## 성능 고려사항

- `skipAddingFilesFromTsConfig: true`로 불필요한 파일 로드 방지
- prop flow 추적 시 이미 방문한 파일 캐싱 (순환 참조 방지)
- 대형 프로젝트에서 분석 시간 60초 목표 — collector별 타이밍 로그 추가

## 테스트 fixture 요구사항

`fixtures/` 디렉토리에 6개 시나리오를 작성한다 (FILE-TREE.md 참조):

1. `simple-page/` — props 없는 단순 페이지
2. `props-drilling/` — 3단계 drilling (Parent → Middle → Child)
3. `heavy-queries/` — query 5개 + child 8개
4. `spread-props/` — `{...props}` 사용
5. `app-router-project/` — Next.js App Router 구조
6. `pages-router-project/` — Next.js Pages Router 구조

각 fixture에는 **기대 결과**를 주석이나 별도 파일로 명시한다.

## 완료 기준

- [ ] 8개 collector 모두 구현 + 단위 테스트
- [ ] complexity score 계산이 SPEC 2.1 공식과 일치
- [ ] 12개 built-in 이슈 규칙 모두 구현
- [ ] JSON 출력이 shared 타입과 정확히 일치
- [ ] 6개 fixture에서 기대 결과와 실제 결과 일치
- [ ] `pnpm build` 성공
