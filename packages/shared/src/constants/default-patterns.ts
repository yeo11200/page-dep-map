/** SPEC 섹션 1.1 — 페이지 파일 탐색 기본 패턴 */
export const DEFAULT_PAGE_PATTERNS: string[] = [
  'app/**/page.tsx',
  'app/**/page.ts',
  'pages/**/*.tsx',
  'pages/**/*.ts',
];

/** SPEC 섹션 1.1 — 분석 제외 기본 패턴 */
export const DEFAULT_EXCLUDE_PATTERNS: string[] = [
  '**/_app.*',
  '**/_document.*',
  '**/_error.*',
  '**/layout.*',
  '**/loading.*',
  '**/error.*',
  '**/not-found.*',
  '**/*.test.*',
  '**/*.spec.*',
  '**/__tests__/**',
  '**/__mocks__/**',
];

/** SPEC 섹션 1.3 — store hook 인식 패턴 */
export const DEFAULT_STORE_PATTERNS: RegExp[] = [
  /^use\w+Store$/,
  /^useAtom$/,
  /^useRecoil/,
  /^useSelector$/,
  /^useDispatch$/,
];

/** SPEC 섹션 1.3 — query hook 인식 패턴 */
export const DEFAULT_QUERY_PATTERNS: RegExp[] = [
  /^useQuery$/,
  /^useSuspenseQuery$/,
  /^useInfiniteQuery$/,
  /^useMutation$/,
  /^use\w+Query$/,
  /^use\w+Mutation$/,
];

/** SPEC 섹션 1.7 — shared dependency 인식 패턴 */
export const DEFAULT_SHARED_PATTERNS: RegExp[] = [
  /^@\/components\/common\//,
  /^@\/components\/shared\//,
  /^@\/components\/ui\//,
  /^@\/lib\//,
  /^@\/utils\//,
  /^@\/hooks\//,
  /^@\/constants\//,
  /^\.\.\/\.\.\/common\//,
  /^\.\.\/\.\.\/shared\//,
];
