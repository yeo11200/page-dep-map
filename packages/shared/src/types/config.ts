import type { Weights, Thresholds } from './scoring.js';
import type { RulesConfig } from './rules.js';

/** 분석 동작 설정 */
export interface AnalysisConfig {
  maxTraceDepth?: number;
  storePatterns?: RegExp[];
  queryPatterns?: RegExp[];
  sharedPatterns?: RegExp[];
}

/** 스코어링 설정 (가중치 + 임계값) */
export interface ScoringConfig {
  weights?: Partial<Weights>;
  thresholds?: Partial<Thresholds>;
}

/** 출력 설정 */
export interface OutputConfig {
  dir?: string;
  format?: 'json';
}

/** 대시보드 설정 */
export interface DashboardConfig {
  port?: number;
  open?: boolean;
}

/**
 * page-dep-map.config.ts의 전체 스키마.
 * SPEC 섹션 4에 정의된 설정 파일 구조를 반영한다.
 * 모든 필드는 optional — 미지정 시 기본값 사용.
 */
export interface PageDepMapConfig {
  pagePatterns?: string[];
  excludePatterns?: string[];
  tsConfigPath?: string;
  analysis?: AnalysisConfig;
  scoring?: ScoringConfig;
  rules?: RulesConfig;
  output?: OutputConfig;
  dashboard?: DashboardConfig;
}
