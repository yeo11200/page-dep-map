import type {
  ApiCallSite,
  ApiConsumerEntry,
  ApiEndpoint,
  ApiIndex,
  ApiCallConfidence,
  RiskLevel,
} from '@page-dep-map/shared';

/** Shape of an unattributed call collected by Phase 3's orphan pass.
 *  Mirrors the analyzer's RawApiCall surface without depending on it. */
export interface OrphanApiCall {
  method: string;
  path: string;
  callShape: ApiCallSite['callShape'];
  confidence: ApiCallConfidence;
  filePath: string;
  line: number;
  componentName: string;
}

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
  options: {
    hotThreshold?: number;
    /** Map of endpoint id ("METHOD /path") → map of upstream function/
     *  component names with min-hops distance, computed by Phase 3 via
     *  the reverse call graph. */
    endpointConsumers?: Map<string, Map<string, number>>;
    /** Per-endpoint, per-consumer-key: does the consumer's body actually
     *  invoke a hook/api in the chain. Lets the dashboard separate
     *  active hook callers from passive render-tree parents. */
    consumerInvokesHook?: Map<string, Map<string, boolean>>;
    /** Per-endpoint, per-consumer-key: does the consumer call the
     *  endpoint's direct (hop-1) hook in its own body? */
    consumerInvokesDirectHook?: Map<string, Map<string, boolean>>;
    /** Lookup: function/component name → project-relative file path. */
    nameToFilePath?: Map<string, string>;
    /** Names that are recognized as page-component default exports.
     *  Used to label `kind: 'page'` on consumer entries. */
    pageComponentNames?: Set<string>;
    /** API calls found in indexed source files but not attributed to any
     *  page via the call graph. Emitted as orphan-tier endpoints so the
     *  index covers the same surface as the older file-level scan, while
     *  the tier label makes the attribution status explicit. */
    orphanCalls?: OrphanApiCall[];
  } = {},
): ApiIndex {
  const hotThreshold = options.hotThreshold ?? 5;
  const consumerMap = options.endpointConsumers ?? new Map<string, Map<string, number>>();
  const invokesHookMap = options.consumerInvokesHook ?? new Map<string, Map<string, boolean>>();
  const invokesDirectHookMap = options.consumerInvokesDirectHook ?? new Map<string, Map<string, boolean>>();
  const nameToFilePath = options.nameToFilePath ?? new Map<string, string>();
  const pageComponentNames = options.pageComponentNames ?? new Set<string>();
  const orphanCalls = options.orphanCalls ?? [];

  const groups = new Map<string, ApiEndpoint>();
  const unresolved: ApiCallSite[] = [];
  // Track unique physical call sites per endpoint (file:line). The same
  // call site can be reported by multiple pages when Phase 3 attribution
  // attaches it to every page that transitively imports the file.
  const seenSitesByEndpoint = new Map<string, Set<string>>();

  for (const page of pages) {
    for (const site of page.callSites) {
      if (site.confidence === 'low') {
        unresolved.push(site);
        continue;
      }
      const id = `${site.method} ${site.path}`;
      const siteCoord = `${site.filePath}:${site.line}`;
      const existing = groups.get(id);
      if (existing) {
        const seen = seenSitesByEndpoint.get(id)!;
        if (!seen.has(siteCoord)) {
          existing.callSites.push(site);
          seen.add(siteCoord);
        }
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
          consumers: [],
          consumerCount: 0,
          directCallers: [],
          pageRiskSummary: {},
          impact: 'low',
          impactBreakdown: {
            pages: 0,
            hooks: 0,
            components: 0,
            api: 0,
            riskyPages: 0,
          },
          topConfidence: site.confidence,
          tier: 'reached',
        });
        seenSitesByEndpoint.set(id, new Set([siteCoord]));
      }
    }
  }

  // Orphan pass — add endpoints discovered in source but not reached by
  // any page. Each orphan call becomes (or augments) an endpoint whose
  // `pages` list stays empty; the dashboard distinguishes by `tier`.
  for (const o of orphanCalls) {
    if (o.confidence === 'low') {
      unresolved.push({
        pageName: '<orphan>',
        pageFilePath: o.filePath,
        componentName: o.componentName,
        filePath: o.filePath,
        line: o.line,
        method: o.method,
        path: o.path,
        callShape: o.callShape,
        confidence: o.confidence,
      });
      continue;
    }
    const id = `${o.method} ${o.path}`;
    const siteCoord = `${o.filePath}:${o.line}`;
    const site: ApiCallSite = {
      pageName: '<orphan>',
      pageFilePath: o.filePath,
      componentName: o.componentName,
      filePath: o.filePath,
      line: o.line,
      method: o.method,
      path: o.path,
      callShape: o.callShape,
      confidence: o.confidence,
    };
    const existing = groups.get(id);
    if (existing) {
      const seen = seenSitesByEndpoint.get(id)!;
      if (!seen.has(siteCoord)) {
        existing.callSites.push(site);
        seen.add(siteCoord);
      }
      // Don't add '<orphan>' to a reached endpoint's pages list — leave
      // that as the real consumer set.
    } else {
      groups.set(id, {
        id,
        method: o.method,
        path: o.path,
        callSites: [site],
        referenceCount: 0,
        pages: [],
        consumers: [],
        consumerCount: 0,
        pageRiskSummary: {},
        topConfidence: o.confidence,
        tier: 'orphan',
      });
      seenSitesByEndpoint.set(id, new Set([siteCoord]));
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
    // Attach consumer chain — every function/component that transitively
    // reaches this endpoint via the call graph. Keys are composite
    // (`${absPath}:::${name}`) so we decode them back into name +
    // file path for the dashboard.
    const hopMap = consumerMap.get(ep.id);
    const invokesHookForEp = invokesHookMap.get(ep.id);
    const invokesDirectHookForEp = invokesDirectHookMap.get(ep.id);
    if (hopMap && hopMap.size > 0) {
      const entries: ApiConsumerEntry[] = [];
      // Dedup synonymous default-export aliases (the same function may
      // be reached via its real name AND via `<default>` AND via the
      // filename-derived synthetic alias). Keep the most-informative
      // alias and drop the magic `<default>` marker from output.
      const seen = new Map<string, ApiConsumerEntry>();
      for (const [key, hops] of hopMap) {
        const sep = key.lastIndexOf(':::');
        const absPath = sep >= 0 ? key.slice(0, sep) : '';
        const name = sep >= 0 ? key.slice(sep + 3) : key;
        const filePath = nameToFilePath.get(key) ?? '';
        const display = name === '<default>' ? deriveDefaultName(filePath) : name;
        const dedupKey = `${absPath}|${display}`;
        const existing = seen.get(dedupKey);
        if (existing && existing.hops <= hops) continue;
        const kind = classifyConsumer(display, hops, key, pageComponentNames);
        const entry: ApiConsumerEntry = {
          name: display,
          filePath,
          kind,
          hops,
          // Pages are entry points: they include children but don't
          // call hooks directly in the sense that matters here.
          invokesHook:
            kind === 'page' ? false : invokesHookForEp?.get(key) ?? false,
          invokesDirectHook:
            kind === 'page' ? false : invokesDirectHookForEp?.get(key) ?? false,
        };
        seen.set(dedupKey, entry);
      }
      for (const entry of seen.values()) entries.push(entry);
      // Sort: closest to the API call first, then alphabetically.
      entries.sort(
        (a, b) => a.hops - b.hops || a.name.localeCompare(b.name),
      );
      ep.consumers = entries;
      ep.consumerCount = entries.length;
      ep.directCallers = entries.filter((e) => e.hops === 1);
    }
    // Compute impact breakdown + tier — must run after consumers and
    // pageRiskSummary are populated so the heuristic sees final counts.
    const breakdown: ApiEndpoint['impactBreakdown'] = {
      pages: ep.pages.length,
      hooks: 0,
      components: 0,
      api: 0,
      riskyPages:
        (ep.pageRiskSummary.warning ?? 0) +
        (ep.pageRiskSummary.critical ?? 0),
    };
    for (const c of ep.consumers) {
      if (c.kind === 'hook') breakdown.hooks++;
      else if (c.kind === 'component') breakdown.components++;
      else if (c.kind === 'api') breakdown.api++;
    }
    ep.impactBreakdown = breakdown;
    ep.impact = scoreImpact(ep.tier, breakdown);
  }

  // Sort: reached tier first (by referenceCount desc), orphans after.
  // Within a tier, ties broken by id for deterministic output.
  const tierOrder: Record<ApiEndpoint['tier'], number> = {
    reached: 0,
    orphan: 1,
    unsupported: 2,
  };
  const endpoints = [...groups.values()].sort((a, b) => {
    const t = tierOrder[a.tier] - tierOrder[b.tier];
    if (t !== 0) return t;
    return b.referenceCount - a.referenceCount || a.id.localeCompare(b.id);
  });

  const reachedEndpoints = endpoints.filter((e) => e.tier === 'reached').length;
  const orphanEndpoints = endpoints.filter((e) => e.tier === 'orphan').length;

  return {
    endpoints,
    unresolved,
    stats: {
      totalEndpoints: endpoints.length,
      // Dead = nothing in source points at it (orphan and pages both empty).
      deadEndpoints: endpoints.filter(
        (e) => e.referenceCount === 0 && e.pages.length === 0,
      ).length,
      // Hot now means "called from many pages" — the BE-relevant signal.
      // referenceCount counts unique physical call sites which is usually 1
      // for shared api modules, so the old threshold was effectively a
      // no-op for wrapped-client codebases.
      hotEndpoints: endpoints.filter((e) => e.pages.length >= hotThreshold).length,
      uncategorized: unresolved.length,
      reachedEndpoints,
      orphanEndpoints,
    },
  };
}

/**
 * Classify a consumer by name + position in the chain. This is a
 * heuristic — exact symbol kinds would require deeper TS resolution.
 * The conventions caught here cover the dominant Next.js / React app
 * patterns (custom hooks named useXxx, PascalCase components, page
 * default exports tracked separately).
 */
function classifyConsumer(
  displayName: string,
  hops: number,
  fullKey: string,
  pageComponentNames: Set<string>,
): ApiConsumerEntry['kind'] {
  if (hops === 0) return 'api';
  // pageComponentNames stores composite keys to avoid collisions across
  // identically-named page entry points (e.g., multiple `[id].tsx`).
  if (pageComponentNames.has(fullKey)) return 'page';
  if (/^use[A-Z]/.test(displayName)) return 'hook';
  if (/^[A-Z]/.test(displayName)) return 'component';
  return 'unknown';
}

/**
 * Map (tier, breakdown) → single severity label. The thresholds here
 * are deliberately conservative — we'd rather flag a critical endpoint
 * that turns out to be safe than the reverse. Tune by re-running on a
 * known codebase and eyeballing the spread before tightening.
 */
function scoreImpact(
  tier: ApiEndpoint['tier'],
  b: ApiEndpoint['impactBreakdown'],
): ApiEndpoint['impact'] {
  // Orphans have no page consumers, so they can't break runtime UI.
  // Flag them low so BE engineers don't waste cycles on dead endpoints.
  if (tier === 'orphan') return 'low';
  if (b.riskyPages > 0 || b.pages >= 10) return 'critical';
  if (b.pages >= 5 || b.components >= 20) return 'high';
  if (b.pages >= 2 || b.components >= 5) return 'medium';
  return 'low';
}

/**
 * `<default>` keys aren't user-friendly. Derive a name from the file
 * path — `components/Admin/Detail/index.tsx` → `AdminDetail` (parent
 * directory of the index.tsx), `components/Header.tsx` → `Header`.
 */
function deriveDefaultName(filePath: string): string {
  if (!filePath) return '<default>';
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  const last = parts[parts.length - 1]?.replace(/\.[^.]+$/, '');
  if (!last) return '<default>';
  if (last === 'index' && parts.length >= 2) {
    return parts[parts.length - 2] ?? '<default>';
  }
  return last;
}
