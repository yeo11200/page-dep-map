import { analyzeCommand } from './analyze.js';
import { reportCommand } from './report.js';
import { serveCommand } from './serve.js';

export interface DefaultOptions {
  output: string;
  config?: string;
  port: number;
  open: boolean;
  report?: boolean;
  reportOutput: string;
}

/**
 * Default command: analyze the project, then start the dashboard server.
 */
export async function defaultCommand(
  dir: string,
  opts: DefaultOptions,
): Promise<void> {
  const outputDir = await analyzeCommand(dir, {
    output: opts.output,
    config: opts.config,
  });

  if (opts.report) {
    await reportCommand(dir, {
      config: opts.config,
      output: opts.reportOutput,
    });
  }

  await serveCommand(outputDir, {
    port: opts.port,
    open: opts.open,
  });
}
