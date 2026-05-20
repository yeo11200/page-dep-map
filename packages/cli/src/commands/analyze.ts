import * as path from 'node:path';
import * as fs from 'node:fs';
import { analyzeProject } from '@page-dep-map/analyzer';
import type { PageDepMapConfig } from '@page-dep-map/shared';
import { createSpinner } from '../utils/spinner.js';

export interface AnalyzeOptions {
  output: string;
  config?: string;
}

export async function analyzeCommand(
  dir: string,
  opts: AnalyzeOptions,
): Promise<string> {
  const targetDir = path.resolve(dir);
  const outputDir = path.resolve(opts.output);

  const spinner = createSpinner('Analyzing project...');
  spinner.start();

  try {
    const fileConfig = opts.config ? await loadExplicitConfig(opts.config) : {};
    const config: Partial<PageDepMapConfig> = {
      ...fileConfig,
      output: { dir: outputDir },
    };

    const result = await analyzeProject(targetDir, config);
    const pageCount = result.pages.length;

    spinner.succeed(
      `Analysis complete: ${pageCount} page(s) found. Output: ${outputDir}`,
    );

    return outputDir;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error during analysis';
    spinner.fail(`Analysis failed: ${message}`);
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
