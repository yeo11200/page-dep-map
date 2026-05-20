# SPEC.md — 분석 규칙 명세

이 문서는 정적 분석기의 세부 규칙을 정의한다.
Claude Code가 구현 시 이 문서를 기준으로 로직을 작성한다.

---

## 1. AST 수집 규칙

### 1.1 페이지 탐색 규칙

#### 기본 패턴

```ts
// Next.js App Router
"app/**/page.tsx"
"app/**/page.ts"

// Next.js Pages Router
"pages/**/*.tsx"
"pages/**/*.ts"

// 제외 패턴
"**/_app.*"
"**/_document.*"
"**/_error.*"
"**/layout.*"
"**/loading.*"
"**/error.*"
"**/not-found.*"
"**/*.test.*"
"**/*.spec.*"
"**/__tests__/**"
```

#### Route Path 추정 규칙

```
파일 경로                           → route path
app/page.tsx                       → /
app/users/page.tsx                 → /users
app/users/[id]/page.tsx            → /users/:id
app/(dashboard)/settings/page.tsx  → /settings  (route group 제거)
pages/index.tsx                    → /
pages/users/index.tsx              → /users
pages/users/[id].tsx               → /users/:id
```

- `(groupName)` 은 route path에서 제거한다.
- `[param]` 은 `:param` 으로 변환한다.
- `[...slug]` 은 `:slug*` 으로 변환한다.
- `[[...slug]]` 은 `:slug?*` 으로 변환한다.

#### 설정 오버라이드

```ts
// page-dep-map.config.ts
{
  pagePatterns: [
    "src/views/**/*.tsx",
    "app/**/page.tsx"
  ],
  excludePatterns: [
    "**/*.test.*",
    "**/__mocks__/**"
  ]
}
```

---

### 1.2 Props 수집 규칙

#### 추출 대상

1. **함수 파라미터 타입**

```tsx
// Case 1: inline type
function UserPage({ name, age }: { name: string; age?: number }) {}

// Case 2: interface/type alias
interface UserPageProps {
  name: string;
  age?: number;
}
function UserPage({ name, age }: UserPageProps) {}

// Case 3: arrow function
const UserPage = ({ name }: UserPageProps) => {};

// Case 4: React.FC (deprecated but still used)
const UserPage: React.FC<UserPageProps> = ({ name }) => {};

// Case 5: forwardRef
const UserPage = forwardRef<HTMLDivElement, UserPageProps>(({ name }, ref) => {});
// → forwardRef의 두 번째 제네릭 파라미터에서 props 추출
// → ref 파라미터는 props에서 제외
```

2. **required / optional 판별**

```ts
// required: 타입에 ? 없음
name: string           → required: true

// optional: 타입에 ? 있음
age?: number           → required: false

// default value → optional로 처리
function Page({ sort = "asc" }: Props) {}  → required: false
```

3. **type 문자열 추출**

```ts
name: string           → type: "string"
items: Item[]          → type: "Item[]"
onSubmit: () => void   → type: "() => void"
complex: Foo & Bar     → type: "Foo & Bar"

// 추출 실패 시
→ type: undefined
```

#### Spread Props Fallback

```tsx
function Page(props: PageProps) {
  return <Child {...props} />;
}
```

- spread props는 개별 prop으로 분해하지 않는다.
- `spreadPropsDetected: true` 플래그를 설정한다.
- pass-through 후보로 마킹한다.
- likely issue: `"spread props가 사용되어 정확한 prop flow 추적이 제한됩니다."`

---

### 1.3 Hooks 수집 규칙

#### 분류 체계

| 카테고리 | 패턴 | 예시 |
|---------|------|------|
| query | `useQuery`, `useSuspenseQuery`, `useInfiniteQuery`, `useMutation` | TanStack Query |
| store | `useStore`, `useAtom`, `useRecoilState`, `useRecoilValue`, `useSelector`, `useDispatch`, 설정 패턴 | Zustand, Jotai, Recoil, Redux |
| context | `useContext` | React Context |
| effect | `useEffect`, `useLayoutEffect` | React |
| hook | 위 카테고리에 속하지 않는 모든 `use*` 호출 | useState, useMemo, useRef, custom hooks |

#### Store Hook 패턴 인식

```ts
// Zustand: 설정에서 패턴 지정 가능
const count = useCountStore((s) => s.count);
// → 함수명이 설정의 storePatterns에 매칭되면 store로 분류

// 기본 storePatterns
storePatterns: [
  /^use\w+Store$/,     // useCountStore, useAuthStore
  /^useAtom$/,
  /^useRecoil/,
  /^useSelector$/,
  /^useDispatch$/
]
```

#### Query Hook 패턴 인식

```ts
// 기본 queryPatterns
queryPatterns: [
  /^useQuery$/,
  /^useSuspenseQuery$/,
  /^useInfiniteQuery$/,
  /^useMutation$/,
  /^use\w+Query$/,     // useUserQuery (커스텀 query hook)
  /^use\w+Mutation$/   // useCreateUserMutation
]
```

#### 카운팅 규칙

- 같은 hook이 여러 번 호출되면 각각 카운팅한다.
- 커스텀 hook 내부의 hook은 카운팅하지 않는다 (현재 컴포넌트 스코프만).
- 조건부 hook 호출도 카운팅한다 (분석기는 lint가 아니므로).

---

### 1.4 자식 컴포넌트 수집 규칙

#### 식별 조건

JSX 내 대문자로 시작하는 태그를 컴포넌트로 인식한다.

```tsx
return (
  <div>
    <UserCard />        {/* ✓ 컴포넌트 */}
    <input />           {/* ✗ HTML element */}
    <Sidebar.Menu />    {/* ✓ 컴포넌트 (namespace) */}
    {items.map(i =>
      <ListItem />      {/* ✓ 컴포넌트 */}
    )}
  </div>
);
```

#### 제외 대상

- HTML 네이티브 엘리먼트 (소문자 시작)
- React Fragment (`<>`, `<Fragment>`)
- `Suspense`, `ErrorBoundary` 등 React 내장 (별도 설정 가능)

#### 중복 처리

- 같은 컴포넌트가 여러 번 사용되어도 childComponents 목록에는 1번만 추가한다.
- childComponentCount는 유니크 컴포넌트 수이다.

---

### 1.5 Prop Flow 추적 규칙

#### 추적 범위

1단계: 현재 컴포넌트의 props가 자식에게 전달되는지 확인
2단계: 자식 컴포넌트 파일을 열어 해당 prop이 다시 하위로 전달되는지 확인
3단계: 최대 depth까지 반복

#### 기본 Max Depth

```ts
maxTraceDepth: 5  // 설정 파일로 변경 가능
```

#### Pass-Through 판별

```tsx
function Parent({ userId, userName }: Props) {
  // userId를 사용함 (읽기)
  console.log(userId);

  return (
    <Child
      userId={userId}    // 사용 + 전달 → pass-through: false
      userName={userName} // 사용 안 함 + 전달만 → pass-through: true
    />
  );
}
```

**판별 로직:**

1. prop이 JSX attribute로 자식에게 전달되는가? → Yes면 "전달됨"
2. prop이 JSX 전달 외에 다른 곳에서 참조(읽기)되는가? → No면 "pass-through"

**"다른 곳에서 참조"의 정의:**

- 변수 할당의 우변에서 사용
- 함수 호출의 인자로 사용
- 조건문의 조건에서 사용
- console.log, 연산 등에서 사용
- JSX의 텍스트 내용으로 사용 (`{prop}`)

**제외 (pass-through로 판별하지 않는 경우):**

- destructuring 자체는 "사용"으로 보지 않는다
- JSX attribute로의 전달은 "사용"으로 보지 않는다

#### Unused Candidate 판별

```tsx
function Parent({ userId, theme, debug }: Props) {
  return <Child userId={userId} />;
  // theme: 전달도 안 하고 사용도 안 함 → unusedCandidate
  // debug: 전달도 안 하고 사용도 안 함 → unusedCandidate
}
```

prop이 컴포넌트 내에서 어디서도 참조되지 않으면 `unusedCandidate`로 마킹한다.

---

### 1.6 Derived Data Props 탐지 규칙

#### 패턴 정의

부모 컴포넌트가 데이터를 가공하여 자식에게 전달하는 경우를 탐지한다.

```tsx
function Parent({ user }: Props) {
  // Case 1: 단순 변환
  const fullName = `${user.firstName} ${user.lastName}`;

  // Case 2: 배열 가공
  const activeItems = items.filter(i => i.active);

  // Case 3: useMemo 가공
  const sortedList = useMemo(() => list.sort(...), [list]);

  return (
    <Child
      fullName={fullName}         // derived
      activeItems={activeItems}   // derived
      sortedList={sortedList}     // derived
      user={user}                 // NOT derived (직접 전달)
    />
  );
}
```

#### 탐지 로직

1. 자식에게 전달되는 prop의 값(value)이 변수인가?
2. 그 변수가 현재 컴포넌트 스코프에서 선언되었는가?
3. 그 변수의 초기값이 props에서 직접 온 것이 아닌 계산/변환 결과인가?
4. 위 조건을 모두 만족하면 `derivedDataProp`으로 마킹

#### 제외 케이스

- `<Child user={user} />` — props를 그대로 전달 → derived 아님
- `<Child onClick={handleClick} />` — 함수 전달 → derived 아님 (별도 설정 가능)
- `<Child value={CONSTANT} />` — 상수 전달 → derived 아님

---

### 1.7 Shared Dependencies 수집 규칙

#### 기본 패턴

```ts
sharedPatterns: [
  /^@\/components\/common\//,
  /^@\/components\/shared\//,
  /^@\/components\/ui\//,
  /^@\/lib\//,
  /^@\/utils\//,
  /^@\/hooks\//,
  /^@\/constants\//,
  /^\.\.\/\.\.\/common\//,
  /^\.\.\/\.\.\/shared\//
]
```

#### 카운팅 규칙

- import 문 기준으로 카운팅한다.
- `import { A, B } from '@/components/ui'` → 1개 (모듈 단위)
- 같은 모듈에서 여러 번 import해도 1개로 카운팅
- `node_modules` import는 제외한다.

---

### 1.8 조건 분기 수집 규칙

#### 카운팅 대상

```tsx
// if문
if (condition) { ... }                    // +1

// else if
else if (condition) { ... }               // +1

// switch case
switch (value) {
  case 'a': ...                           // +1 (case당)
  case 'b': ...                           // +1
}

// 삼항 연산자
const x = condition ? a : b;              // +1

// JSX 조건부 렌더링
{isLoading && <Spinner />}                // +1
{isError ? <Error /> : <Content />}       // +1

// optional chaining은 카운팅하지 않는다
user?.name                                // 카운팅 안 함

// nullish coalescing은 카운팅하지 않는다
value ?? defaultValue                     // 카운팅 안 함
```

---

## 2. Complexity Score 계산 규칙

### 2.1 기본 점수식

```ts
// storeContextUsageCount = storeUsageCount + contextUsageCount (합산)
complexityScore =
  (propsCount * weights.propsCount)
  + (requiredPropsCount * weights.requiredPropsCount)
  + (maxDrillingDepth * weights.maxDrillingDepth)
  + (passThroughPropsCount * weights.passThroughPropsCount)
  + (hookCount * weights.hookCount)
  + (queryCount * weights.queryCount)
  + ((storeUsageCount + contextUsageCount) * weights.storeContextUsageCount)
  + (effectCount * weights.effectCount)
  + (conditionalBranchCount * weights.conditionalBranchCount)
  + (childComponentCount * weights.childComponentCount)
  + (derivedDataPropCount * weights.derivedDataPropCount)
  + (sharedDependencyCount * weights.sharedDependencyCount)
```

### 2.2 기본 가중치

```ts
const DEFAULT_WEIGHTS = {
  propsCount: 1,
  requiredPropsCount: 1,
  maxDrillingDepth: 3,
  passThroughPropsCount: 3,
  hookCount: 1,
  queryCount: 2,
  storeContextUsageCount: 2,
  effectCount: 3,
  conditionalBranchCount: 1,
  childComponentCount: 1,
  derivedDataPropCount: 2,
  sharedDependencyCount: 1,
};
```

### 2.3 가중치 설계 의도

| 요소 | 가중치 | 이유 |
|------|--------|------|
| propsCount | 1 | 기본 복잡도 지표, 단독으로는 큰 의미 없음 |
| requiredPropsCount | 1 | 결합도 지표, props 수와 합산 시 의미 |
| maxDrillingDepth | **3** | 아키텍처 리스크의 핵심 지표, 3단계 이상은 구조적 문제 |
| passThroughPropsCount | **3** | 불필요한 결합의 직접 증거, drilling과 함께 가장 중요 |
| hookCount | 1 | hook 자체는 문제 아님, 과다 시에만 복잡 |
| queryCount | 2 | 데이터 의존성 증가, 캐싱/로딩 상태 관리 복잡도 |
| storeContextUsageCount | 2 | 전역 상태 결합도, 테스트 어려움 증가 |
| effectCount | **3** | 사이드이펙트 관리 난이도, 버그 발생 가능성 높음 |
| conditionalBranchCount | 1 | 인지 복잡도, 단독으로는 보통 |
| childComponentCount | 1 | 구성 복잡도, orchestration 부담 |
| derivedDataPropCount | 2 | 책임 경계 모호함, 리팩토링 후보 |
| sharedDependencyCount | 1 | 변경 영향도, 단독으로는 보통 |

### 2.4 Risk Level 판정

```ts
function getRiskLevel(score: number, thresholds: Thresholds): RiskLevel {
  if (score >= thresholds.critical) return 'critical';
  if (score >= thresholds.warning) return 'warning';
  if (score >= thresholds.moderate) return 'moderate';
  return 'healthy';
}

const DEFAULT_THRESHOLDS = {
  moderate: 20,
  warning: 40,
  critical: 60,
};
```

### 2.5 설정 파일 오버라이드

```ts
// page-dep-map.config.ts
export default {
  scoring: {
    weights: {
      effectCount: 5,        // effect를 더 중시하는 팀
      maxDrillingDepth: 5,   // drilling을 더 중시하는 팀
    },
    thresholds: {
      moderate: 15,
      warning: 35,
      critical: 55,
    },
  },
};
```

미지정 가중치는 기본값을 사용한다.

---

## 3. Likely Issues 규칙

### 3.1 규칙 목록

| ID | 조건 | 메시지 | severity |
|----|------|--------|----------|
| DRILL_DEEP | `maxDrillingDepth >= 3` | `"props drilling depth가 ${depth}단계로 높습니다. Context 또는 composition 패턴 검토를 권장합니다."` | warning |
| PASS_THROUGH | `passThroughPropsCount >= 2` | `"중간 전달만 하는 props가 ${count}개입니다. 하위 컴포넌트가 직접 데이터를 가져오는 것을 검토하세요."` | warning |
| EFFECT_HEAVY | `effectCount >= 4` | `"useEffect가 ${count}개로 사이드이펙트 복잡도가 높습니다. custom hook 분리를 검토하세요."` | warning |
| DATA_ORCHESTRATOR | `queryCount >= 3 AND childComponentCount >= 6` | `"쿼리 ${qCount}개 + 자식 ${cCount}개로, 페이지가 데이터 orchestration 책임을 과도하게 가질 수 있습니다."` | critical |
| DERIVED_HEAVY | `derivedDataPropCount >= 2` | `"상위에서 가공된 데이터 전달이 ${count}개입니다. 하위 컴포넌트의 책임 경계 재검토가 필요합니다."` | info |
| SHARED_HEAVY | `sharedDependencyCount >= 10` | `"공통 모듈 의존이 ${count}개입니다. 변경 시 영향도 확인이 필요합니다."` | info |
| MANY_PROPS | `propsCount >= 10` | `"props가 ${count}개로 인터페이스가 복잡합니다. 객체 grouping 또는 분리를 검토하세요."` | warning |
| MANY_REQUIRED | `requiredPropsCount >= 8` | `"필수 props가 ${count}개로 결합도가 높습니다."` | warning |
| SPREAD_DETECTED | `spreadPropsDetected === true` | `"spread props ({...props})가 사용되어 정확한 prop flow 추적이 제한됩니다."` | info |
| MANY_CONDITIONS | `conditionalBranchCount >= 8` | `"조건 분기가 ${count}개로 인지 복잡도가 높습니다. 전략 패턴 또는 컴포넌트 분리를 검토하세요."` | warning |
| EFFECT_NO_QUERY | `effectCount >= 3 AND queryCount === 0` | `"useEffect로 직접 데이터를 가져오고 있을 수 있습니다. React Query 도입을 검토하세요."` | info |
| STORE_AND_PROPS | `storeContextUsageCount >= 2 AND propsCount >= 5` | `"전역 상태와 props를 동시에 많이 사용합니다. 데이터 소스가 혼재되어 추적이 어려울 수 있습니다."` | info |

### 3.2 Severity 정의

| severity | 의미 | 대시보드 표현 |
|----------|------|--------------|
| critical | 즉시 검토 필요 | 빨간색 배지 |
| warning | 주의 필요 | 주황색 배지 |
| info | 참고 정보 | 파란색 배지 |

### 3.3 커스텀 규칙 추가

```ts
// page-dep-map.config.ts
export default {
  rules: {
    // 기존 규칙 threshold 변경
    DRILL_DEEP: { threshold: 4 },     // 3 → 4로 완화
    EFFECT_HEAVY: { threshold: 6 },   // 4 → 6으로 완화

    // 기존 규칙 비활성화
    SPREAD_DETECTED: { enabled: false },

    // 커스텀 규칙 추가
    custom: [
      {
        id: 'MANY_HOOKS',
        condition: (page) => page.hookCount >= 10,
        message: (page) => `hook이 ${page.hookCount}개로 과다합니다.`,
        severity: 'warning',
      },
    ],
  },
};
```

### 3.4 규칙 평가 순서

1. 기본 규칙을 모두 평가한다.
2. 설정 파일의 threshold 오버라이드를 적용한다.
3. `enabled: false` 규칙을 제거한다.
4. 커스텀 규칙을 평가하여 추가한다.
5. severity 순서로 정렬한다 (critical → warning → info).

---

## 4. 설정 파일 전체 스키마

```ts
// page-dep-map.config.ts
import { defineConfig } from 'page-dep-map';

export default defineConfig({
  // 페이지 탐색
  pagePatterns: ['app/**/page.tsx'],
  excludePatterns: ['**/*.test.*', '**/__tests__/**'],

  // tsconfig 경로 (path alias 해석용)
  tsConfigPath: './tsconfig.json',

  // 분석 설정
  analysis: {
    maxTraceDepth: 5,
    storePatterns: [/^use\w+Store$/],
    queryPatterns: [/^useQuery$/, /^use\w+Query$/],
    sharedPatterns: [/^@\/components\/common\//],
  },

  // 스코어링
  scoring: {
    weights: { /* 부분 오버라이드 가능 */ },
    thresholds: {
      moderate: 20,
      warning: 40,
      critical: 60,
    },
  },

  // 규칙
  rules: {
    DRILL_DEEP: { threshold: 3 },
    custom: [],
  },

  // 출력
  output: {
    dir: './page-dep-map-output',
    format: 'json',
  },

  // 대시보드
  dashboard: {
    port: 3399,
    open: true,
  },
});
```

---

## 5. 분석 정확도 기대치

### Confidence Level

| 기능 | 기대 정확도 | 비고 |
|------|------------|------|
| 페이지 탐색 | 95%+ | glob 패턴 기반 |
| Props 수집 | 90%+ | 표준 패턴만 |
| Hook 분류 | 85%+ | 패턴 매칭 기반 |
| Prop flow (1단계) | 85%+ | 직접 전달 |
| Prop flow (2~3단계) | 70%+ | 파일 간 추적 |
| Pass-through 판별 | 75%+ | heuristic |
| Derived data 탐지 | 70%+ | heuristic |
| Unused candidate | 80%+ | AST 참조 검사 |

### 알려진 한계

1. **Spread props** — 개별 prop 추적 불가, 플래그만 표시
2. **HOC** — `withAuth(Page)` 등은 래핑된 컴포넌트의 props를 추적하지 않음
3. **Render props** — `<DataProvider render={(data) => ...} />` 패턴의 내부 추적 불가
4. **Dynamic import** — `dynamic(() => import(...))` 의 컴포넌트 추적 제한
5. **Re-export** — `export { default } from './Component'` 체인 추적 제한
6. **Object destructuring in child** — `const { a } = props.nested` 패턴은 prop 사용으로 인식하지 못할 수 있음
7. **Conditional rendering with variables** — `const comp = flag ? <A /> : <B />` 는 자식 컴포넌트로 인식하지 못할 수 있음

이 한계는 README 및 대시보드 About 화면에 문서화한다.
