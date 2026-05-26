# Session log — 2026-05-26

> Working session on `feature/api-usage-index`. Captures everything
> completed today plus the exact starting point for the next session.

## What got done this session

| Area | Result |
|------|--------|
| PLAN doc | Added "Goal (universal)" + confidence-tier table + baseURL composition section to `docs/PLAN-api-usage-index.md` |
| Analyzer survey | Mapped `packages/analyzer/src/` collector + output pattern; identified `collectors/` as the insertion point |
| Fixture | Built `fixtures/api-usage-fixture/` covering every Phase-1 pattern (fetch, axios literal, ky, ofetch, useSWR, useQuery/useMutation) plus `userApi.getById` / `userApi.list` / `legacyApi.refreshToken` as ground truth for Phase 3 |
| Shared types | Added `ApiCallSite`, `ApiEndpoint`, `ApiIndex`, `ApiIndexStats`, `ApiCallConfidence`, `ApiCallShape` exported from `@page-dep-map/shared` |
| `collect-api-calls.ts` | Recognises literal-URL calls; normalises template literals & `'/x/' + id` to `:param`; dedups inner calls inside react-query `queryFn`/`mutationFn` |
| `build-api-index.ts` | Groups call sites into endpoints, picks `topConfidence`, computes stats (`totalEndpoints`, `hot`, `dead`, `uncategorized`) |
| `write-json.ts` | Emits `api-index.json` next to `project-summary.json` |
| CLI server | New endpoint `GET /api/api-index` |
| Dashboard `/apis` | List view with method badge, reference count, confidence dot |
| Dashboard `/apis/:id` | Detail view, call sites grouped by calling page, each page header back-linking to the page detail |
| Sidebar | New "APIs" nav item |
| Mock | `packages/dashboard/public/mock/api-index.json` for offline dev |
| Dashboard React 19 | Bumped to align with the monorepo-wide `pnpm.overrides` introduced by `apps/landing` |
| CLAUDE.md | "Current in-progress work" updated to "Phase 1 done; Phase 3 next" |
| Branch | `feature/api-usage-index` pushed → commits `2c189b0` (PLAN) and `7f2fc3f` (implementation) |

## Verified ground-truth result

Running `node packages/cli/dist/index.js analyze fixtures/api-usage-fixture`
produces exactly the four endpoints we expect from Phase-1 patterns, each
with `referenceCount: 1` and `topConfidence: "high"`:

```
GET  /api/v1/feed
GET  /api/v1/orders
POST /api/v1/orders
GET  /api/v1/users/:param/activity
```

Endpoints we intentionally don't yet catch (kept as Phase-3 targets):

```
GET   /api/v1/users/:id    ← userApi.getById through axios baseURL
GET   /api/v1/users        ← userApi.list
PATCH /api/v1/users/:id    ← userApi.update
POST  /api/v1/auth/legacy/refresh   ← legacyApi.refreshToken (dead endpoint expected)
```

## Phase 3 — next session starting point

**Goal**: detect call sites that go through a user-defined wrapper
client, by following one hop into the imported export and resolving the
underlying `axios`/`ky`/`ofetch` instance's baseURL.

### First message template

```
Start Phase 3 in feature/api-usage-index.
fixtures/api-usage-fixture/src/lib/api.ts defines:
  - api = axios.create({ baseURL: '/api/v1' })
  - kyApi = ky.create({ prefixUrl: '/api/v1' })
  - userApi.getById/update/list — wrappers over api.get/patch/get
  - legacyApi.refreshToken — wrapper, intentionally dead
Detect these calls in UserProfile.tsx / Admin.tsx / UserCard.tsx so the
final api-index.json contains GET /api/v1/users/:id (referenceCount 3
across UserProfile, Admin, UserCard), GET /api/v1/users (Admin), and
POST /api/v1/auth/legacy/refresh (dead, referenceCount 0 with the
declaration site flagged).
Mark resolved wrapped sites as confidence 'medium'.
Update collect-api-calls.ts + a new module-local resolver.
```

### Implementation outline

1. **baseURL extractor** — walk the project's `.ts`/`.tsx` files looking
   for `axios.create(...)`, `ky.create(...)`, `ofetch.create(...)`.
   Record `{ exportedSymbol -> baseURL }` map.
2. **Wrapper extractor** — walk for `export const X = { method: (args) =>
   <client>.<httpMethod>(<urlExpr>, ...) }` patterns. Record
   `{ "X.method" -> { httpMethod, baseURLOwner, urlExpr } }`.
3. **Hook the existing recognizer** — when we see `X.method(...)` where
   `X` resolves to a recorded wrapper entry, emit an endpoint with
   confidence `medium` after composing `baseURL + urlExpr`.
4. **Dead endpoints** — wrapper entries that never get called become
   endpoints with `referenceCount: 0`. Surface them in `api-index.json`
   so the dashboard can show a "Dead" section.

### Where to put the code

- New file: `packages/analyzer/src/collectors/api-client-registry.ts` —
  builds the per-project baseURL + wrapper maps in a single pass.
- Extend `collect-api-calls.ts` to take the registry as a parameter and
  call it when an unrecognised `<ident>.<method>(...)` shows up.
- `index.ts` builds the registry once before iterating pages.

### Acceptance for Phase 3

- `fixtures/api-usage-fixture` analysis output adds the four wrapper
  endpoints listed above, with the dead one marked `referenceCount: 0`.
- No regressions on the existing Phase-1 endpoint counts.
- Confidence of wrapper hits is `medium`.

## Open decisions still standing

Carried forward from `docs/PLAN-api-usage-index.md` — fill in during Phase 3:

1. Base path handling — strip `/api` prefix / keep / configurable
2. OpenAPI integration — auto / required / out-of-scope v1
3. CLI subcommand (`analyze-apis`) vs included in `analyze` (currently
   included — keep unless we see a reason to split)
4. Schema location (currently `api-index.json` at output root — fine)
5. Dashboard tab vs separate route (currently a tab inside the same
   dashboard — fine)
6. Wrapper hop depth (currently 1, this PLAN entry stays open if Phase
   3 surfaces real-world cases that need 2)
7. Unresolved call site UX — currently a small footer counter on
   `/apis`; full "Unresolved" section can wait for Phase 4

## Pointers

- Branch: `feature/api-usage-index` (pushed to origin)
- Last commit: `7f2fc3f Implement API usage reverse index — Phase 1+2 + dashboard`
- PLAN: `docs/PLAN-api-usage-index.md`
- Fixture: `fixtures/api-usage-fixture/`
- Output sample: run `node packages/cli/dist/index.js analyze fixtures/api-usage-fixture` → check `page-dep-map-output/api-index.json`
