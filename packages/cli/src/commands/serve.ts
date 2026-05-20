import * as path from 'node:path';
import { createServer } from '../server/create-server.js';
import { openBrowser } from '../utils/open-browser.js';
import { createSpinner } from '../utils/spinner.js';

export interface ServeOptions {
  port: number;
  open: boolean;
}

/**
 * Start the dashboard server.
 * Tries the given port, then increments up to 10 times on EADDRINUSE.
 */
export async function serveCommand(
  analysisDir: string,
  opts: ServeOptions,
): Promise<void> {
  const resolvedDir = path.resolve(analysisDir);
  const spinner = createSpinner('Starting dashboard server...');
  spinner.start();

  const app = createServer(resolvedDir);
  const maxRetries = 10;
  let port = opts.port;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await startListening(app, port);
      const url = `http://localhost:${port}`;
      spinner.succeed(`Dashboard running at ${url}`);

      if (opts.open) {
        await openBrowser(url);
      }

      return;
    } catch (error: unknown) {
      if (isAddressInUse(error) && attempt < maxRetries - 1) {
        port++;
        continue;
      }
      const message =
        error instanceof Error ? error.message : 'Failed to start server';
      spinner.fail(`Server error: ${message}`);
      process.exit(1);
    }
  }
}

function startListening(
  app: ReturnType<typeof createServer>,
  port: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = app
      .listen(port, () => {
        resolve();
      })
      .on('error', (err: NodeJS.ErrnoException) => {
        server.close();
        reject(err);
      });
  });
}

function isAddressInUse(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'EADDRINUSE'
  );
}
