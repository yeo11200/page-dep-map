import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createApiRoutes } from './api-routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

  // Static file serving for dashboard
  app.use(express.static(dashboardDir));

  // SPA fallback — serve index.html for all unmatched routes
  app.get('*', (_req, res) => {
    const indexPath = path.join(dashboardDir, 'index.html');
    res.sendFile(indexPath);
  });

  return app;
}
