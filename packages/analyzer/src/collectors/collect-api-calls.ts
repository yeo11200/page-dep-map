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
 * Names of additional variables that have been determined to hold
 * an axios-like instance (e.g. `clientApi = axios.create()`).
 *
 * Populated by Phase 3's pre-scan; consulted by `recognize` so a
 * `clientApi.get('/foo')` resolves the same way as `axios.get('/foo')`.
 *
 * Module-level state is intentional — threading the set through every
 * collector signature pollutes the API surface, and analysis runs are
 * sequential. Callers MUST call `resetExtraAxiosInstances()` between
 * unrelated `analyzeProject()` invocations.
 */
let EXTRA_AXIOS_INSTANCES: Set<string> = new Set();

export function setExtraAxiosInstances(names: Iterable<string>): void {
  EXTRA_AXIOS_INSTANCES = new Set(names);
}

export function resetExtraAxiosInstances(): void {
  EXTRA_AXIOS_INSTANCES = new Set();
}

/**
 * Walk every CallExpression in the source file and collect API call sites.
 */
export function collectApiCalls(sourceFile: SourceFile, projectRelativePath: string): RawApiCall[] {
  return collectApiCallsInNode(sourceFile, projectRelativePath);
}

/**
 * Function-scoped variant — Phase 3 attribution scans the body of an
 * individual exported function, not the whole file, so that each api
 * module's call sites can be tied to the specific export that contains
 * them (e.g. `postLogin` vs `postLogout` inside the same auth/index.ts).
 *
 * Also returns the set of identifier names this body invokes — the call
 * graph the attribution pass walks to discover transitive API usage from
 * a page's directly-imported symbols.
 */
export function collectApiCallsInNode(
  node: Node,
  projectRelativePath: string,
): RawApiCall[] {
  const out: RawApiCall[] = [];
  const claimed = new Set<CallExpression>();
  const callExprs = node.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const call of callExprs) {
    if (claimed.has(call)) continue;
    const found = recognize(call, projectRelativePath, claimed);
    if (found) out.push(found);
  }
  return out;
}

/**
 * Collect identifier names referenced from this body — anything that
 * could plausibly resolve to another named function in the project's
 * call graph. Includes:
 *   - direct calls:   `foo()`
 *   - JSX usage:      `<Admin />`
 *   - value passing:  `useMutation({ mutationFn: postLogin })`
 *
 * The third case is critical for react-query / @tanstack mutations:
 * `postLogin` is never *called* inside the hook's body — it's passed
 * as a value — so a call-expression-only collector would lose every
 * POST/PUT/DELETE chain that uses `mutationFn: someFn` shorthand.
 *
 * Identifiers that name declarations (variable/param/import binding,
 * property names, type references) are excluded so we don't pollute
 * the graph with binding noise. The expander still filters by whether
 * the name owns an export, so over-collection here is safe — at worst
 * it adds a few wasted queue ticks.
 */
export function collectInvokedNames(node: Node): Set<string> {
  const names = new Set<string>();

  // Pass 1: identifier references used as values, JSX tags, call targets.
  for (const id of node.getDescendantsOfKind(SyntaxKind.Identifier)) {
    const text = id.getText();
    if (!text) continue;
    const parent = id.getParent();
    if (!parent) {
      names.add(text);
      continue;
    }
    // Declaration positions — skip.
    if (Node.isVariableDeclaration(parent) && parent.getNameNode() === id) continue;
    if (Node.isParameterDeclaration(parent) && parent.getNameNode() === id) continue;
    if (Node.isFunctionDeclaration(parent) && parent.getNameNode() === id) continue;
    if (Node.isImportSpecifier(parent)) continue;
    if (Node.isImportClause(parent)) continue;
    if (Node.isNamespaceImport(parent)) continue;
    if (Node.isBindingElement(parent) && parent.getNameNode() === id) continue;
    // Property *names* (left of `:`), not their values.
    if (Node.isPropertyAssignment(parent) && parent.getNameNode() === id) continue;
    // The dotted right-hand of `obj.method` is a property name, not a free
    // identifier referencing an export.
    if (Node.isPropertyAccessExpression(parent) && parent.getNameNode() === id) continue;
    // Type-only positions.
    if (Node.isTypeReference(parent)) continue;
    names.add(text);
  }

  // Pass 2: JSX element tags (the tag node is a JSX-specific identifier,
  // not always caught by getDescendantsOfKind(Identifier) under
  // every ts-morph version — belt and suspenders).
  for (const jsx of node.getDescendantsOfKind(SyntaxKind.JsxOpeningElement)) {
    const tag = jsx.getTagNameNode();
    if (Node.isIdentifier(tag)) names.add(tag.getText());
  }
  for (const jsx of node.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement)) {
    const tag = jsx.getTagNameNode();
    if (Node.isIdentifier(tag)) names.add(tag.getText());
  }

  // Pass 3: composite property-access call sites like `userApi.getById(...)`.
  // Object-literal API wrappers (`export const userApi = { getById: ... }`)
  // are indexed under composite export names like `userApi.getById`, so
  // emitting the composite invoked name lets call-graph resolution find
  // them via the file's importMap.
  for (const call of node.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const callee = call.getExpression();
    if (Node.isPropertyAccessExpression(callee)) {
      const owner = callee.getExpression();
      if (Node.isIdentifier(owner)) {
        names.add(`${owner.getText()}.${callee.getName()}`);
      }
    }
  }
  return names;
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
    const isAxiosLike =
      callee === 'axios' ||
      callee === 'api' ||
      callee === 'http' ||
      EXTRA_AXIOS_INSTANCES.has(callee);
    if (isAxiosLike && AXIOS_METHODS.has(methodName)) {
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
      // Try to resolve the interpolated expression statically first (e.g.
      // `const PREFIX = '/users'`). Only fall back to `:param` if the value
      // is genuinely dynamic — otherwise the prefix-via-const-string idiom
      // collapses every endpoint into `:param/whatever`.
      const expr = span.getExpression();
      const resolved = readStringLikeLiteral(expr);
      out += resolved ?? paramise(expr.getText());
      out += span.getLiteral().getLiteralText();
    }
    return out;
  }
  if (Node.isBinaryExpression(node) && node.getOperatorToken().getKind() === SyntaxKind.PlusToken) {
    const left = readStringLikeLiteral(node.getLeft());
    const right = readStringLikeLiteral(node.getRight());
    if (left == null && right == null) return null;
    // Note: placeholder `<unresolved>` deliberately contains no `?` —
    // earlier `<?>` collided with normalisePath's query-string strip and
    // showed up as just `<` in the dashboard.
    return (left ?? '<unresolved>') + (right ?? paramise(node.getRight().getText()));
  }
  // process.env.X / import.meta.env.X — the canonical baseURL idiom.
  // Resolve to '' so `fetch(process.env.HOST + '/users')` becomes '/users'
  // instead of '<unresolved>/users'. Endpoints can then be grouped across
  // env-driven and literal-baseURL forms of the same path.
  if (Node.isPropertyAccessExpression(node)) {
    const owner = node.getExpression();
    if (Node.isPropertyAccessExpression(owner)) {
      const root = owner.getExpression().getText();
      const middle = owner.getName();
      if (root === 'process' && middle === 'env') return '';
    }
    // import.meta.env.X — `import.meta` is a MetaProperty in ts-morph,
    // but its text is stable.
    if (owner.getText() === 'import.meta.env') return '';
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
