import type {
  ApiCallSite,
  ApiEndpoint,
  ApiIndex,
  ApiCallConfidence,
  RiskLevel,
} from '@page-dep-map/shared';

export interface PageApiAccumulator {
  pageName: string;
  pageFilePath: string;
  riskLevel: RiskLevel;
  callSites: ApiCallSite[];
}

const CONFIDENCE_ORDER: Record<ApiCallConfidence, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

/**
 * Reverse-index per-page call sites into endpoint groups.
 *
 * Endpoint id is `${METHOD} ${PATH}`. Sites whose confidence is `low`
 * fall into the `unresolved` bucket so the dashboard can show them
 * separately.
 */
export function buildApiIndex(
  pages: PageApiAccumulator[],
  options: { hotThreshold?: number } = {},
): ApiIndex {
  const hotThreshold = options.hotThreshold ?? 5;

  const groups = new Map<string, ApiEndpoint>();
  const unresolved: ApiCallSite[] = [];

  for (const page of pages) {
    for (const site of page.callSites) {
      if (site.confidence === 'low') {
        unresolved.push(site);
        continue;
      }
      const id = `${site.method} ${site.path}`;
      const existing = groups.get(id);
      if (existing) {
        existing.callSites.push(site);
        if (!existing.pages.includes(site.pageName)) {
          existing.pages.push(site.pageName);
        }
        if (CONFIDENCE_ORDER[site.confidence] > CONFIDENCE_ORDER[existing.topConfidence]) {
          existing.topConfidence = site.confidence;
        }
      } else {
        groups.set(id, {
          id,
          method: site.method,
          path: site.path,
          callSites: [site],
          referenceCount: 0,
          pages: [site.pageName],
          pageRiskSummary: {},
          topConfidence: site.confidence,
        });
      }
    }
  }

  // Compute reference count + page risk summary from page metadata
  const pageRisk = new Map<string, RiskLevel>(
    pages.map((p) => [p.pageName, p.riskLevel]),
  );
  for (const ep of groups.values()) {
    ep.referenceCount = ep.callSites.length;
    for (const p of ep.pages) {
      const risk = pageRisk.get(p);
      if (!risk) continue;
      ep.pageRiskSummary[risk] = (ep.pageRiskSummary[risk] ?? 0) + 1;
    }
  }

  const endpoints = [...groups.values()].sort(
    (a, b) => b.referenceCount - a.referenceCount || a.id.localeCompare(b.id),
  );

  return {
    endpoints,
    unresolved,
    stats: {
      totalEndpoints: endpoints.length,
      deadEndpoints: endpoints.filter((e) => e.referenceCount === 0).length,
      hotEndpoints: endpoints.filter((e) => e.referenceCount >= hotThreshold).length,
      uncategorized: unresolved.length,
    },
  };
}
