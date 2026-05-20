import * as path from 'node:path';

/**
 * 파일 경로를 Next.js 라우트 패스로 변환한다.
 * SPEC 섹션 1.1의 Route Path 추정 규칙을 구현한다.
 *
 * @example
 * filePathToRoutePath('app/users/[id]/page.tsx', 'app')    // → '/users/:id'
 * filePathToRoutePath('app/(dashboard)/settings/page.tsx', 'app') // → '/settings'
 * filePathToRoutePath('pages/users/index.tsx', 'pages')    // → '/users'
 */
export function filePathToRoutePath(filePath: string, baseDir: string): string {
  // normalize separators
  const normalized = filePath.replace(/\\/g, '/');
  const normalizedBase = baseDir.replace(/\\/g, '/').replace(/\/$/, '');

  // strip base directory prefix
  let route = normalized;
  const baseIndex = route.indexOf(normalizedBase);
  if (baseIndex !== -1) {
    route = route.slice(baseIndex + normalizedBase.length);
  }

  // strip file extension
  const ext = path.extname(route);
  if (ext) {
    route = route.slice(0, -ext.length);
  }

  // strip trailing /page (App Router) or /index (Pages Router)
  route = route.replace(/\/page$/, '');
  route = route.replace(/\/index$/, '');

  // remove route groups: (groupName)
  route = route.replace(/\/\([^)]+\)/g, '');

  // convert optional catch-all: [[...param]] → :param?*
  // must be processed before catch-all to avoid partial match
  route = route.replace(/\[\[\.\.\.(\w+)]]/g, ':$1?*');

  // convert catch-all: [...param] → :param*
  route = route.replace(/\[\.\.\.(\w+)]/g, ':$1*');

  // convert dynamic segment: [param] → :param
  route = route.replace(/\[(\w+)]/g, ':$1');

  // ensure leading slash
  if (!route.startsWith('/')) {
    route = '/' + route;
  }

  // root case
  if (route === '') {
    return '/';
  }

  return route;
}
