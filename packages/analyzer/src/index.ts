import * as path from 'node:path';
import type { SourceFile } from 'ts-morph';
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
import {
  collectApiCalls,
  collectApiCallsInNode,
  collectInvokedNames,
  setExtraAxiosInstances,
  resetExtraAxiosInstances,
  type RawApiCall,
} from './collectors/collect-api-calls.js';
import { Node, SyntaxKind } from 'ts-morph';
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

  // 3.5 Discover project-defined axios/ky/ofetch instance variables so
  // that subsequent collection passes treat `clientApi.get(...)` (where
  // `clientApi = axios.create()`) the same as `axios.get(...)`. The
  // discovered names live in a module-level set inside the api-call
  // collector — reset first to avoid cross-run leakage in tests.
  resetExtraAxiosInstances();
  const absoluteTargetDir = path.resolve(targetDir);
  const discovered = discoverAxiosInstances(pageEntries);
  if (discovered.size > 0) setExtraAxiosInstances(discovered);

  // 4. Analyze each page
  const pageDetails: PageDetail[] = [];
  const apiAccumulator: PageApiAccumulator[] = [];

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

  // 4.5 Phase 3 — wrapped client resolution.
  // For each page, follow its import graph (depth-limited BFS) and run
  // collectApiCalls on every reachable file inside the target. Call sites
  // are then attributed back to the pages that transitively reach them.
  // This catches the common pattern where pages call query hooks which
  // wrap `axios`/`api` instances in a separate module.
  const {
    endpointConsumers,
    consumerInvokesHook,
    consumerInvokesDirectHook,
    nameToFilePath,
    pageComponentNames,
    orphanCalls,
  } = resolveWrappedApiCalls(pageEntries, apiAccumulator, absoluteTargetDir);

  // 5. Build project summary + API usage index
  const summary = buildSummary(pageDetails);
  const apiIndex = buildApiIndex(apiAccumulator, {
    endpointConsumers,
    consumerInvokesHook,
    consumerInvokesDirectHook,
    nameToFilePath,
    pageComponentNames,
    orphanCalls,
  });

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

/**
 * Phase 3 — attribute API calls from imported modules back to the pages
 * that transitively reach them, **by named export** rather than by file.
 *
 * Why named-export attribution:
 *   A barrel-style api module (e.g. `src/api/auth/index.ts`) typically
 *   exports many independent functions — `postLogin`, `postLogout`,
 *   `getMyAccount`, etc. File-level attribution caused every such call
 *   to be assigned to every page that imported *anything* from the
 *   module's directory, inflating reference counts up to "all pages".
 *
 * Algorithm:
 *   1. Pass 1: gather files reachable from each page (depth-limited BFS).
 *      Skip `node_modules` and re-use the same SourceFile across pages.
 *   2. Pass 2: index each reachable file by its top-level exports.
 *      For each `export const fn = (…) => {…}` / `export function fn() {…}`
 *      record (a) the API call sites inside the body, (b) the names of
 *      other functions the body invokes (the call-graph edges).
 *   3. Pass 3: per page, start from the set of names the page (and the
 *      files it transitively imports through default/namespace imports
 *      → wildcard) directly imports, then expand by walking the call
 *      graph until a fixed point. Every reached function's API calls
 *      are pushed into the page's accumulator.
 *
 * Default/namespace imports degrade to wildcard for that file because
 * we cannot tell statically which exported binding will be used.
 */
// Custody-client style chains run deep:
//   page → component → sub-component → modal → query hook → api wrapper → axios
// That's already 6 hops. The visited-set in BFS prevents cycles, so a
// generous ceiling is cheap. Keep it high enough that mid-size apps
// don't lose their tail-end api modules.
const IMPORT_DEPTH = 12;

// Composite function key — `${absolutePath}:::${exportName}`. Disambiguates
// `Detail` (Admin) vs `Detail` (Accounts) etc., which the old name-only
// keying conflated into one call-graph node.
const KEY_SEP = ':::';
const DEFAULT_KEY = '<default>';

function makeKey(absPath: string, name: string): string {
  return absPath + KEY_SEP + name;
}

function parseKey(key: string): { absPath: string; name: string } {
  const i = key.lastIndexOf(KEY_SEP);
  if (i < 0) return { absPath: '', name: key };
  return { absPath: key.slice(0, i), name: key.slice(i + KEY_SEP.length) };
}

interface ExportEntry {
  apiCalls: RawApiCall[];
  /** Composite keys of functions invoked from this body, resolved
   *  against the parent file's importMap. Library calls and identifiers
   *  that aren't imported / locally declared are dropped at resolution
   *  so the graph stays scoped to in-project edges. */
  calledKeys: Set<string>;
}

interface FileExportIndex {
  filePath: string; // absolute
  exports: Map<string, ExportEntry>;
  /** All exported (and aliased — `<default>`, filename-synthetic) names
   *  registered for this file. Other files' importMaps point at members
   *  of this set. */
  allNames: Set<string>;
  /** This file's name-resolution table: every local identifier that
   *  could be invoked → the composite key of the function it refers to.
   *  Populated from named imports + default imports + local top-level
   *  declarations + same-file re-exports. */
  importMap: Map<string, string>;
}

/** Internal: minHops keyed by composite function key for one endpoint. */
type EndpointHopMap = Map<string, number>;

function resolveWrappedApiCalls(
  pageEntries: Array<{ filePath: string; sourceFile: SourceFile }>,
  apiAccumulator: PageApiAccumulator[],
  absoluteTargetDir: string,
): {
  endpointConsumers: Map<string, EndpointHopMap>;
  /** Per-endpoint, per-consumer-key: does this consumer's body actually
   *  call a hook/api in the chain (true) or does it only render other
   *  components (false)? Used by the dashboard to split "active hook
   *  consumers" from "render-path wrappers". */
  consumerInvokesHook: Map<string, Map<string, boolean>>;
  /** Per-endpoint, per-consumer: does this consumer call the endpoint's
   *  direct (hop-1) hook in its own body? */
  consumerInvokesDirectHook: Map<string, Map<string, boolean>>;
  nameToFilePath: Map<string, string>;
  pageComponentNames: Set<string>;
  orphanCalls: RawApiCall[];
} {
  // Pass 1a: BFS reach from every page to discover the set of files we
  // need to index. Index each file once.
  const fileIndex = new Map<string, FileExportIndex>();
  const reachedFiles = new Set<SourceFile>();
  for (const entry of pageEntries) {
    const reach = gatherReachableFiles(entry.sourceFile, IMPORT_DEPTH);
    for (const sf of reach) reachedFiles.add(sf);
  }

  // Pass 1b: collect the export-name surface of every reached file
  // BEFORE building importMaps. This lets the importMap pass enrich
  // each file's resolution table with composite keys (`X.method` for
  // object-literal wrappers exported by another file), unlocking task
  // #2: `userApi.getById()` style PropertyAccess wrapper calls.
  const globalExportNames = new Map<string, Set<string>>();
  for (const sf of reachedFiles) {
    globalExportNames.set(sf.getFilePath(), collectExportNames(sf));
  }

  // Pass 2: full index — exports + importMap + body scans. indexFileExports
  // consults globalExportNames so the importMap for file F can include
  // composite `X.method` entries pointing at target file's
  // `X.method` export when F imports `X`.
  for (const sf of reachedFiles) {
    const absPath = sf.getFilePath();
    if (fileIndex.has(absPath)) continue;
    const rel = path.relative(absoluteTargetDir, absPath);
    fileIndex.set(absPath, indexFileExports(sf, rel, globalExportNames));
  }

  // Per-entry canonical key. The same function can be exposed under
  // several names in a file (its declared name, `<default>`, re-export
  // aliases) — without collapsing them, the reverse graph creates one
  // node per alias and the same function shows up several times in the
  // consumer chain. Pick a single canonical key per entry (prefer the
  // declared name; fall back to `<default>`).
  const entryCanonicalKey = new Map<ExportEntry, string>();
  for (const [absPath, idx] of fileIndex) {
    for (const [name, entry] of idx.exports) {
      const existing = entryCanonicalKey.get(entry);
      if (!existing) {
        entryCanonicalKey.set(entry, makeKey(absPath, name));
      } else if (name !== DEFAULT_KEY && existing.endsWith(KEY_SEP + DEFAULT_KEY)) {
        // Upgrade `<default>` to a real declared name when one exists.
        entryCanonicalKey.set(entry, makeKey(absPath, name));
      }
    }
  }

  const normalizeKey = (key: string): string => {
    const { absPath, name } = parseKey(key);
    const idx = fileIndex.get(absPath);
    if (!idx) return key;
    const entry = idx.exports.get(name);
    if (!entry) return key;
    return entryCanonicalKey.get(entry) ?? key;
  };

  // Build reverse call graph keyed by canonical function keys. Each
  // edge points FROM a callee's canonical key TO the canonical key of
  // a caller. Aliased imports of the same function (default + named +
  // re-export) all collapse onto the same node.
  const reverseGraph = new Map<string, Set<string>>();
  const seenEntriesForGraph = new Set<ExportEntry>();
  for (const [, idx] of fileIndex) {
    for (const entry of idx.exports.values()) {
      if (seenEntriesForGraph.has(entry)) continue;
      seenEntriesForGraph.add(entry);
      const callerKey = entryCanonicalKey.get(entry);
      if (!callerKey) continue;
      for (const rawCalleeKey of entry.calledKeys) {
        const calleeKey = normalizeKey(rawCalleeKey);
        let callers = reverseGraph.get(calleeKey);
        if (!callers) {
          callers = new Set();
          reverseGraph.set(calleeKey, callers);
        }
        callers.add(callerKey);
      }
    }
  }

  const endpointConsumers = new Map<string, EndpointHopMap>();
  const recordConsumers = (
    method: string,
    pathStr: string,
    callingFileAbs: string,
    componentName: string,
  ): void => {
    const id = `${method} ${pathStr}`;
    let map = endpointConsumers.get(id);
    if (!map) {
      map = new Map();
      endpointConsumers.set(id, map);
    }
    // Normalize the start key — the function holding the api call may
    // be registered under multiple aliases; we want the canonical one
    // so BFS doesn't double-count aliases of the same entry.
    const startKey = normalizeKey(makeKey(callingFileAbs, componentName));
    reverseBfsWithHops(startKey, reverseGraph, map);
  };

  // Page-direct calls (attached by analyzePage before Phase 3 ran) —
  // their containing file is the page file itself.
  for (const acc of apiAccumulator) {
    for (const site of acc.callSites) {
      const callingFileAbs = path.resolve(absoluteTargetDir, site.filePath);
      recordConsumers(site.method, site.path, callingFileAbs, site.componentName);
    }
  }

  // Pass 3: per-page attribution via call-graph expansion. Seed is each
  // page file's own importMap values (external functions it imports) +
  // its own local declarations (so page-direct calls work too).
  for (const entry of pageEntries) {
    const pageName = derivePageName(entry.filePath);
    const acc = apiAccumulator.find((a) => a.pageName === pageName);
    if (!acc) continue;
    const pageFileAbs = entry.sourceFile.getFilePath();
    const pageIdx = fileIndex.get(pageFileAbs);
    if (!pageIdx) continue;

    const seed = new Set<string>();
    // Resolved imports of the page file.
    for (const key of pageIdx.importMap.values()) seed.add(key);
    // The page's own top-level functions (its default export covers the
    // case where the call graph starts from the page component itself).
    for (const name of pageIdx.exports.keys()) {
      seed.add(makeKey(pageFileAbs, name));
    }

    const apiCalls = expandReachableApiCalls(seed, fileIndex);
    for (const c of apiCalls) {
      acc.callSites.push({
        pageName,
        pageFilePath: acc.pageFilePath,
        componentName: c.componentName,
        filePath: c.filePath,
        line: c.line,
        method: c.method,
        path: c.path,
        callShape: c.callShape,
        confidence: c.confidence,
      });
      const callingFileAbs = path.resolve(absoluteTargetDir, c.filePath);
      recordConsumers(c.method, c.path, callingFileAbs, c.componentName);
    }
  }

  // Orphan pass — every API call that was indexed in any reachable file
  // but never attributed to a page. These are the gap between
  // "what the analyzer can see in source" and "what pages actually
  // reach via the call graph".
  const attributedCoords = new Set<string>();
  for (const acc of apiAccumulator) {
    for (const site of acc.callSites) {
      attributedCoords.add(`${site.filePath}:${site.line}`);
    }
  }
  const orphanCalls: RawApiCall[] = [];
  const orphanCoords = new Set<string>();
  for (const idx of fileIndex.values()) {
    for (const entry of idx.exports.values()) {
      for (const c of entry.apiCalls) {
        const coord = `${c.filePath}:${c.line}`;
        if (attributedCoords.has(coord)) continue;
        if (orphanCoords.has(coord)) continue;
        orphanCoords.add(coord);
        orphanCalls.push(c);
        const callingFileAbs = path.resolve(absoluteTargetDir, c.filePath);
        recordConsumers(c.method, c.path, callingFileAbs, c.componentName);
      }
    }
  }

  // key → project-relative filePath, used by the output materializer
  // when decoding consumer keys for the dashboard.
  const nameToFilePath = new Map<string, string>();
  for (const [absPath, idx] of fileIndex) {
    const rel = path.relative(absoluteTargetDir, absPath);
    for (const name of idx.allNames) {
      nameToFilePath.set(makeKey(absPath, name), rel);
    }
  }

  // Page-component KEYS (not bare names) — so classification can label
  // them precisely without collision risk between e.g. `[id]` pages in
  // different directories.
  const pageComponentNames = new Set<string>();
  for (const entry of pageEntries) {
    const absPath = entry.sourceFile.getFilePath();
    const idx = fileIndex.get(absPath);
    if (!idx) continue;
    for (const name of idx.exports.keys()) {
      pageComponentNames.add(makeKey(absPath, name));
    }
  }

  // For each endpoint, classify every consumer key. Two booleans:
  //  invokesHook       — calls any hook/api in the chain
  //  invokesDirectHook — calls the endpoint's *direct* (hop-1) hook
  // The latter lets the dashboard split "directly uses this endpoint"
  // from "uses a downstream hook that wraps it" without the user
  // having to read individual hop numbers.
  const consumerInvokesHook = new Map<string, Map<string, boolean>>();
  const consumerInvokesDirectHook = new Map<string, Map<string, boolean>>();
  for (const [endpointId, hopMap] of endpointConsumers) {
    const chainKeys = new Set(hopMap.keys());
    const directHookKeys = new Set<string>();
    for (const [key, hops] of hopMap) {
      if (hops === 1) directHookKeys.add(key);
    }
    const anyFlags = new Map<string, boolean>();
    const directFlags = new Map<string, boolean>();
    for (const key of chainKeys) {
      anyFlags.set(key, computeInvokesHook(key, chainKeys, fileIndex, normalizeKey));
      directFlags.set(
        key,
        computeInvokesDirectHook(key, directHookKeys, fileIndex, normalizeKey),
      );
    }
    consumerInvokesHook.set(endpointId, anyFlags);
    consumerInvokesDirectHook.set(endpointId, directFlags);
  }

  return {
    endpointConsumers,
    consumerInvokesHook,
    consumerInvokesDirectHook,
    nameToFilePath,
    pageComponentNames,
    orphanCalls,
  };
}

function computeInvokesDirectHook(
  key: string,
  directHookKeys: Set<string>,
  fileIndex: Map<string, FileExportIndex>,
  normalizeKey: (k: string) => string,
): boolean {
  // The direct hop-1 hooks themselves don't "invoke" anything at hop 1
  // (they call the hop-0 api), so they're false here. UI surfaces them
  // separately via the "Direct callers" pinned section.
  if (directHookKeys.has(key)) return false;
  const { absPath, name } = parseKey(key);
  const idx = fileIndex.get(absPath);
  const entry = idx?.exports.get(name);
  if (!entry) return false;
  for (const rawCalled of entry.calledKeys) {
    const canonical = normalizeKey(rawCalled);
    if (directHookKeys.has(canonical)) return true;
  }
  return false;
}

function computeInvokesHook(
  key: string,
  chainKeys: Set<string>,
  fileIndex: Map<string, FileExportIndex>,
  normalizeKey: (k: string) => string,
): boolean {
  const { absPath, name } = parseKey(key);
  // hop 0 (api) and hop 1 (the direct hook wrapper) trivially invoke
  // something in the chain — themselves. Marking true keeps UI logic
  // uniform without special-casing.
  if (/^use[A-Z]/.test(name)) return true;
  if (/^[a-z]/.test(name)) return true; // api function or helper
  // For components and unknowns, check the body for a call to any
  // chain hook/api.
  const idx = fileIndex.get(absPath);
  const entry = idx?.exports.get(name);
  if (!entry) return false;
  for (const rawCalled of entry.calledKeys) {
    const canonical = normalizeKey(rawCalled);
    if (!chainKeys.has(canonical)) continue;
    const calledName = parseKey(canonical).name;
    if (/^use[A-Z]/.test(calledName) || /^[a-z]/.test(calledName)) return true;
  }
  return false;
}

function reverseBfsWithHops(
  start: string,
  reverseGraph: Map<string, Set<string>>,
  out: Map<string, number>,
): void {
  const queue: Array<[string, number]> = [[start, 0]];
  while (queue.length > 0) {
    const [n, hops] = queue.shift()!;
    const current = out.get(n);
    if (current !== undefined && current <= hops) continue;
    out.set(n, hops);
    const callers = reverseGraph.get(n);
    if (!callers) continue;
    for (const c of callers) {
      // Allow re-enqueueing if we have a strictly shorter path.
      const known = out.get(c);
      if (known === undefined || known > hops + 1) {
        queue.push([c, hops + 1]);
      }
    }
  }
}

/**
 * Depth-limited BFS over the import graph from a single page file.
 * Returns the set of SourceFiles reachable, so they can each be indexed
 * exactly once. The depth limit is per-edge, not per-name; the high
 * ceiling (12) is cheap because the visited set bounds total work.
 */
function gatherReachableFiles(
  rootFile: SourceFile,
  maxDepth: number,
): Set<SourceFile> {
  const allFiles = new Set<SourceFile>();
  const visitedPaths = new Set<string>();
  const queue: Array<[SourceFile, number]> = [[rootFile, 0]];

  while (queue.length > 0) {
    const [file, depth] = queue.shift()!;
    const fp = file.getFilePath();
    if (visitedPaths.has(fp)) continue;
    visitedPaths.add(fp);
    allFiles.add(file);
    if (depth >= maxDepth) continue;

    for (const imp of file.getImportDeclarations()) {
      let target: SourceFile | undefined;
      try {
        target = imp.getModuleSpecifierSourceFile();
      } catch {
        continue;
      }
      if (!target) continue;
      const targetPath = target.getFilePath();
      if (targetPath.includes('/node_modules/')) continue;
      if (!visitedPaths.has(targetPath)) {
        queue.push([target, depth + 1]);
      }
    }
    // Re-exports (`export { foo } from './bar'`) also bring files into
    // reach — without following them, indexed re-export entries would
    // forward to nodes we never indexed.
    for (const ex of file.getExportDeclarations()) {
      const targetSpec = ex.getModuleSpecifierValue();
      if (!targetSpec) continue;
      let target: SourceFile | undefined;
      try {
        target = ex.getModuleSpecifierSourceFile();
      } catch {
        continue;
      }
      if (!target) continue;
      const tp = target.getFilePath();
      if (tp.includes('/node_modules/')) continue;
      if (!visitedPaths.has(tp)) {
        queue.push([target, depth + 1]);
      }
    }
  }

  return allFiles;
}

/**
 * Index a single SourceFile: build both
 *   (a) `importMap` — every identifier this file can invoke (named imports,
 *       default imports, local top-level declarations, same-module
 *       re-exports) → composite key of the function it refers to.
 *   (b) `exports`   — each top-level exported function's API calls + the
 *       `calledKeys` set produced by resolving identifiers in its body
 *       through the importMap.
 *
 * Two passes per file: first the importMap (so identifiers in bodies
 * can be resolved), then the export bodies. Default exports are
 * registered under both their declared name and the magic `<default>`
 * key so consumers' default imports land on the same entry.
 *
 * Task #3 (re-exports `export { foo } from './bar'`) is handled here:
 * the re-exported name gets an importMap entry pointing to the source
 * file, AND an exports entry whose body forwards via `calledKeys` so
 * downstream callers reach the original definition.
 */
/**
 * Phase 1b — collect the surface of exported names for a file without
 * scanning function bodies. Includes both regular top-level exports and
 * each function-typed property of object-literal exports (so
 * `export const userApi = { getById: ..., update: ... }` exposes
 * `userApi`, `userApi.getById`, `userApi.update`). The output drives
 * cross-file resolution of `X.method` invocations in Phase 2.
 */
function collectExportNames(sf: SourceFile): Set<string> {
  const names = new Set<string>();
  for (const stmt of sf.getStatements()) {
    if (Node.isVariableStatement(stmt)) {
      if (!stmt.hasExportKeyword()) continue;
      for (const decl of stmt.getDeclarationList().getDeclarations()) {
        const name = decl.getName();
        names.add(name);
        const init = decl.getInitializer();
        if (init && Node.isObjectLiteralExpression(init)) {
          for (const prop of init.getProperties()) {
            if (Node.isPropertyAssignment(prop)) {
              const propName = prop.getNameNode().getText();
              const propInit = prop.getInitializer();
              if (
                propInit &&
                (Node.isArrowFunction(propInit) || Node.isFunctionExpression(propInit))
              ) {
                names.add(`${name}.${propName}`);
              }
            } else if (Node.isMethodDeclaration(prop) || Node.isShorthandPropertyAssignment(prop)) {
              // `{ method() {} }` shorthand or `{ method }` value-shorthand.
              const propName = prop.getName?.();
              if (propName) names.add(`${name}.${propName}`);
            }
          }
        }
      }
    } else if (Node.isFunctionDeclaration(stmt)) {
      if (!stmt.hasExportKeyword()) continue;
      const name = stmt.getName();
      if (name) names.add(name);
    } else if (Node.isExportDeclaration(stmt)) {
      for (const ns of stmt.getNamedExports()) {
        names.add(ns.getAliasNode()?.getText() ?? ns.getNameNode().getText());
      }
    }
  }
  return names;
}

function indexFileExports(
  sf: SourceFile,
  projectRelativePath: string,
  globalExportNames: Map<string, Set<string>>,
): FileExportIndex {
  const absPath = sf.getFilePath();
  const exports = new Map<string, ExportEntry>();
  const locals = new Map<string, ExportEntry>();
  const importMap = new Map<string, string>();

  // PASS 1 — build importMap.
  for (const imp of sf.getImportDeclarations()) {
    let target: SourceFile | undefined;
    try {
      target = imp.getModuleSpecifierSourceFile();
    } catch {
      continue;
    }
    if (!target) continue;
    const targetPath = target.getFilePath();
    if (targetPath.includes('/node_modules/')) continue;

    const targetExports = globalExportNames.get(targetPath);
    for (const ni of imp.getNamedImports()) {
      const localName = ni.getAliasNode()?.getText() ?? ni.getName();
      const targetExportName = ni.getName();
      importMap.set(localName, makeKey(targetPath, targetExportName));
      // Task #2 — for object-literal wrappers, also pre-register every
      // composite `localName.method` so a later body call to
      // `userApi.getById()` resolves to the correct entry without a
      // runtime lookup.
      if (targetExports) {
        const prefix = `${targetExportName}.`;
        for (const exportName of targetExports) {
          if (exportName.startsWith(prefix)) {
            const member = exportName.slice(prefix.length);
            importMap.set(`${localName}.${member}`, makeKey(targetPath, exportName));
          }
        }
      }
    }
    const defaultImp = imp.getDefaultImport();
    if (defaultImp) {
      importMap.set(defaultImp.getText(), makeKey(targetPath, DEFAULT_KEY));
    }
    // Namespace imports (`import * as X from`) — we'd need to expand
    // every export of the target. Skip for v0 to keep the graph tight.
  }

  // Same-file local top-level declarations also resolve via importMap.
  // We register them BEFORE scanning bodies so any local helper invoked
  // from within an exported function lands in calledKeys correctly.
  for (const stmt of sf.getStatements()) {
    if (Node.isVariableStatement(stmt)) {
      for (const decl of stmt.getDeclarationList().getDeclarations()) {
        const name = decl.getName();
        const init = decl.getInitializer();
        if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
          importMap.set(name, makeKey(absPath, name));
        }
      }
    } else if (Node.isFunctionDeclaration(stmt)) {
      const name = stmt.getName();
      if (name) importMap.set(name, makeKey(absPath, name));
    }
  }

  // PASS 2 — scan exports + bodies, resolving identifier references
  // through importMap.
  for (const stmt of sf.getStatements()) {
    if (Node.isVariableStatement(stmt)) {
      const isExported = stmt.hasExportKeyword();
      for (const decl of stmt.getDeclarationList().getDeclarations()) {
        const name = decl.getName();
        const init = decl.getInitializer();
        if (!init) continue;
        if (Node.isArrowFunction(init) || Node.isFunctionExpression(init)) {
          const entry = indexFunctionBody(init, projectRelativePath, importMap);
          (isExported ? exports : locals).set(name, entry);
        } else if (isExported && Node.isObjectLiteralExpression(init)) {
          // Task #2 — object-literal wrappers like
          // `export const userApi = { getById: (id) => api.get(...) }`.
          // Index each function-typed property under a composite name
          // so consumers' `userApi.getById()` calls resolve through the
          // call graph just like a normal function export.
          for (const prop of init.getProperties()) {
            if (Node.isPropertyAssignment(prop)) {
              const propName = prop.getNameNode().getText();
              const propInit = prop.getInitializer();
              if (
                propInit &&
                (Node.isArrowFunction(propInit) || Node.isFunctionExpression(propInit))
              ) {
                const memberEntry = indexFunctionBody(
                  propInit,
                  projectRelativePath,
                  importMap,
                );
                exports.set(`${name}.${propName}`, memberEntry);
              }
            }
          }
        }
      }
    } else if (Node.isFunctionDeclaration(stmt)) {
      const name = stmt.getName();
      if (!name) continue;
      const entry = indexFunctionBody(stmt, projectRelativePath, importMap);
      if (stmt.hasExportKeyword()) {
        exports.set(name, entry);
        if (isDefaultExport(stmt)) {
          // Default imports (and JSX usage of default-imported bindings)
          // always resolve through this `<default>` alias key — no need
          // to also register under a filename-derived synthetic name,
          // which would just create phantom caller nodes in the reverse
          // graph (one real function appearing as several "consumers").
          if (!exports.has(DEFAULT_KEY)) exports.set(DEFAULT_KEY, entry);
        }
      } else {
        locals.set(name, entry);
      }
    } else if (Node.isExportAssignment(stmt) && !stmt.isExportEquals()) {
      // `export default <expr>`
      const expr = stmt.getExpression();
      if (Node.isIdentifier(expr)) {
        const refName = expr.getText();
        const local = locals.get(refName);
        if (local) {
          if (!exports.has(refName)) exports.set(refName, local);
          if (!exports.has(DEFAULT_KEY)) exports.set(DEFAULT_KEY, local);
        }
      } else if (Node.isArrowFunction(expr) || Node.isFunctionExpression(expr)) {
        const entry = indexFunctionBody(expr, projectRelativePath, importMap);
        if (!exports.has(DEFAULT_KEY)) exports.set(DEFAULT_KEY, entry);
      }
    } else if (Node.isExportDeclaration(stmt)) {
      // Task #3 — `export { foo } from './bar'` and `export { foo }`.
      const targetSpec = stmt.getModuleSpecifierValue();
      const namedExports = stmt.getNamedExports();
      if (namedExports.length === 0) continue; // `export *` not handled in v0
      if (targetSpec) {
        let target: SourceFile | undefined;
        try {
          target = stmt.getModuleSpecifierSourceFile();
        } catch {
          continue;
        }
        if (!target) continue;
        const targetPath = target.getFilePath();
        if (targetPath.includes('/node_modules/')) continue;
        for (const ns of namedExports) {
          const sourceName = ns.getNameNode().getText();
          const exposedName = ns.getAliasNode()?.getText() ?? sourceName;
          const targetKey = makeKey(targetPath, sourceName);
          // The exposed name in THIS file should resolve to the target.
          importMap.set(exposedName, targetKey);
          // Forwarding export entry — callers entering through us still
          // reach the original definition's apiCalls via calledKeys.
          if (!exports.has(exposedName)) {
            exports.set(exposedName, {
              apiCalls: [],
              calledKeys: new Set([targetKey]),
            });
          }
        }
      } else {
        // `export { foo }` — names declared locally; promote them.
        for (const ns of namedExports) {
          const localName = ns.getNameNode().getText();
          const exposedName = ns.getAliasNode()?.getText() ?? localName;
          const local = locals.get(localName);
          if (local && !exports.has(exposedName)) {
            exports.set(exposedName, local);
          }
        }
      }
    }
  }

  // Merge local (non-exported) top-level functions into the export map
  // so they participate in the call graph. The common pattern
  //   function HelperMain() { useFooMutation(); }
  //   export default function Wrapper() { return <HelperMain />; }
  // would otherwise leave HelperMain — the real consumer — invisible to
  // reverse BFS. Locals don't widen the public surface (page-seeding
  // pulls from importMap of OTHER files, not allNames here), so this is
  // safe.
  for (const [name, entry] of locals) {
    if (!exports.has(name)) exports.set(name, entry);
  }

  return {
    filePath: absPath,
    exports,
    allNames: new Set(exports.keys()),
    importMap,
  };
}

/**
 * Sweep reachable source files (depth-limited BFS from each page) for
 * top-level variable declarations whose initializer is `axios.create()`
 * / `ky.create()` / `ofetch.create()`. Return the variable names — the
 * api-call collector consults this set in addition to the hardcoded
 * `axios`/`api`/`http` whitelist, so a project's own client wrapper
 * (e.g. `clientApi = axios.create()`) is recognized without manual
 * configuration.
 */
function discoverAxiosInstances(
  pageEntries: Array<{ sourceFile: SourceFile }>,
): Set<string> {
  const names = new Set<string>();
  const visited = new Set<string>();
  const queue: Array<[SourceFile, number]> = pageEntries.map((e) => [e.sourceFile, 0]);

  while (queue.length > 0) {
    const [file, depth] = queue.shift()!;
    const fp = file.getFilePath();
    if (visited.has(fp)) continue;
    visited.add(fp);

    for (const stmt of file.getStatements()) {
      if (!Node.isVariableStatement(stmt)) continue;
      for (const decl of stmt.getDeclarationList().getDeclarations()) {
        const init = decl.getInitializer();
        if (!init || !Node.isCallExpression(init)) continue;
        const callExpr = init.getExpression();
        if (!Node.isPropertyAccessExpression(callExpr)) continue;
        const owner = callExpr.getExpression().getText();
        const method = callExpr.getName();
        if (
          method === 'create' &&
          (owner === 'axios' || owner === 'ky' || owner === 'ofetch')
        ) {
          names.add(decl.getName());
        }
      }
    }

    if (depth >= IMPORT_DEPTH) continue;
    for (const imp of file.getImportDeclarations()) {
      let target: SourceFile | undefined;
      try {
        target = imp.getModuleSpecifierSourceFile();
      } catch {
        continue;
      }
      if (!target) continue;
      const tp = target.getFilePath();
      if (tp.includes('/node_modules/')) continue;
      if (!visited.has(tp)) queue.push([target, depth + 1]);
    }
  }

  return names;
}

function isDefaultExport(stmt: import('ts-morph').FunctionDeclaration): boolean {
  // `getModifiers()` returns the syntax-level keyword tokens, and the
  // text comparison is the most robust way across ts-morph versions.
  return stmt.getModifiers().some((m) => m.getText() === 'default');
}

function aliasDefault(
  exports: Map<string, ExportEntry>,
  entry: ExportEntry,
  relativePath: string,
  primaryName: string,
): void {
  const synthetic = syntheticNameFromPath(relativePath);
  if (synthetic && synthetic !== primaryName && !exports.has(synthetic)) {
    exports.set(synthetic, entry);
  }
}

function syntheticNameFromPath(relativePath: string): string | null {
  // 'components/Admin/index.tsx' → 'Admin'
  // 'components/Header.tsx'      → 'Header'
  const normalised = relativePath.replace(/\\/g, '/');
  const parts = normalised.split('/');
  const last = parts[parts.length - 1]?.replace(/\.[^.]+$/, '');
  if (!last) return null;
  if (last === 'index' && parts.length >= 2) {
    const parent = parts[parts.length - 2];
    return parent || null;
  }
  return last;
}

function indexFunctionBody(
  node: Node,
  projectRelativePath: string,
  importMap: Map<string, string>,
): ExportEntry {
  const apiCalls = collectApiCallsInNode(node, projectRelativePath);
  const invokedNames = collectInvokedNames(node);
  // Resolve every invoked identifier through the calling file's
  // importMap. Names that don't resolve (local vars, library imports,
  // destructured fields, etc.) are dropped — they have no in-project
  // edge to follow.
  const calledKeys = new Set<string>();
  for (const name of invokedNames) {
    const key = importMap.get(name);
    if (key) calledKeys.add(key);
  }
  return { apiCalls, calledKeys };
}

/**
 * BFS the call graph by composite key. Each key uniquely identifies a
 * (file, exportedName) pair so name collisions between unrelated files
 * (`Detail` in Admin vs Accounts) no longer merge into one node.
 */
function expandReachableApiCalls(
  seed: Set<string>,
  fileIndex: Map<string, FileExportIndex>,
): RawApiCall[] {
  const apiCalls: RawApiCall[] = [];
  const visited = new Set<string>();
  const queue = [...seed];

  while (queue.length > 0) {
    const key = queue.shift()!;
    if (visited.has(key)) continue;
    visited.add(key);
    const { absPath, name } = parseKey(key);
    const idx = fileIndex.get(absPath);
    if (!idx) continue;
    const entry = idx.exports.get(name);
    if (!entry) continue;
    for (const c of entry.apiCalls) apiCalls.push(c);
    for (const nextKey of entry.calledKeys) {
      if (!visited.has(nextKey)) queue.push(nextKey);
    }
  }
  return apiCalls;
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
