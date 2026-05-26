import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { Command } from 'commander';
import { analyzeCommand } from './commands/analyze.js';
import { serveCommand } from './commands/serve.js';
import { defaultCommand } from './commands/default.js';
import { reportCommand } from './commands/report.js';

// Read the CLI's own version from package.json at runtime so `--version`
// never drifts from what was published. The dist sits at
// `packages/cli/dist/index.js`, so package.json is one level up.
const cliDir = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(path.join(cliDir, '..', 'package.json'), 'utf8'),
);

const program = new Command();

program
  .name('page-dep-map')
  .description('Frontend page dependency analyzer — analyze complexity and serve a dashboard')
  .version(pkg.version);

// --- Sub-commands ---

program
  .command('analyze')
  .description('Analyze the project and output JSON results')
  .argument('<dir>', 'Target project directory')
  .option('-o, --output <dir>', 'Output directory', './page-dep-map-output')
  .option('-c, --config <path>', 'Config file path')
  .action(async (dir: string, opts: { output: string; config?: string }) => {
    await analyzeCommand(dir, opts);
  });

program
  .command('serve')
  .description('Start the dashboard server for an existing analysis')
  .argument('<dir>', 'Analysis output directory')
  .option('-p, --port <number>', 'Server port', '3399')
  .option('--no-open', 'Do not open the browser automatically')
  .action(async (dir: string, opts: { port: string; open: boolean }) => {
    await serveCommand(dir, { port: Number(opts.port), open: opts.open });
  });

program
  .command('report')
  .description('Generate dependency map reports')
  .argument('<dir>', 'Target project directory')
  .option('-o, --output <dir>', 'Output directory', './page-dep-map-reports')
  .option('-c, --config <path>', 'Config file path')
  .action(async (dir: string, opts: { output: string; config?: string }) => {
    await reportCommand(dir, opts);
  });

// --- Analyze + serve ---

program
  .command('run')
  .description('Analyze the project and start the dashboard server')
  .argument('[dir]', 'Target project directory', '.')
  .option('-o, --output <dir>', 'Output directory', './page-dep-map-output')
  .option('-c, --config <path>', 'Config file path')
  .option('-p, --port <number>', 'Server port', '3399')
  .option('--report', 'Also generate dependency reports')
  .option('--report-output <dir>', 'Report output directory', './page-dep-map-reports')
  .option('--no-open', 'Do not open the browser automatically')
  .action(
    async (
      dir: string,
      opts: {
        output: string;
        config?: string;
        port: string;
        report?: boolean;
        reportOutput: string;
        open: boolean;
      },
    ) => {
      await defaultCommand(dir, {
        output: opts.output,
        config: opts.config,
        port: Number(opts.port),
        report: opts.report,
        reportOutput: opts.reportOutput,
        open: opts.open,
      });
    },
  );

program.parse();
