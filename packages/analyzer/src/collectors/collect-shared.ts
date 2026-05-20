import { type SourceFile, SyntaxKind } from 'ts-morph';
import { DEFAULT_SHARED_PATTERNS } from '@page-dep-map/shared';

/**
 * import 경로에서 shared/common 패턴에 매칭되는 의존성을 수집한다.
 * SPEC 1.7 — Shared Dependencies 수집 규칙.
 *
 * 카운팅 규칙:
 * - import 문 기준 카운팅 (모듈 단위)
 * - `import { A, B } from '...'` → 1개
 * - 같은 모듈에서 여러 번 import해도 1개
 * - node_modules import는 제외
 */
export function collectShared(
  sourceFile: SourceFile,
  sharedPatterns?: RegExp[],
): string[] {
  const patterns = sharedPatterns ?? DEFAULT_SHARED_PATTERNS;
  const sharedModules = new Set<string>();

  const importDecls = sourceFile.getDescendantsOfKind(
    SyntaxKind.ImportDeclaration,
  );

  for (const importDecl of importDecls) {
    const moduleSpecifier = importDecl.getModuleSpecifierValue();

    // Skip node_modules (no relative path or alias prefix)
    if (isNodeModuleImport(moduleSpecifier)) continue;

    // Check if the import path matches any shared pattern
    if (patterns.some((pattern) => pattern.test(moduleSpecifier))) {
      sharedModules.add(moduleSpecifier);
    }
  }

  return [...sharedModules];
}

/**
 * node_modules import인지 판별한다.
 * - 상대 경로 (./xxx, ../xxx) → 아님
 * - alias (@/xxx, ~/xxx) → 아님
 * - 그 외 (react, lodash, @tanstack/query) → node_modules
 */
function isNodeModuleImport(specifier: string): boolean {
  // Relative paths
  if (specifier.startsWith('.')) return false;

  // Common path aliases
  if (specifier.startsWith('@/') || specifier.startsWith('~/')) return false;

  // Scoped packages like @tanstack/query are node_modules
  // unless they match shared patterns (checked separately)
  return true;
}
