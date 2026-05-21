---
name: shared-types-guide
description: "Page Dependency Map의 공유 타입 패키지(packages/shared) 구현 가이드. TypeScript 인터페이스, 기본 상수, route path 유틸리티 구현 절차를 정의한다. shared-architect 에이전트가 참조한다."
user-invocable: false
---

# Shared Types Guide

packages/shared 패키지의 구현 절차를 정의한다.

## 구현 순서

1. 패키지 스캐폴딩 (package.json, tsconfig.json)
2. 핵심 타입 정의 (types/)
3. 기본 상수 정의 (constants/)
4. 유틸리티 (utils/)
5. barrel export (index.ts)

## 타입 정의 기준

`docs/PRD.md`의 Data Model 섹션에 정의된 인터페이스를 그대로 구현한다:

- `types/project-summary.ts` → ProjectSummary
- `types/page-summary.ts` → PageSummary
- `types/page-detail.ts` → PageDetail
- `types/config.ts` → PageDepMapConfig (docs/SPEC.md 섹션 4의 설정 스키마)
- `types/scoring.ts` → Weights, Thresholds, RiskLevel
- `types/rules.ts` → RuleDefinition, RuleSeverity, LikelyIssue

### 주의: likelyIssues 타입

PageSummary에서는 `likelyIssues: string[]` (메시지만), PageDetail에서는 `likelyIssues: Array<{ id: string; severity: RuleSeverity; message: string }>` (구조체). 이 차이를 정확히 반영한다.

## 상수 정의 기준

`docs/SPEC.md`를 기준으로:

- `constants/default-weights.ts` → DEFAULT_WEIGHTS (SPEC 2.2)
- `constants/default-thresholds.ts` → DEFAULT_THRESHOLDS (SPEC 2.4)
- `constants/default-patterns.ts` → 기본 pagePatterns, excludePatterns, storePatterns, queryPatterns, sharedPatterns (SPEC 1.1, 1.3, 1.7)

## 유틸리티

- `utils/route-path.ts` → 파일 경로를 route path로 변환 (SPEC 1.1의 Route Path 추정 규칙)
  - `(groupName)` 제거
  - `[param]` → `:param`
  - `[...slug]` → `:slug*`
  - `[[...slug]]` → `:slug?*`
  - `index.tsx` → 부모 경로

## package.json 설정

```json
{
  "name": "@page-dep-map/shared",
  "version": "0.1.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  }
}
```

## 완료 기준

- [ ] 모든 타입이 PRD Data Model과 1:1 매칭
- [ ] 모든 상수가 SPEC 기본값과 일치
- [ ] route-path 유틸리티가 SPEC 1.1의 모든 변환 규칙을 처리
- [ ] `pnpm build` 성공
- [ ] barrel export에서 모든 타입/상수/유틸 접근 가능
