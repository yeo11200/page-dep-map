/**
 * 프로젝트 전체의 분석 결과 요약.
 * Overview 대시보드 화면에서 사용된다.
 */
export interface ProjectSummary {
  totalPages: number;
  avgComplexityScore: number;
  criticalPages: number;
  warningPages: number;
  avgPropsCount: number;
  avgDrillingDepth: number;
  avgHookCount: number;
  topRiskPages: string[];
  updatedAt: string;
}
