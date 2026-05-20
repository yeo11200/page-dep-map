import fg from 'fast-glob';
import * as path from 'node:path';
import type { SourceFile } from 'ts-morph';
import { Project } from 'ts-morph';
import {
  DEFAULT_PAGE_PATTERNS,
  DEFAULT_EXCLUDE_PATTERNS,
  filePathToRoutePath,
} from '@page-dep-map/shared';

/**
 * 탐색된 페이지 파일 정보.
 * filePath는 targetDir 기준 상대 경로, routePath는 추정된 라우트.
 */
export interface PageEntry {
  filePath: string;
  absolutePath: string;
  routePath: string;
  sourceFile: SourceFile;
}

/**
 * glob 패턴으로 페이지 파일을 탐색하고 ts-morph SourceFile을 생성한다.
 * SPEC 1.1 — 페이지 탐색 규칙.
 */
export function collectPages(
  project: Project,
  targetDir: string,
  pagePatterns?: string[],
  excludePatterns?: string[],
): PageEntry[] {
  const patterns = pagePatterns ?? DEFAULT_PAGE_PATTERNS;
  const ignores = excludePatterns ?? DEFAULT_EXCLUDE_PATTERNS;

  const filePaths = fg.sync(patterns, {
    cwd: targetDir,
    ignore: ignores,
    onlyFiles: true,
    absolute: false,
  });

  const pages: PageEntry[] = [];

  for (const relPath of filePaths) {
    const absPath = path.resolve(targetDir, relPath);

    // Determine base dir for route path inference
    const baseDir = detectBaseDir(relPath);
    const routePath = filePathToRoutePath(relPath, baseDir);

    // Add file to ts-morph project
    let sourceFile: SourceFile;
    try {
      sourceFile =
        project.getSourceFile(absPath) ?? project.addSourceFileAtPath(absPath);
    } catch {
      // Skip files that can't be parsed
      continue;
    }

    pages.push({
      filePath: relPath,
      absolutePath: absPath,
      routePath,
      sourceFile,
    });
  }

  return pages;
}

/**
 * 파일 경로에서 base directory (app 또는 pages)를 추정한다.
 */
function detectBaseDir(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.startsWith('app/') || normalized.includes('/app/')) {
    return 'app';
  }
  if (normalized.startsWith('pages/') || normalized.includes('/pages/')) {
    return 'pages';
  }
  // Fallback: use first directory segment
  const firstSegment = normalized.split('/')[0];
  return firstSegment ?? '';
}
