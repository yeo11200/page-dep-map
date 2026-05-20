# page-dep-map

React/Next.js codebase analyzer for page-level complexity, dependency structure, prop flow, and component relationships.

`page-dep-map` statically analyzes React pages, writes JSON results, generates dependency reports, and serves an interactive dashboard for code review and refactoring decisions.

## What It Is For

Use this when you want to answer questions like:

- Which pages are structurally risky?
- Which page is acting as a data orchestrator?
- Where are props being drilled too deeply?
- Which components are hidden under a page-level child component?
- Which pages have many effects, queries, store usages, conditions, or shared dependencies?
- What should be reviewed first before refactoring?

This project currently targets React-family frontend applications. NestJS, ExpressJS, and backend dependency graphs should be implemented as separate presets later.

## Supported React Targets

The analyzer is designed for:

- Vite React
- CRA / plain React
- Next.js Pages Router
- Next.js App Router
- React Router based SPAs
- TanStack Router style `routes` directories
- Monorepo app packages such as `apps/web`, `apps/dashboard`
- TypeScript path aliases through `tsconfig.json`
- Common page directories:
  - `app`
  - `src/app`
  - `pages`
  - `src/pages`
  - `routes`
  - `src/routes`

Current stable page discovery is pattern-based. For best results, provide `pagePatterns` in `page-dep-map.config.json` or `page-dep-map.config.ts`.

## Install

For npm package usage:

```bash
npm install -D page-dep-map
```

or run directly:

```bash
npx page-dep-map run .
```

For this monorepo while developing locally:

```bash
pnpm install
pnpm build
node packages/cli/dist/index.js run fixtures/app-router-project
```

## Quick Start

Analyze a React app and open the dashboard:

```bash
page-dep-map run .
```

Analyze a specific app inside a monorepo:

```bash
page-dep-map run apps/web
```

Generate the dashboard plus dependency reports:

```bash
page-dep-map run apps/web --report
```

Use a config file and custom output directory:

```bash
page-dep-map run apps/web \
  --config page-dep-map.config.json \
  --output page-dep-map-output \
  --report \
  --report-output page-dep-map-reports
```

The dashboard defaults to:

```txt
http://localhost:3399
```

## Commands

### `run`

Analyze a project and start the dashboard server.

```bash
page-dep-map run [dir]
```

Options:

```bash
--output <dir>          Analysis output directory, default: ./page-dep-map-output
--config <path>         Config file path
--port <number>         Dashboard port, default: 3399
--report                Also generate dependency reports
--report-output <dir>   Dependency report output directory, default: ./page-dep-map-reports
--no-open               Do not open the browser automatically
```

Example:

```bash
page-dep-map run apps/dashboard --output page-dep-map-output-dashboard --report --report-output page-dep-map-reports
```

### `analyze`

Generate JSON analysis results only.

```bash
page-dep-map analyze <dir> --output page-dep-map-output
```

### `report`

Generate dependency map reports only.

```bash
page-dep-map report <dir> --output page-dep-map-reports
```

This writes:

```txt
page-dep-map-reports/pages-deps-report.json
page-dep-map-reports/interactive-dependency-map.html
page-dep-map-reports/full-dependency-graph.svg
```

### `serve`

Serve an existing analysis output directory.

```bash
page-dep-map serve page-dep-map-output --port 3399
```

## Monorepo Usage

For a repository with multiple apps, keep separate outputs so results do not overwrite each other.

```json
{
  "scripts": {
    "page-map:web": "page-dep-map run apps/web --config page-dep-map.config.json --output page-dep-map-output --report --report-output page-dep-map-reports",
    "page-map:dashboard": "page-dep-map run apps/dashboard --config page-dep-map.config.json --output page-dep-map-output-dashboard --report --report-output page-dep-map-reports",
    "page-map:dashboard:analyze": "page-dep-map analyze apps/dashboard --config page-dep-map.config.json --output page-dep-map-output-dashboard",
    "page-map:dashboard:serve": "page-dep-map serve page-dep-map-output-dashboard"
  }
}
```

Recommended `.gitignore` entries:

```gitignore
page-dep-map-output/
page-dep-map-output-dashboard/
page-dep-map-reports/
```

## Configuration

Create `page-dep-map.config.json`:

```json
{
  "pagePatterns": [
    "src/pages/**/*.tsx",
    "src/app/**/page.tsx",
    "src/routes/**/*.tsx"
  ],
  "excludePatterns": [
    "**/_app.*",
    "**/_document.*",
    "**/_error.*",
    "**/404.*",
    "**/api/**",
    "**/*.test.*",
    "**/*.spec.*",
    "**/*.stories.*",
    "**/__tests__/**",
    "**/__mocks__/**"
  ],
  "tsConfigPath": "tsconfig.json",
  "output": {
    "dir": "./page-dep-map-output"
  },
  "dashboard": {
    "port": 3399,
    "open": true
  }
}
```

Or use `page-dep-map.config.ts` for regex-based analyzer settings:

```ts
import type { PageDepMapConfig } from 'page-dep-map';

export default {
  pagePatterns: [
    'src/pages/**/*.tsx',
    'src/app/**/page.tsx',
    'src/routes/**/*.tsx',
  ],
  excludePatterns: [
    '**/_app.*',
    '**/_document.*',
    '**/_error.*',
    '**/404.*',
    '**/api/**',
    '**/*.test.*',
    '**/*.spec.*',
    '**/*.stories.*',
  ],
  tsConfigPath: 'tsconfig.json',
  analysis: {
    maxTraceDepth: 5,
    storePatterns: [/^use\w+Store$/, /^useAtom$/, /^useSelector$/, /^useDispatch$/],
    queryPatterns: [/^useQuery$/, /^useSuspenseQuery$/, /^useInfiniteQuery$/, /^use\w+Query$/],
  },
  scoring: {
    weights: {
      effectCount: 3,
      maxDrillingDepth: 3,
      passThroughPropsCount: 3,
      queryCount: 2,
    },
    thresholds: {
      moderate: 20,
      warning: 40,
      critical: 60,
    },
  },
  output: {
    dir: './page-dep-map-output',
  },
  dashboard: {
    port: 3399,
    open: true,
  },
} satisfies PageDepMapConfig;
```

## Output Files

Analysis output:

```txt
page-dep-map-output/
  project-summary.json
  pages/
    <page-name>.json
```

Report output:

```txt
page-dep-map-reports/
  pages-deps-report.json
  interactive-dependency-map.html
  full-dependency-graph.svg
```

`pages-deps-report.json` is also used by the dashboard to make child component chips clickable and to render nested component dependency modals.

## Dashboard

### Overview

- Total page count
- Average score
- Warning and critical page counts
- Risk distribution
- Top risk pages

### Page List

- Searchable page table
- Sortable score, risk, props, hooks, depth, and child count columns
- Risk filter
- Row click navigation into page detail

### Page Detail

The detail page is optimized for triage:

- Hero section with score, risk badge, score bar, and top score contributors
- Likely issues near the top
- Issue metric chips linking directly to the metric cards
- Sticky section navigation on desktop
- Direct props table
- Dependencies section with hooks, queries, stores, contexts, shared modules, and child components
- Clickable child component chips when dependency report data is available
- Component Dependency Map modal for nested child component structure
- Prop flow and deepest prop path sections
- Metrics card grid with anchor IDs such as `#metric-effectCount`

## What It Analyzes

For each page:

| Category | Metrics |
| --- | --- |
| Props | total, required, optional, type strings, spread detection |
| Hooks | general hooks, effects, query hooks, store hooks, context hooks |
| Dependencies | queries, stores, contexts, shared/common modules |
| Prop Flow | drilling depth, pass-through props, deepest prop path |
| Structure | child components, conditional branches, derived data props |
| Score | weighted complexity score and risk level |
| Issues | built-in structural issue rules |
| Component Tree | imported child component dependency graph when reports are generated |

## Score Breakdown

The score is a weighted sum of page metrics.

| Metric | Weight |
| --- | ---: |
| `propsCount` | 1 |
| `requiredPropsCount` | 1 |
| `maxDrillingDepth` | 3 |
| `passThroughPropsCount` | 3 |
| `hookCount` | 1 |
| `queryCount` | 2 |
| `storeUsageCount` | 2 |
| `contextUsageCount` | 2 |
| `effectCount` | 3 |
| `conditionalBranchCount` | 1 |
| `childComponentCount` | 1 |
| `derivedDataPropCount` | 2 |
| `sharedDependencyCount` | 1 |

Risk levels:

| Risk | Score |
| --- | ---: |
| healthy | 0-19 |
| moderate | 20-39 |
| warning | 40-59 |
| critical | 60+ |

## Built-in Issue Rules

| Rule ID | Trigger | Severity |
| --- | --- | --- |
| `DRILL_DEEP` | max drilling depth >= 3 | warning |
| `PASS_THROUGH` | pass-through props >= 2 | warning |
| `EFFECT_HEAVY` | effects >= 4 | warning |
| `DATA_ORCHESTRATOR` | queries >= 3 and child components >= 6 | critical |
| `DERIVED_HEAVY` | derived data props >= 2 | info |
| `SHARED_HEAVY` | shared dependencies >= 10 | info |
| `MANY_PROPS` | props >= 10 | warning |
| `MANY_REQUIRED` | required props >= 8 | warning |
| `SPREAD_DETECTED` | spread props used | info |
| `MANY_CONDITIONS` | conditions >= 8 | warning |
| `EFFECT_NO_QUERY` | effects >= 3 and queries = 0 | info |
| `STORE_AND_PROPS` | stores >= 2 and props >= 5 | info |

## Child Component Dependency Map

Run with `--report` to enable nested component visibility in the dashboard:

```bash
page-dep-map run apps/dashboard --report --report-output page-dep-map-reports
```

Then open a page detail and click a child component chip. The modal shows:

- Root component
- Nested children
- Direct child count
- Component kind: `page`, `component`, or `external`
- File path
- Import source
- Circular reference markers when detected

This is useful for pages that only show a top-level child such as `FundingAccounts`, `Account`, or `ActivityUser`, but the actual implementation is split into many nested components.

## Troubleshooting

### Blank screen after refreshing `/pages/<name>`

Make sure the dashboard was built with absolute asset paths. In this repo the Vite config uses:

```ts
export default defineConfig({
  base: '/',
});
```

If you changed the dashboard build, rebuild the monorepo and restart the CLI server:

```bash
pnpm build
page-dep-map run apps/dashboard --report
```

Then hard-refresh the browser:

```txt
Cmd + Shift + R
```

### Child component chip is not clickable

The dashboard needs dependency report data. Run with `--report`:

```bash
page-dep-map run apps/web --report --report-output page-dep-map-reports
```

Also confirm that the report file exists:

```txt
page-dep-map-reports/pages-deps-report.json
```

### Path aliases do not resolve

Set `tsConfigPath` in the config:

```json
{
  "tsConfigPath": "tsconfig.json"
}
```

For monorepos, run the CLI with the app package as the target directory so the app-level `tsconfig.json` can be resolved:

```bash
page-dep-map run apps/dashboard --config page-dep-map.config.json
```

### Port is already in use

Use another port:

```bash
page-dep-map run apps/dashboard --port 3400
```

## Known Limitations

This tool uses heuristic static analysis. These patterns can reduce accuracy:

- Spread props such as `<Comp {...props} />`
- Higher-order components such as `withAuth(Page)`
- Render props
- Highly dynamic component selection
- Dynamic imports with complex expressions
- Deep re-export chains
- Runtime route declarations that do not map to page files
- Component definitions hidden behind non-standard factory functions

The current backend presets for NestJS and ExpressJS are not implemented. They should use separate analyzer rules for controllers, routes, middleware, providers, services, and repositories.

## Development

```bash
pnpm install
pnpm test
pnpm build
```

Run against a fixture:

```bash
node packages/cli/dist/index.js run fixtures/app-router-project --report
```

Run against an external app during local development:

```bash
page-dep-map run apps/dashboard \
  --config page-dep-map.config.json \
  --output page-dep-map-output-dashboard \
  --report \
  --report-output page-dep-map-reports
```

## Tech Stack

- Analyzer: TypeScript + ts-morph + fast-glob
- Dashboard: React + Vite + TanStack Query/Table + Recharts + Tailwind CSS
- CLI server: Commander.js + Express
- Build: pnpm workspace + tsup

## License

MIT
