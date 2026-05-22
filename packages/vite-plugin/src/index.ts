import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

export interface PdmInspectOptions {
  /**
   * URL of the page-dep-map dashboard. The helper script will be loaded from
   * `${baseUrl}/pdm-inject.js` when this is provided. Falls back to the
   * inline bundled helper script otherwise.
   */
  baseUrl?: string;
  /**
   * Enable the plugin in production builds too. Defaults to false (dev only).
   */
  enableInProd?: boolean;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readBundledHelper(): string | null {
  // Resolved at runtime: this file (dist/index.js or dist/index.cjs) lives in
  // packages/vite-plugin/dist. The helper is bundled at
  // packages/inspect-helper/dist/index.global.js (tsup iife output).
  const candidatePaths = [
    path.resolve(__dirname, '..', '..', 'inspect-helper', 'dist', 'index.global.js'),
    path.resolve(__dirname, '..', '..', '..', 'inspect-helper', 'dist', 'index.global.js'),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      try {
        return fs.readFileSync(candidate, 'utf-8');
      } catch {
        // continue
      }
    }
  }
  return null;
}

/**
 * Vite plugin that injects the page-dep-map inspect helper into the host
 * app's HTML during dev. Once injected, the dashboard at
 * @shinjinseop/page-dep-map can talk to the page via BroadcastChannel to
 * highlight components on screen.
 *
 * Usage:
 *   import pdmInspect from '@shinjinseop/page-dep-map-vite-plugin';
 *   export default defineConfig({ plugins: [react(), pdmInspect()] });
 */
export default function pdmInspect(options: PdmInspectOptions = {}): Plugin {
  const { baseUrl, enableInProd = false } = options;
  let isProd = false;

  return {
    name: 'page-dep-map-inspect',
    apply: enableInProd ? undefined : 'serve',
    configResolved(config) {
      isProd = config.command === 'build';
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (isProd && !enableInProd) return html;

        if (baseUrl) {
          const src = `${baseUrl.replace(/\/$/, '')}/pdm-inject.js`;
          return {
            html,
            tags: [
              {
                tag: 'script',
                attrs: {
                  src,
                  defer: true,
                  'data-pdm': 'inspect-helper',
                },
                injectTo: 'head',
              },
            ],
          };
        }

        const inline = readBundledHelper();
        if (!inline) {
          // eslint-disable-next-line no-console
          console.warn(
            '[page-dep-map-inspect] could not locate bundled helper script. ' +
              'Provide options.baseUrl pointing to the dashboard server.',
          );
          return html;
        }

        return {
          html,
          tags: [
            {
              tag: 'script',
              attrs: { 'data-pdm': 'inspect-helper' },
              children: inline,
              injectTo: 'head',
            },
          ],
        };
      },
    },
  };
}
