import * as fs from 'node:fs';
import * as path from 'node:path';
import { generateDependencyReports } from '@page-dep-map/analyzer';
import type { PageDepMapConfig } from '@page-dep-map/shared';
import { createSpinner } from '../utils/spinner.js';

export interface ReportOptions {
  config?: string;
  output: string;
}

export async function reportCommand(
  dir: string,
  opts: ReportOptions,
): Promise<string> {
  const targetDir = path.resolve(dir);
  const outputDir = path.resolve(opts.output);
  const spinner = createSpinner('Generating dependency reports...');
  spinner.start();

  try {
    const fileConfig = opts.config ? await loadExplicitConfig(opts.config) : {};
    const report = await generateDependencyReports(targetDir, {
      ...fileConfig,
      output: { dir: outputDir },
    });

    spinner.succeed(
      `Reports generated: ${report.pages.length} page(s), ${report.nodes.length} node(s). Output: ${outputDir}`,
    );

    return outputDir;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error during report generation';
    spinner.fail(`Report generation failed: ${message}`);
    process.exit(1);
  }
}

async function loadExplicitConfig(configPath: string): Promise<Partial<PageDepMapConfig>> {
  const resolvedPath = path.resolve(configPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Config file not found: ${resolvedPath}`);
  }

  if (resolvedPath.endsWith('.json')) {
    const content = fs.readFileSync(resolvedPath, 'utf-8');
    return JSON.parse(content) as Partial<PageDepMapConfig>;
  }

  const module = await import(resolvedPath);
  return (module.default ?? module) as Partial<PageDepMapConfig>;
}
