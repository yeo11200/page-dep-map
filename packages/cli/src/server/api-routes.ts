import * as fs from 'node:fs';
import * as path from 'node:path';
import { Router } from 'express';

/**
 * Create API routes that read analysis results from the output directory.
 *
 * Routes:
 * - GET /api/summary        → project-summary.json
 * - GET /api/pages           → all pages/*.json merged into an array
 * - GET /api/pages/:name     → pages/{name}.json
 */
export function createApiRoutes(analysisDir: string): Router {
  const router = Router();

  // GET /api/summary
  router.get('/summary', (_req, res) => {
    const filePath = path.join(analysisDir, 'project-summary.json');

    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      res.type('json').send(data);
    } catch {
      res.status(404).json({ error: 'Project summary not found' });
    }
  });

  // GET /api/api-index → api-index.json (API usage reverse index)
  router.get('/api-index', (_req, res) => {
    const filePath = path.join(analysisDir, 'api-index.json');
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      res.type('json').send(data);
    } catch {
      res.status(404).json({
        error: 'API index not found',
        hint: 'Re-run `page-dep-map analyze` after upgrading to a version that emits api-index.json',
      });
    }
  });

  router.get('/dependency-report', (_req, res) => {
    const filePath = path.resolve(
      analysisDir,
      '..',
      'ai',
      'out',
      'pages-deps-report.json',
    );

    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      res.type('json').send(data);
    } catch {
      res.status(404).json({ error: 'Dependency report not found' });
    }
  });

  // GET /api/pages
  router.get('/pages', (_req, res) => {
    const pagesDir = path.join(analysisDir, 'pages');

    try {
      if (!fs.existsSync(pagesDir)) {
        res.json([]);
        return;
      }

      const files = fs
        .readdirSync(pagesDir)
        .filter((f) => f.endsWith('.json'));

      const pages = files.map((file) => {
        const content = fs.readFileSync(path.join(pagesDir, file), 'utf-8');
        const detail = JSON.parse(content) as Record<string, unknown>;
        // Flatten PageDetail into PageSummary shape for the list view.
        // The dashboard's usePages() expects top-level metric fields.
        const metrics = (detail.metrics ?? {}) as Record<string, unknown>;
        return {
          pageName: detail.pageName,
          filePath: detail.filePath,
          routePath: detail.routePath,
          complexityScore: metrics.complexityScore ?? 0,
          riskLevel: metrics.riskLevel ?? 'healthy',
          propsCount: metrics.propsCount ?? 0,
          requiredPropsCount: metrics.requiredPropsCount ?? 0,
          optionalPropsCount: metrics.optionalPropsCount ?? 0,
          queryCount: metrics.queryCount ?? 0,
          storeUsageCount: metrics.storeUsageCount ?? 0,
          contextUsageCount: metrics.contextUsageCount ?? 0,
          hookCount: metrics.hookCount ?? 0,
          effectCount: metrics.effectCount ?? 0,
          conditionalBranchCount: metrics.conditionalBranchCount ?? 0,
          childComponentCount: metrics.childComponentCount ?? 0,
          maxDrillingDepth: metrics.maxDrillingDepth ?? 0,
          passThroughPropsCount: metrics.passThroughPropsCount ?? 0,
          derivedDataPropCount: metrics.derivedDataPropCount ?? 0,
          sharedDependencyCount: metrics.sharedDependencyCount ?? 0,
          deepestPropNames: detail.deepestProps
            ? (detail.deepestProps as Array<{ name: string }>).map((p) => p.name)
            : [],
          unusedCandidateProps: detail.propFlows
            ? (detail.propFlows as Array<{ propName: string; isUnusedCandidate: boolean }>)
                .filter((f) => f.isUnusedCandidate)
                .map((f) => f.propName)
            : [],
          mainDependencyModules: detail.sharedModules ?? [],
          likelyIssues: detail.likelyIssues
            ? (detail.likelyIssues as Array<{ message: string }>).map((i) => i.message)
            : [],
        };
      });

      res.json(pages);
    } catch {
      res.status(500).json({ error: 'Failed to read pages' });
    }
  });

  // GET /api/pages/:slug — slug is already sanitized (no slashes)
  router.get('/pages/:slug', (req, res) => {
    const sanitized = req.params.slug;
    const filePath = path.join(analysisDir, 'pages', `${sanitized}.json`);

    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      res.type('json').send(data);
    } catch {
      res.status(404).json({ error: `Page "${sanitized}" not found` });
    }
  });

  return router;
}

/**
 * Mirrors the sanitization logic from the analyzer's writeJson.
 * Ensures the filename lookup matches what was written.
 */
function sanitizeFileName(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}
