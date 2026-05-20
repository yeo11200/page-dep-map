import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ProjectSummary, PageDetail } from '@page-dep-map/shared';

/**
 * 분석 결과를 JSON 파일로 출력한다.
 *
 * 출력 구조:
 * - {outputDir}/project-summary.json
 * - {outputDir}/pages/{pageName}.json
 */
export function writeJson(
  outputDir: string,
  summary: ProjectSummary,
  pages: PageDetail[],
): void {
  const resolvedDir = path.resolve(outputDir);
  const pagesDir = path.join(resolvedDir, 'pages');

  // Ensure directories exist
  fs.mkdirSync(resolvedDir, { recursive: true });
  fs.mkdirSync(pagesDir, { recursive: true });

  // Write project summary
  fs.writeFileSync(
    path.join(resolvedDir, 'project-summary.json'),
    JSON.stringify(summary, null, 2),
    'utf-8',
  );

  // Write individual page details
  for (const page of pages) {
    const safeFileName = sanitizeFileName(page.pageName) + '.json';
    fs.writeFileSync(
      path.join(pagesDir, safeFileName),
      JSON.stringify(page, null, 2),
      'utf-8',
    );
  }
}

/**
 * 파일명으로 안전한 문자열로 변환한다.
 * path separator, 특수문자를 '_'로 대체.
 */
function sanitizeFileName(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}
