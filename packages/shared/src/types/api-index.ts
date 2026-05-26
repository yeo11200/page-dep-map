import type { RiskLevel } from './common.js';

/**
 * Confidence of a resolved API call site.
 *
 * - `high`   : URL string and method are statically known (direct
 *              fetch / axios literal / useSWR(literal) etc.)
 * - `medium` : Resolved via 1-hop wrapper or baseURL composition;
 *              still deterministic but depends on light heuristic.
 * - `low`    : Could not fully resolve. Path includes `<?>` markers
 *              or the call uses a generic `api.request(method, url)`
 *              pattern.
 */
export type ApiCallConfidence = 'high' | 'medium' | 'low';

export type ApiCallShape =
  | 'fetch'
  | 'axios'
  | 'ky'
  | 'ofetch'
  | 'react-query'
  | 'swr'
  | 'wrapped'
  | 'unknown';

export interface ApiCallSite {
  /** Page that owns this call (entry-point page name). */
  pageName: string;
  /** Page file path relative to the project root. */
  pageFilePath: string;
  /** The component that performs the call. Often the page itself, but
   * could be a child component reached through the component tree. */
  componentName: string;
  /** File the call was textually written in. */
  filePath: string;
  /** 1-based line number of the call expression. */
  line: number;
  /** HTTP method (uppercase). */
  method: string;
  /** Normalised path with :params. */
  path: string;
  /** Which library shape produced this call. */
  callShape: ApiCallShape;
  /** Confidence of the resolution. */
  confidence: ApiCallConfidence;
}

/**
 * Endpoints fall into three confidence tiers based on how the analyzer
 * was able to attribute them.
 *
 * - `reached`     : at least one page reaches this endpoint via the call
 *                   graph (page → component → hook → wrapper → api). The
 *                   `pages` list is the ground-truth consumer list.
 * - `orphan`      : the call site exists in indexed source files but no
 *                   page is wired to it through the call graph. Likely
 *                   dead code, middleware-only usage, or a wrapped-client
 *                   pattern the analyzer can't follow.
 * - `unsupported` : detected by a heuristic but the analyzer cannot
 *                   normalize / attribute it confidently (reserved for
 *                   future patterns; not emitted in v0).
 */
export type ApiEndpointTier = 'reached' | 'orphan' | 'unsupported';

/**
 * "If I change this endpoint, how much FE work?" — at a glance.
 *
 * Derived from the consumer chain + page-risk overlap. Not a perfect
 * single number, but enough to triage which endpoints need cross-team
 * coordination before a backwards-incompatible change ships.
 *
 *  - `critical` : 1+ consuming page is itself critical/warning risk,
 *                 OR 10+ pages depend on this endpoint.
 *  - `high`     : 5–9 pages, OR 20+ components transitively reach it.
 *  - `medium`   : 2–4 pages, OR 5–19 components.
 *  - `low`      : 0–1 page (orphans included here — nothing to break).
 */
export type ApiEndpointImpact = 'low' | 'medium' | 'high' | 'critical';

export interface ApiEndpointImpactBreakdown {
  /** Number of distinct pages reaching the endpoint (= pages.length). */
  pages: number;
  /** Number of consumer entries whose kind is 'hook' (typically the
   *  query/mutation wrappers). */
  hooks: number;
  /** Number of consumer entries whose kind is 'component'. */
  components: number;
  /** Number of consumer entries whose kind is 'api' (always 1+ for
   *  reached endpoints — the function holding the call). */
  api: number;
  /** Pages whose own risk-level is `warning` or `critical`. Surfaced
   *  so dashboards can flag the "this endpoint feeds a risky page"
   *  case even when overall page-count is modest. */
  riskyPages: number;
}

/**
 * One node in the upstream consumer chain of an endpoint. The chain is
 * computed by reverse-BFS over the project's call graph, starting at
 * the function that physically contains the API call.
 *
 * `hops`:
 *  - 0 = the api function itself (the body that holds `axios.get(...)`)
 *  - 1 = its immediate caller (typically a `useXxxQuery` / `useXxxMutation`
 *        wrapper hook)
 *  - 2 = a component that calls that hook
 *  - 3+ = further-removed components, layouts, pages
 *
 * `kind` is best-effort and based on name + file conventions:
 *  - `api`       : the API function itself (hops === 0)
 *  - `hook`      : name starts with `use` (React hook convention)
 *  - `page`      : the page-component (entry point)
 *  - `component` : everything else with PascalCase looking name
 *  - `unknown`   : couldn't classify
 */
export interface ApiConsumerEntry {
  name: string;
  /** Project-relative path of the file declaring this consumer. May be
   *  empty when the analyzer couldn't resolve an owner (rare). */
  filePath: string;
  kind: 'page' | 'component' | 'hook' | 'api' | 'unknown';
  hops: number;
}

export interface ApiEndpoint {
  /** Stable id, e.g. "GET /api/v1/users/:id". */
  id: string;
  method: string;
  /** Normalised path, e.g. "/api/v1/users/:id". */
  path: string;
  callSites: ApiCallSite[];
  referenceCount: number;
  /** Distinct pages that reach this endpoint. */
  pages: string[];
  /** Attribution tier — see ApiEndpointTier. Orphans are kept in the
   *  same list so the dashboard can filter / colour them rather than
   *  hide them. */
  tier: ApiEndpointTier;
  /** Full upstream consumer chain — every function/component the analyzer
   *  could resolve via reverse call-graph BFS from this endpoint's call
   *  site, with file path + kind + hop distance. Backend-impact view:
   *  the answer to "which FE symbols depend on this endpoint?". */
  consumers: ApiConsumerEntry[];
  /** Convenience: `consumers.length`. */
  consumerCount: number;
  /** Subset of `consumers` with `hops === 1` — the *immediate* callers
   *  of the api function. Almost always tiny (1–3 entries) and answers
   *  "where is this method actually invoked from" without the transitive
   *  noise that grows fast on deep component trees. */
  directCallers: ApiConsumerEntry[];
  /** Aggregated highest risk of the calling pages, for quick triage. */
  pageRiskSummary: Partial<Record<RiskLevel, number>>;
  /** Highest confidence found among call sites. */
  topConfidence: ApiCallConfidence;
  /** Single-tier severity of changing this endpoint. See ApiEndpointImpact. */
  impact: ApiEndpointImpact;
  /** Per-kind breakdown that backs the tier — exposed so dashboards can
   *  show "5 pages · 2 hooks · 8 components" alongside the colour
   *  badge for non-obvious cases. */
  impactBreakdown: ApiEndpointImpactBreakdown;
}

export interface ApiIndexStats {
  totalEndpoints: number;
  /** Endpoints with referenceCount === 0 (declared client methods that
   * no page reaches). */
  deadEndpoints: number;
  /** Endpoints with referenceCount >= 5 by default. */
  hotEndpoints: number;
  /** Number of detected call sites that couldn't be resolved to a
   * concrete endpoint. Surfaced in dashboard as "Unresolved". */
  uncategorized: number;
  /** Endpoints reached by at least one page via call graph. */
  reachedEndpoints: number;
  /** Endpoints found in source but not reached by any page — likely
   *  dead code or wrapper patterns the analyzer can't follow. */
  orphanEndpoints: number;
}

export interface ApiIndex {
  endpoints: ApiEndpoint[];
  /** Sites that could not be attributed to any endpoint (low confidence
   * and/or fully dynamic). Kept separately so the index isn't polluted. */
  unresolved: ApiCallSite[];
  stats: ApiIndexStats;
}
