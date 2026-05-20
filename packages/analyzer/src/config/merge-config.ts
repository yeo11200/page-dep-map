import type { PageDepMapConfig, Weights, Thresholds } from '@page-dep-map/shared';
import {
  DEFAULT_WEIGHTS,
  DEFAULT_THRESHOLDS,
  DEFAULT_PAGE_PATTERNS,
  DEFAULT_EXCLUDE_PATTERNS,
  DEFAULT_STORE_PATTERNS,
  DEFAULT_QUERY_PATTERNS,
  DEFAULT_SHARED_PATTERNS,
} from '@page-dep-map/shared';

/** 모든 기본값이 채워진 최종 설정 */
export interface ResolvedConfig {
  pagePatterns: string[];
  excludePatterns: string[];
  tsConfigPath?: string;
  maxTraceDepth: number;
  storePatterns: RegExp[];
  queryPatterns: RegExp[];
  sharedPatterns: RegExp[];
  weights: Weights;
  thresholds: Thresholds;
  rules: PageDepMapConfig['rules'];
  outputDir: string;
  dashboardPort: number;
  dashboardOpen: boolean;
}

/**
 * 파일에서 로드된 설정과 런타임 설정을 병합하여 최종 설정을 생성한다.
 * 미지정 값은 모두 기본값으로 채워진다.
 */
export function mergeConfig(
  fileConfig: Partial<PageDepMapConfig>,
  runtimeConfig?: Partial<PageDepMapConfig>,
): ResolvedConfig {
  const merged: Partial<PageDepMapConfig> = {
    ...fileConfig,
    ...runtimeConfig,
  };

  return {
    pagePatterns: merged.pagePatterns ?? DEFAULT_PAGE_PATTERNS,
    excludePatterns: merged.excludePatterns ?? DEFAULT_EXCLUDE_PATTERNS,
    tsConfigPath: merged.tsConfigPath,
    maxTraceDepth: merged.analysis?.maxTraceDepth ?? 5,
    storePatterns: merged.analysis?.storePatterns ?? DEFAULT_STORE_PATTERNS,
    queryPatterns: merged.analysis?.queryPatterns ?? DEFAULT_QUERY_PATTERNS,
    sharedPatterns: merged.analysis?.sharedPatterns ?? DEFAULT_SHARED_PATTERNS,
    weights: { ...DEFAULT_WEIGHTS, ...merged.scoring?.weights },
    thresholds: { ...DEFAULT_THRESHOLDS, ...merged.scoring?.thresholds },
    rules: merged.rules,
    outputDir: merged.output?.dir ?? './page-dep-map-output',
    dashboardPort: merged.dashboard?.port ?? 3399,
    dashboardOpen: merged.dashboard?.open ?? true,
  };
}
