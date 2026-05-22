# PLAN — API usage index (reverse: endpoint → components)

> **Status**: draft / pre-implementation
> **Branch**: `feature/api-usage-index`
> **Owner**: jinseop.shin
> **Prepared**: 2026-05-22 (before home-session implementation)

## Why this exists

Today `page-dep-map` answers questions in the *page-out* direction:

> "How many queries does this page call?" — number, no detail.

What teams actually need in BE↔FE handoffs is the *API-in* direction:

> "If I change `GET /api/users/:id`, which pages will break?"
> "Is `POST /api/legacy/refresh-token` still used anywhere?"
> "Which endpoints are hot — used in 5+ pages?"

This feature builds a **reverse index** keyed by endpoint, listing every
component / page that calls it, with metadata (file, line, call shape,
HTTP method, the page's existing risk level).

## Concrete questions the feature should answer

1. **Impact** — "Show all components using `GET /users/:id`."
2. **Dead-code** — "Show endpoints with zero references."
3. **Hotspots** — "Show endpoints used in 5+ pages."
4. **Risk overlap** — "Endpoints called from Critical-risk pages."
5. **Coupling** — "Pages calling 10+ distinct endpoints."

## Detection strategy

The analyzer needs to recognize **HTTP call sites** in TS/TSX. Patterns
to support (priority ordered):

1. **Direct `fetch` / `axios`**
   ```ts
   fetch('/api/users/' + id)
   axios.get(`/api/users/${id}`)
   axios.post('/api/orders', body)
   ```
2. **react-query / @tanstack/react-query / swr hooks**
   ```ts
   useQuery({ queryKey: ['user', id], queryFn: () => getUser(id) })
   useSWR(`/api/users/${id}`, fetcher)
   ```
3. **User-defined client wrappers** (the hard case)
   ```ts
   // userApi.ts
   export const userApi = {
     getById: (id) => api.get(`/users/${id}`),
   }
   // page.tsx
   userApi.getById(id)   // must resolve to GET /users/:id
   ```
4. **OpenAPI / Swagger generated clients** (if `openapi.json` exists,
   use it as ground truth)

### URL normalization

- Template literals → wildcard the interpolation: `` `/users/${id}` `` →
  `/users/:id`
- Concatenation → same: `'/users/' + id` → `/users/:id`
- Query strings → strip (record separately): `/users?active=1` →
  `/users` with `query: { active: '1' }`
- Trailing slash → drop
- Leading `/api` prefix → keep as-is (do NOT auto-strip; project decides)

### Method inference

- `fetch(url)` without options → GET
- `fetch(url, { method: 'POST' })` → POST
- `axios.get(url)` → GET; `axios.post(...)` → POST
- react-query mutations default to whatever the `queryFn` body does
- For wrapped clients, follow the wrapper's body once (1 hop) to find
  the underlying `axios.<method>` call

## Output schema

Add a new file alongside existing `project-summary.json` and
`pages/*.json`:

```
page-dep-map-output/
  api-index.json            ← NEW
  api-index/
    GET__users__:id.json    ← NEW per-endpoint detail (optional, only
                              if reference count > N)
```

`api-index.json`:

```jsonc
{
  "endpoints": [
    {
      "id": "GET /api/users/:id",
      "method": "GET",
      "path": "/api/users/:id",
      "callSites": [
        {
          "filePath": "src/pages/UserProfile.tsx",
          "componentName": "UserProfile",
          "line": 42,
          "callShape": "fetch",        // "fetch" | "axios" | "react-query" | "wrapped" | "openapi"
          "pageRiskLevel": "warning"
        }
      ],
      "referenceCount": 3,
      "pages": ["UserProfile", "AdminUserEdit", "UserListItem"]
    }
  ],
  "stats": {
    "totalEndpoints": 47,
    "deadEndpoints": 3,
    "hotEndpoints": 5,           // referenceCount >= 5
    "uncategorized": 12          // call sites we couldn't resolve to an endpoint
  }
}
```

`pages/<page>.json` gets a new field `apiCalls: string[]` (endpoint IDs)
so navigation page→API works without rescanning.

## Dashboard view

New top-level tab: **"APIs"** beside Pages.

- List view: endpoint, method badge, reference count, hot/dead badges
- Detail view (click an endpoint): list of call sites with file, line,
  component, risk badge — clicking a row jumps to the page detail
- Filter: HTTP method, base path, reference count range, hot/dead

Wire `useInspectBridge` here too: if helper is alive, hovering a call
site in the endpoint detail could highlight the calling component on
the running app. (Nice-to-have for v2.)

## Implementation phases

### Phase 1 — Detector core (2-3h)

- New visitor in `packages/analyzer/src/visitors/api-call.ts`
- Detect patterns 1 & 2 (fetch, axios, react-query)
- URL normalization util
- Output flat list of call sites per file
- **Deliverable**: `pnpm analyze` produces raw `api-calls.json` with
  no aggregation yet

### Phase 2 — Aggregation + schema (1h)

- Group call sites by endpoint ID
- Compute stats (dead, hot, uncategorized)
- Write `api-index.json`
- Add `apiCalls` to per-page output
- **Deliverable**: schema-complete output

### Phase 3 — Wrapped client resolution (2-3h)

- Pattern 3: follow imported wrapper functions one hop
- Limit recursion to avoid pathological codebases
- Mark unresolved calls as `uncategorized`
- **Deliverable**: real codebase coverage >80%

### Phase 4 — Dashboard APIs tab (3-4h)

- New route `/apis` and `/apis/:endpointId`
- List + detail views
- Filter controls
- Cross-link with existing pages tab
- **Deliverable**: clickable end-to-end demo

### Phase 5 — Inspect bridge integration (1h, optional)

- Hovering call site in detail view sends `focus` to host page
- **Deliverable**: demo video / screenshot

## Fixture

Add `fixtures/api-usage-fixture/` — a Vite React app that intentionally
uses every supported pattern at least once:

```
src/pages/UserProfile.tsx     // fetch + axios
src/pages/Orders.tsx          // react-query useQuery + useMutation
src/pages/Admin.tsx           // wrapped client userApi.getById
src/lib/api.ts                // axios instance with baseURL
src/lib/userApi.ts            // wrapper
```

Add one **dead endpoint** (defined in api.ts but never called) and one
**hot endpoint** (called from 4+ components).

## Open decisions (fill in at home)

| # | Decision | Options | My pick |
|---|----------|---------|---------|
| 1 | Base path handling | strip `/api` prefix / keep as-is / configurable | _____ |
| 2 | OpenAPI integration | optional (auto-detect openapi.json) / required / out-of-scope for v1 | _____ |
| 3 | New CLI command? | `page-dep-map analyze-apis` subcommand / run as part of `analyze` | _____ |
| 4 | Schema location | extend existing `analyze` output / new `analyze-apis` output dir | _____ |
| 5 | Dashboard tab vs separate | new APIs tab in same dashboard / separate `apis-dashboard` route | _____ |
| 6 | Method inference for wrapped clients | follow 1 hop only / unlimited / configurable | _____ |
| 7 | Uncategorized call site UX | hide / show in dashboard as "Unresolved" tab / surface in Likely Issues | _____ |

## Out of scope (v1)

- Backend code analysis (Nest controllers, Express routes) — separate
  effort. We're inferring endpoints from FE call sites only.
- Runtime tracking (which endpoints are *actually* called in browser
  traffic) — that's a different tool.
- GraphQL endpoint analysis — Phase X if there's demand.
- WebSocket / SSE / gRPC.

## Acceptance criteria for v1

- `pnpm analyze` on the new fixture produces `api-index.json` with all
  intentional endpoints detected, 0 false positives.
- Dashboard shows an APIs tab listing those endpoints with correct
  reference counts.
- Clicking an endpoint reveals its call sites with file & line.
- Existing analyzer / dashboard output is unchanged for the rest.
- README updated with a small "API usage index" section.
- Bumps `@shinjinseop/page-dep-map` to 0.2.0 (minor — new public
  surface).

## First task when starting at home

```bash
git clone … && cd page-dep-map
git checkout feature/api-usage-index
pnpm install
# Then ask Claude:
# "Start Phase 1 from docs/PLAN-api-usage-index.md. Create the
#  packages/analyzer/src/visitors/api-call.ts and a small test
#  in fixtures/api-usage-fixture/src/pages/UserProfile.tsx that
#  exercises fetch + axios."
```
