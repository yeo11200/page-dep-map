import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createApiRoutes } from './api-routes.js';
import { createInspectBroker } from './inspect-broker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function locateInspectHelper(): string | null {
  const candidates = [
    // When CLI is consumed as the installed npm package, the helper script
    // sits next to the bundled dashboard assets.
    path.resolve(__dirname, '..', 'inspect-helper.js'),
    // Workspace dev — read directly from the inspect-helper package output.
    path.resolve(__dirname, '..', '..', '..', 'inspect-helper', 'dist', 'index.global.js'),
    path.resolve(__dirname, '..', '..', 'inspect-helper', 'dist', 'index.global.js'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Create the Express application.
 *
 * - Serves the dashboard SPA as static files
 * - Mounts API routes under /api
 * - SPA fallback: all unmatched GET requests serve index.html
 */
export function createServer(analysisDir: string): express.Express {
  const app = express();

  // Dashboard static files — bundled into cli/dashboard/ at build time
  // In development (ts-node/tsx), resolve from src → packages/cli/dashboard
  // In production (dist/), resolve from dist → packages/cli/dashboard
  const dashboardDir = path.resolve(__dirname, '..', 'dashboard');

  // API routes
  app.use('/api', createApiRoutes(analysisDir));

  // Inspect broker — SSE fan-out so dashboard and host app (different
  // origins) can exchange highlight/pick messages through this server.
  app.use('/api', createInspectBroker());

  // Inspect helper script — served with permissive CORS so host apps on
  // other ports can fetch it.
  app.get('/pdm-inject.js', (_req, res) => {
    const helperPath = locateInspectHelper();
    if (!helperPath) {
      res.status(404).type('application/javascript').send(
        '// page-dep-map inspect helper unavailable: build packages/inspect-helper first.',
      );
      return;
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    res.type('application/javascript').sendFile(helperPath);
  });

  // Static file serving for dashboard
  app.use(express.static(dashboardDir));

  // SPA fallback — serve index.html for all unmatched routes
  app.get('*', (_req, res) => {
    const indexPath = path.join(dashboardDir, 'index.html');
    res.sendFile(indexPath);
  });

  return app;
}
