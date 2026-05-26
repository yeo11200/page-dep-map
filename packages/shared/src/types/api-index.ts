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
  /** Aggregated highest risk of the calling pages, for quick triage. */
  pageRiskSummary: Partial<Record<RiskLevel, number>>;
  /** Highest confidence found among call sites. */
  topConfidence: ApiCallConfidence;
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
}

export interface ApiIndex {
  endpoints: ApiEndpoint[];
  /** Sites that could not be attributed to any endpoint (low confidence
   * and/or fully dynamic). Kept separately so the index isn't polluted. */
  unresolved: ApiCallSite[];
  stats: ApiIndexStats;
}
