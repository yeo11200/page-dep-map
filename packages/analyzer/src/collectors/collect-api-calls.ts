import { type SourceFile, type CallExpression, Node, SyntaxKind } from 'ts-morph';
import type { ApiCallSite, ApiCallShape, ApiCallConfidence } from '@page-dep-map/shared';

/**
 * Raw call site captured per file. The aggregator later groups these by
 * endpoint id and attaches the owning page name.
 *
 * Phase 1 scope:
 *   - Direct  fetch(url, [init])         → shape 'fetch'
 *   - Direct  axios.<method>(url, ...)   → shape 'axios'
 *   - Direct  ky.<method>(url, ...)      → shape 'ky'
 *   - Direct  ofetch(url, ...)           → shape 'ofetch'
 *   - useSWR(url, fetcher)               → shape 'swr'
 *   - useQuery({ queryFn }) — recursed   → shape 'react-query'
 *
 * Out of scope here (Phase 3): wrapped client resolution and baseURL
 * composition. Such calls are emitted with confidence 'low' and a
 * raw URL guess if any.
 */
export interface RawApiCall {
  method: string;
  /** Path before normalisation — exactly as appeared in source. */
  rawPath: string;
  /** Normalised path with :params and stripped query string. */
  path: string;
  callShape: ApiCallShape;
  confidence: ApiCallConfidence;
  /** File where the call expression sits. */
  filePath: string;
  /** 1-based line number. */
  line: number;
  /** Component / function that contains this call. Best-effort. */
  componentName: string;
}

const AXIOS_METHODS = new Set([
  'get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'request',
]);
const KY_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head']);

/**
 * Walk every CallExpression in the source file and collect API call sites.
 */
export function collectApiCalls(sourceFile: SourceFile, projectRelativePath: string): RawApiCall[] {
  const out: RawApiCall[] = [];
  const claimed = new Set<CallExpression>();
  const callExprs = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const call of callExprs) {
    if (claimed.has(call)) continue;
    const found = recognize(call, projectRelativePath, claimed);
    if (found) out.push(found);
  }
  return out;
}

function recognize(
  call: CallExpression,
  filePath: string,
  claimed?: Set<CallExpression>,
): RawApiCall | null {
  const expr = call.getExpression();
  const args = call.getArguments();
  const line = call.getStartLineNumber();
  const componentName = nearestEnclosingName(call);

  // fetch(url, ...)
  if (Node.isIdentifier(expr) && expr.getText() === 'fetch' && args[0]) {
    const literal = readStringLikeLiteral(args[0]);
    if (literal == null) return null;
    const method = inferFetchMethod(args[1]);
    return finalize('fetch', method, literal, filePath, line, componentName);
  }

  // ofetch(url) / $fetch(url)
  if (Node.isIdentifier(expr) && (expr.getText() === 'ofetch' || expr.getText() === '$fetch') && args[0]) {
    const literal = readStringLikeLiteral(args[0]);
    if (literal == null) return null;
    return finalize('ofetch', 'GET', literal, filePath, line, componentName);
  }

  // useSWR(url, fetcher)
  if (Node.isIdentifier(expr) && expr.getText() === 'useSWR' && args[0]) {
    const literal = readStringLikeLiteral(args[0]);
    if (literal == null) return null;
    return finalize('swr', 'GET', literal, filePath, line, componentName);
  }

  // useQuery({ queryFn: () => axios.get(...) | fetch(...) })
  if (Node.isIdentifier(expr) && (expr.getText() === 'useQuery' || expr.getText() === 'useMutation')) {
    const inner = peekInsideQueryFn(call, claimed);
    if (inner) return inner;
  }

  // axios.<method>(url, ...) | ky.<method>(url, ...)
  if (Node.isPropertyAccessExpression(expr)) {
    const callee = expr.getExpression().getText();
    const methodName = expr.getName();
    if ((callee === 'axios' || callee === 'api' || callee === 'http') && AXIOS_METHODS.has(methodName)) {
      const literal = args[0] ? readStringLikeLiteral(args[0]) : null;
      if (literal == null) return null;
      return finalize('axios', methodName.toUpperCase(), literal, filePath, line, componentName);
    }
    if (callee === 'ky' && KY_METHODS.has(methodName)) {
      const literal = args[0] ? readStringLikeLiteral(args[0]) : null;
      if (literal == null) return null;
      return finalize('ky', methodName.toUpperCase(), literal, filePath, line, componentName);
    }
  }

  return null;
}

/**
 * For useQuery/useMutation calls, look at the object literal's `queryFn`
 * or `mutationFn` body and re-run recognition on the inner call.
 */
function peekInsideQueryFn(
  call: CallExpression,
  claimed?: Set<CallExpression>,
): RawApiCall | null {
  const arg = call.getArguments()[0];
  if (!arg || !Node.isObjectLiteralExpression(arg)) return null;
  const fnProp = arg.getProperty('queryFn') ?? arg.getProperty('mutationFn');
  if (!fnProp || !Node.isPropertyAssignment(fnProp)) return null;
  const init = fnProp.getInitializer();
  if (!init || !(Node.isArrowFunction(init) || Node.isFunctionExpression(init))) return null;

  const inner = init.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const c of inner) {
    const r = recognize(c, '');
    if (r) {
      // Claim the inner call so the outer iteration doesn't register it
      // a second time as a plain axios/fetch hit.
      claimed?.add(c);
      // Re-stamp as react-query shape so UX can group it
      return { ...r, callShape: 'react-query' };
    }
  }
  return null;
}

function finalize(
  shape: ApiCallShape,
  method: string,
  rawPath: string,
  filePath: string,
  line: number,
  componentName: string,
): RawApiCall {
  const path = normalisePath(rawPath);
  // High confidence when the path is a single static string. The presence
  // of `<?>` markers (computed parts we couldn't resolve) downgrades to
  // medium. If no path could be derived at all we drop to low — but at
  // that point we'd already have returned null upstream.
  const confidence: ApiCallConfidence = path.includes('<?>') ? 'medium' : 'high';
  return {
    method: method.toUpperCase(),
    rawPath,
    path,
    callShape: shape,
    confidence,
    filePath,
    line,
    componentName,
  };
}

/**
 * Read a string-shaped argument node into a path string. Returns null if
 * the value is purely dynamic.
 *
 * Supported forms:
 *   - `"/users"` / `'/users'`         → "/users"
 *   - `` `/users/${id}` ``            → "/users/:id"
 *   - `'/users/' + id`                → "/users/:id"
 *   - identifier referring to a const string → resolved if symbol initialiser is a literal
 */
function readStringLikeLiteral(node: Node): string | null {
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return node.getLiteralText();
  }
  if (Node.isTemplateExpression(node)) {
    const head = node.getHead().getLiteralText();
    const spans = node.getTemplateSpans();
    let out = head;
    for (const span of spans) {
      out += paramise(span.getExpression().getText());
      out += span.getLiteral().getLiteralText();
    }
    return out;
  }
  if (Node.isBinaryExpression(node) && node.getOperatorToken().getKind() === SyntaxKind.PlusToken) {
    const left = readStringLikeLiteral(node.getLeft());
    const right = readStringLikeLiteral(node.getRight());
    if (left == null && right == null) return null;
    return (left ?? '<?>') + (right ?? paramise(node.getRight().getText()));
  }
  if (Node.isIdentifier(node)) {
    // best-effort: const X = '...' in same file
    const def = node.getSymbol()?.getDeclarations()?.[0];
    if (def && Node.isVariableDeclaration(def)) {
      const init = def.getInitializer();
      if (init) return readStringLikeLiteral(init);
    }
    return null;
  }
  return null;
}

function paramise(_expression: string): string {
  // Phase 1: every interpolation becomes `:param`. Future phases can
  // inspect the expression name (id, userId, slug...) to keep the hint.
  return ':param';
}

function normalisePath(raw: string): string {
  let out = raw.trim();
  // strip query string
  const q = out.indexOf('?');
  if (q !== -1) out = out.slice(0, q);
  // drop trailing slash unless root
  if (out.length > 1 && out.endsWith('/')) out = out.slice(0, -1);
  return out;
}

function inferFetchMethod(initArg: Node | undefined): string {
  if (!initArg || !Node.isObjectLiteralExpression(initArg)) return 'GET';
  const methodProp = initArg.getProperty('method');
  if (methodProp && Node.isPropertyAssignment(methodProp)) {
    const init = methodProp.getInitializer();
    if (init && Node.isStringLiteral(init)) return init.getLiteralText().toUpperCase();
  }
  return 'GET';
}

/** Climb up to the nearest function-like ancestor and use its name. */
function nearestEnclosingName(node: Node): string {
  let cur: Node | undefined = node.getParent();
  while (cur) {
    if (Node.isFunctionDeclaration(cur) || Node.isFunctionExpression(cur)) {
      return cur.getName() ?? '<anonymous>';
    }
    if (Node.isArrowFunction(cur)) {
      const varDecl = cur.getParentIfKind(SyntaxKind.VariableDeclaration);
      if (varDecl) return varDecl.getName();
    }
    if (Node.isMethodDeclaration(cur)) {
      return cur.getName();
    }
    cur = cur.getParent();
  }
  return '<module>';
}
