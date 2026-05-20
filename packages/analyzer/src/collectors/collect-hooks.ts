import { type SourceFile, SyntaxKind, Node } from 'ts-morph';
import {
  DEFAULT_STORE_PATTERNS,
  DEFAULT_QUERY_PATTERNS,
} from '@page-dep-map/shared';

/** Hook 카테고리 — SPEC 1.3 */
export type HookCategory = 'query' | 'store' | 'context' | 'effect' | 'hook';

/** 개별 hook 호출 정보 */
export interface HookCall {
  name: string;
  category: HookCategory;
}

/** Hooks 수집 결과 — 카테고리별 분류 + 전체 목록 */
export interface HooksResult {
  all: HookCall[];
  queries: string[];
  stores: string[];
  contexts: string[];
  effects: string[];
  hooks: string[];
  /** 총 hook 호출 수 (같은 hook이 여러 번 호출되면 각각 카운팅) */
  totalCount: number;
  queryCount: number;
  storeCount: number;
  contextCount: number;
  effectCount: number;
}

/** Context hooks (React 내장) */
const CONTEXT_HOOKS = new Set(['useContext']);

/** Effect hooks (React 내장) */
const EFFECT_HOOKS = new Set(['useEffect', 'useLayoutEffect']);

/**
 * 컴포넌트 함수 스코프 내의 use* 호출을 수집하고 5개 카테고리로 분류한다.
 * SPEC 1.3 — Hooks 수집 규칙.
 *
 * 카운팅 규칙:
 * - 같은 hook이 여러 번 호출되면 각각 카운팅
 * - 커스텀 hook 내부의 hook은 카운팅하지 않음 (현재 컴포넌트 스코프만)
 * - 조건부 hook 호출도 카운팅
 */
export function collectHooks(
  sourceFile: SourceFile,
  storePatterns?: RegExp[],
  queryPatterns?: RegExp[],
): HooksResult {
  const storePats = storePatterns ?? DEFAULT_STORE_PATTERNS;
  const queryPats = queryPatterns ?? DEFAULT_QUERY_PATTERNS;

  const hookCalls: HookCall[] = [];

  // Find the main component function body
  const componentBody = findComponentBody(sourceFile);
  if (!componentBody) {
    return emptyResult();
  }

  // Collect all CallExpressions within the component body
  const callExprs = componentBody.getDescendantsOfKind(
    SyntaxKind.CallExpression,
  );

  for (const call of callExprs) {
    const expr = call.getExpression();
    let hookName: string | null = null;

    if (Node.isIdentifier(expr)) {
      hookName = expr.getText();
    } else if (Node.isPropertyAccessExpression(expr)) {
      // React.useContext, etc.
      hookName = expr.getName();
    }

    if (!hookName || !hookName.startsWith('use')) continue;

    // Skip hooks inside nested function declarations (custom hooks)
    if (isInsideNestedFunction(call, componentBody)) continue;

    const category = classifyHook(hookName, storePats, queryPats);
    hookCalls.push({ name: hookName, category });
  }

  return buildResult(hookCalls);
}

/**
 * Hook 이름을 카테고리로 분류한다.
 * 우선순위: context > effect > query > store > hook (기본)
 */
function classifyHook(
  name: string,
  storePatterns: RegExp[],
  queryPatterns: RegExp[],
): HookCategory {
  if (CONTEXT_HOOKS.has(name)) return 'context';
  if (EFFECT_HOOKS.has(name)) return 'effect';
  if (queryPatterns.some((p) => p.test(name))) return 'query';
  if (storePatterns.some((p) => p.test(name))) return 'store';
  return 'hook';
}

/**
 * 소스 파일에서 주 컴포넌트의 함수 body를 찾는다.
 */
function findComponentBody(sourceFile: SourceFile): Node | null {
  // Default export
  const defaultExport = sourceFile.getDefaultExportSymbol();
  if (defaultExport) {
    for (const decl of defaultExport.getDeclarations()) {
      const body = extractBodyFromDecl(decl);
      if (body) return body;

      // ExportAssignment: export default PageComponent
      if (Node.isExportAssignment(decl)) {
        const expr = decl.getExpression();
        if (Node.isIdentifier(expr)) {
          const sym = expr.getSymbol();
          if (sym) {
            for (const sd of sym.getDeclarations()) {
              const b = extractBodyFromDecl(sd);
              if (b) return b;
            }
          }
        }
      }
    }
  }

  // Fallback: first uppercase function
  for (const fn of sourceFile.getFunctions()) {
    const name = fn.getName();
    if (name && /^[A-Z]/.test(name)) {
      return fn.getBody() ?? null;
    }
  }

  // Fallback: first uppercase variable (arrow)
  for (const stmt of sourceFile.getVariableStatements()) {
    for (const decl of stmt.getDeclarations()) {
      if (/^[A-Z]/.test(decl.getName())) {
        const body = extractBodyFromDecl(decl);
        if (body) return body;
      }
    }
  }

  return null;
}

function extractBodyFromDecl(decl: Node): Node | null {
  if (Node.isFunctionDeclaration(decl)) {
    return decl.getBody() ?? null;
  }
  if (Node.isVariableDeclaration(decl)) {
    const init = decl.getInitializer();
    if (!init) return null;
    if (Node.isArrowFunction(init) || Node.isFunctionExpression(init)) {
      return init.getBody() ?? null;
    }
    // forwardRef, React.memo, etc.
    if (Node.isCallExpression(init)) {
      const args = init.getArguments();
      for (const arg of args) {
        if (Node.isArrowFunction(arg) || Node.isFunctionExpression(arg)) {
          return arg.getBody() ?? null;
        }
      }
    }
  }
  return null;
}

/**
 * CallExpression이 중첩 함수(커스텀 hook 등) 내부에 있는지 확인한다.
 */
function isInsideNestedFunction(call: Node, componentBody: Node): boolean {
  let current = call.getParent();
  while (current && current !== componentBody) {
    if (
      Node.isFunctionDeclaration(current) ||
      Node.isFunctionExpression(current) ||
      Node.isArrowFunction(current)
    ) {
      // Check if this nested function is the direct child — if so, it's a callback, not a nested function
      // We want to exclude hooks inside nested function *declarations*, not callbacks passed to other hooks
      const parent = current.getParent();
      if (parent && Node.isCallExpression(parent)) {
        // This is a callback argument — continue checking
        current = current.getParent();
        continue;
      }
      return true;
    }
    current = current.getParent();
  }
  return false;
}

function buildResult(hookCalls: HookCall[]): HooksResult {
  const queries: string[] = [];
  const stores: string[] = [];
  const contexts: string[] = [];
  const effects: string[] = [];
  const hooks: string[] = [];

  for (const hc of hookCalls) {
    switch (hc.category) {
      case 'query':
        queries.push(hc.name);
        break;
      case 'store':
        stores.push(hc.name);
        break;
      case 'context':
        contexts.push(hc.name);
        break;
      case 'effect':
        effects.push(hc.name);
        break;
      case 'hook':
        hooks.push(hc.name);
        break;
    }
  }

  return {
    all: hookCalls,
    queries,
    stores,
    contexts,
    effects,
    hooks,
    totalCount: hookCalls.length,
    queryCount: queries.length,
    storeCount: stores.length,
    contextCount: contexts.length,
    effectCount: effects.length,
  };
}

function emptyResult(): HooksResult {
  return {
    all: [],
    queries: [],
    stores: [],
    contexts: [],
    effects: [],
    hooks: [],
    totalCount: 0,
    queryCount: 0,
    storeCount: 0,
    contextCount: 0,
    effectCount: 0,
  };
}
