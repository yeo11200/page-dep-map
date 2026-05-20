import { type SourceFile, SyntaxKind, Node } from 'ts-morph';

/**
 * React 내장 컴포넌트 — 자식 목록에서 제외.
 * SPEC 1.4: Fragment, Suspense, ErrorBoundary 등.
 */
const EXCLUDED_COMPONENTS = new Set([
  'Fragment',
  'Suspense',
  'ErrorBoundary',
  'StrictMode',
  'Profiler',
]);

/**
 * JSX 내 대문자 태그를 자식 컴포넌트로 수집한다.
 * SPEC 1.4 — 자식 컴포넌트 수집 규칙.
 *
 * - 대문자 시작 태그만 인식 (소문자 = HTML element)
 * - Sidebar.Menu 같은 namespace 컴포넌트도 인식
 * - Fragment, Suspense 등 React 내장은 제외
 * - 중복 제거: 유니크 컴포넌트 이름 목록 반환
 */
export function collectChildren(sourceFile: SourceFile): string[] {
  const children = new Set<string>();

  // Collect from JsxOpeningElement and JsxSelfClosingElement
  const jsxOpenings = sourceFile.getDescendantsOfKind(
    SyntaxKind.JsxOpeningElement,
  );
  const jsxSelfClosings = sourceFile.getDescendantsOfKind(
    SyntaxKind.JsxSelfClosingElement,
  );

  for (const element of [...jsxOpenings, ...jsxSelfClosings]) {
    const tagName = element.getTagNameNode();
    const name = tagName.getText();

    if (isComponentTag(name)) {
      children.add(name);
    }
  }

  return [...children];
}

/**
 * 태그 이름이 컴포넌트인지 판별한다.
 * - 대문자 시작이면 컴포넌트
 * - Namespace 컴포넌트 (Sidebar.Menu)도 포함
 * - React 내장(Fragment, Suspense 등)은 제외
 */
function isComponentTag(name: string): boolean {
  // Check first char (or first char after namespace)
  const firstChar = name.charAt(0);

  // Must start with uppercase
  if (firstChar !== firstChar.toUpperCase() || firstChar === firstChar.toLowerCase()) {
    return false;
  }

  // Extract base name (before dot for namespace)
  const baseName = name.includes('.') ? name.split('.')[0]! : name;

  // Exclude React built-ins (check both full name and base name)
  if (EXCLUDED_COMPONENTS.has(name) || EXCLUDED_COMPONENTS.has(baseName)) {
    return false;
  }

  return true;
}
