import * as path from 'node:path';
import type {
  PageDepMapConfig,
  ProjectSummary,
  PageDetail,
  PageSummary,
  ApiCallSite,
  ApiIndex,
} from '@page-dep-map/shared';
import { createProject } from './project.js';
import { loadConfig } from './config/load-config.js';
import { mergeConfig } from './config/merge-config.js';
import {
  collectPages,
  collectProps,
  collectHooks,
  collectChildren,
  collectPropFlows,
  collectDerived,
  collectShared,
  collectConditionals,
} from './collectors/index.js';
import { collectComponentTree } from './collectors/collect-component-tree-depth.js';
import { collectApiCalls } from './collectors/collect-api-calls.js';
import { buildApiIndex, type PageApiAccumulator } from './output/build-api-index.js';
import { calculateScore } from './scoring/calculate-score.js';
import { getRiskLevel } from './scoring/risk-level.js';
import { generateIssues } from './rules/generate-issues.js';
import { buildPageDetail, type PageAnalysisData } from './output/build-page-detail.js';
import { buildPageSummary } from './output/build-page-summary.js';
import { buildSummary } from './output/build-summary.js';
import { writeJson } from './output/write-json.js';

export interface AnalyzeResult {
  summary: ProjectSummary;
  pages: PageDetail[];
  apiIndex: ApiIndex;
}

/**
 * 프로젝트 분석 진입점.
 * 대상 디렉토리를 받아 페이지별 분석 결과를 반환한다.
 *
 * 처리 흐름:
 * 1. 설정 로드 + 병합
 * 2. ts-morph Project 초기화
 * 3. 페이지 파일 탐색
 * 4. 각 페이지별: collectors → scoring → rules
 * 5. 결과 조립 (ProjectSummary + PageDetail[])
 * 6. JSON 출력 (옵션)
 */
export async function analyzeProject(
  targetDir: string,
  config?: Partial<PageDepMapConfig>,
): Promise<AnalyzeResult> {
  // 1. Load and merge config
  const fileConfig = await loadConfig(targetDir);
  const resolvedConfig = mergeConfig(fileConfig, config);

  // 2. Initialize ts-morph Project
  const tsConfigPath = resolvedConfig.tsConfigPath
    ? path.resolve(targetDir, resolvedConfig.tsConfigPath)
    : undefined;
  const project = createProject(tsConfigPath);

  // 3. Discover page files
  const pageEntries = collectPages(
    project,
    targetDir,
    resolvedConfig.pagePatterns,
    resolvedConfig.excludePatterns,
  );

  // 4. Analyze each page
  const pageDetails: PageDetail[] = [];
  const apiAccumulator: PageApiAccumulator[] = [];

  const absoluteTargetDir = path.resolve(targetDir);

  for (const entry of pageEntries) {
    try {
      const { detail, apiCallSites } = analyzePage(
        entry,
        resolvedConfig,
        project,
        absoluteTargetDir,
      );
      pageDetails.push(detail);
      apiAccumulator.push({
        pageName: detail.pageName,
        pageFilePath: detail.filePath,
        riskLevel: detail.metrics.riskLevel,
        callSites: apiCallSites,
      });
    } catch {
      // Skip pages that fail to analyze — log warning in future
      continue;
    }
  }

  // 5. Build project summary + API usage index
  const summary = buildSummary(pageDetails);
  const apiIndex = buildApiIndex(apiAccumulator);

  // 6. Write JSON output
  writeJson(resolvedConfig.outputDir, summary, pageDetails, apiIndex);

  return { summary, pages: pageDetails, apiIndex };
}

/**
 * 개별 페이지를 분석하여 PageDetail을 생성한다.
 */
function analyzePage(
  entry: { filePath: string; routePath: string; sourceFile: any },
  config: ReturnType<typeof mergeConfig>,
  project: ReturnType<typeof createProject>,
  baseDir: string,
): { detail: PageDetail; apiCallSites: ApiCallSite[] } {
  const { sourceFile, filePath, routePath } = entry;
  const pageName = derivePageName(filePath);

  // --- API calls (Phase 1: page file only) ---
  const rawApiCalls = collectApiCalls(sourceFile, filePath);
  const apiCallSites: ApiCallSite[] = rawApiCalls.map((c) => ({
    pageName,
    pageFilePath: filePath,
    componentName: c.componentName,
    filePath,
    line: c.line,
    method: c.method,
    path: c.path,
    callShape: c.callShape,
    confidence: c.confidence,
  }));

  // --- Collect ---

  // Props (SPEC 1.2)
  const propsResult = collectProps(sourceFile);
  const { props, spreadPropsDetected } = propsResult;

  // Hooks (SPEC 1.3)
  const hooksResult = collectHooks(
    sourceFile,
    config.storePatterns,
    config.queryPatterns,
  );

  // Children (SPEC 1.4)
  const childComponents = collectChildren(sourceFile);

  // Component tree (recursive resolve)
  const componentTreeResult = collectComponentTree(sourceFile, project, { baseDir });
  const componentTreeDepth = componentTreeResult.depth;
  const childComponentTree = componentTreeResult.tree;

  // Prop flows (SPEC 1.5)
  const propFlowResult = collectPropFlows(
    sourceFile,
    props,
    pageName,
    project,
    config.maxTraceDepth,
  );

  // Derived data (SPEC 1.6)
  const propNameSet = new Set(props.map((p) => p.name));
  const derivedDataProps = collectDerived(sourceFile, propNameSet);

  // Shared dependencies (SPEC 1.7)
  const sharedModules = collectShared(sourceFile, config.sharedPatterns);

  // Conditionals (SPEC 1.8)
  const conditionalBranchCount = collectConditionals(sourceFile);

  // --- Compute metrics ---
  const propsCount = props.length;
  const requiredPropsCount = props.filter((p) => p.required).length;
  const optionalPropsCount = propsCount - requiredPropsCount;

  const scoreInput = {
    propsCount,
    requiredPropsCount,
    maxDrillingDepth: propFlowResult.maxDrillingDepth,
    passThroughPropsCount: propFlowResult.passThroughPropsCount,
    hookCount: hooksResult.totalCount,
    queryCount: hooksResult.queryCount,
    storeUsageCount: hooksResult.storeCount,
    contextUsageCount: hooksResult.contextCount,
    effectCount: hooksResult.effectCount,
    conditionalBranchCount,
    childComponentCount: childComponents.length,
    derivedDataPropCount: derivedDataProps.length,
    sharedDependencyCount: sharedModules.length,
  };

  const complexityScore = calculateScore(scoreInput, config.weights);
  const riskLevel = getRiskLevel(complexityScore, config.thresholds);

  // --- Generate issues ---
  // Build a temporary PageSummary for rules evaluation
  const tempSummary: PageSummary = {
    pageName,
    filePath,
    routePath,
    complexityScore,
    riskLevel,
    propsCount,
    requiredPropsCount,
    optionalPropsCount,
    queryCount: hooksResult.queryCount,
    storeUsageCount: hooksResult.storeCount,
    contextUsageCount: hooksResult.contextCount,
    hookCount: hooksResult.totalCount,
    effectCount: hooksResult.effectCount,
    conditionalBranchCount,
    childComponentCount: childComponents.length,
    componentTreeDepth,
    maxDrillingDepth: propFlowResult.maxDrillingDepth,
    passThroughPropsCount: propFlowResult.passThroughPropsCount,
    derivedDataPropCount: derivedDataProps.length,
    sharedDependencyCount: sharedModules.length,
    deepestPropNames: propFlowResult.deepestProps.map((p) => p.name),
    unusedCandidateProps: propFlowResult.unusedCandidateProps,
    mainDependencyModules: sharedModules,
    likelyIssues: [],
  };

  const likelyIssues = generateIssues(
    tempSummary,
    config.rules,
    spreadPropsDetected,
  );

  // --- Build PageDetail ---
  const analysisData: PageAnalysisData = {
    pageName,
    filePath,
    routePath,
    directProps: props,
    hooks: hooksResult.hooks,
    queries: hooksResult.queries,
    stores: hooksResult.stores,
    contexts: hooksResult.contexts,
    sharedModules,
    childComponents,
    childComponentTree,
    propFlows: propFlowResult.propFlows,
    deepestProps: propFlowResult.deepestProps,
    derivedDataProps,
    likelyIssues,
    complexityScore,
    riskLevel,
    propsCount,
    requiredPropsCount,
    optionalPropsCount,
    queryCount: hooksResult.queryCount,
    storeUsageCount: hooksResult.storeCount,
    contextUsageCount: hooksResult.contextCount,
    hookCount: hooksResult.totalCount,
    effectCount: hooksResult.effectCount,
    conditionalBranchCount,
    childComponentCount: childComponents.length,
    componentTreeDepth,
    maxDrillingDepth: propFlowResult.maxDrillingDepth,
    passThroughPropsCount: propFlowResult.passThroughPropsCount,
    derivedDataPropCount: derivedDataProps.length,
    sharedDependencyCount: sharedModules.length,
  };

  return { detail: buildPageDetail(analysisData), apiCallSites };
}

/**
 * 파일 경로에서 페이지 이름을 도출한다.
 * app/users/[id]/page.tsx → users/[id]
 */
function derivePageName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');

  // Remove base dir prefix (app/ or pages/)
  let name = normalized
    .replace(/^(src\/)?app\//, '')
    .replace(/^(src\/)?pages\//, '');

  // Remove file name (page.tsx, index.tsx, etc.)
  name = name
    .replace(/\/page\.\w+$/, '')
    .replace(/\/index\.\w+$/, '')
    .replace(/\.\w+$/, '');

  // Handle root page
  if (name === '' || name === 'page' || name === 'index') {
    return 'root';
  }

  return name;
}

// Re-export for consumers
export type { PageDepMapConfig, ProjectSummary, PageDetail };
export { buildPageSummary } from './output/build-page-summary.js';
export { writeJson } from './output/write-json.js';
export {
  generateDependencyReports,
  type DependencyReport,
  type PageDependency,
  type DependencyTreeNode,
} from './reports/dependency-report.js';
export type { ResolvedConfig } from './config/merge-config.js';
