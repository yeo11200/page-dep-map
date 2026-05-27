import { Node, SyntaxKind, type SourceFile, type Project } from 'ts-morph';
import type { ComponentNode, ComponentNodeMeta } from '@page-dep-map/shared';
import { collectChildren } from './collect-children.js';
import { collectProps } from './collect-props.js';
import { collectHooks } from './collect-hooks.js';
import { resolveComponentSources } from './resolve-component-source.js';

const MAX_TREE_DEPTH = 10;

interface CollectResult {
  tree: ComponentNode[];
  depth: number;
}

export interface ComponentTreeOptions {
  baseDir?: string;
}

export function collectComponentTree(
  rootSource: SourceFile,
  project: Project,
  options: ComponentTreeOptions = {},
): CollectResult {
  const baseDir = options.baseDir;
  const ancestors = new Set<string>();
  ancestors.add(rootSource.getFilePath());

  const childNames = collectChildren(rootSource);
  const resolved = resolveComponentSources(rootSource, childNames, project);
  const resolvedMap = new Map(resolved.map((r) => [r.name, r] as const));

  const tree: ComponentNode[] = [];
  let deepest = 0;

  for (const childName of childNames) {
    const baseName = childName.includes('.') ? childName.split('.')[0]! : childName;
    const entry = resolvedMap.get(baseName);
    const node = buildNode(
      childName,
      entry?.sourceFile ?? null,
      project,
      1,
      ancestors,
      baseDir,
    );
    tree.push(node);
    if (node.depth > deepest) deepest = node.depth;
  }

  return { tree, depth: deepest };
}

function buildNode(
  name: string,
  source: SourceFile | null,
  project: Project,
  depth: number,
  ancestors: Set<string>,
  baseDir: string | undefined,
): ComponentNode {
  if (!source) {
    return {
      name,
      filePath: null,
      depth,
      external: true,
      cycle: false,
      truncated: false,
      children: [],
    };
  }

  const absolutePath = source.getFilePath();
  const filePath = toRelativePath(absolutePath, baseDir);

  if (ancestors.has(absolutePath)) {
    return {
      name,
      filePath,
      depth,
      external: false,
      cycle: true,
      truncated: false,
      children: [],
    };
  }

  if (depth >= MAX_TREE_DEPTH) {
    return {
      name,
      filePath,
      depth,
      external: false,
      cycle: false,
      truncated: true,
      children: [],
    };
  }

  ancestors.add(absolutePath);

  const childNames = collectChildren(source);
  const resolved = resolveComponentSources(source, childNames, project);
  const resolvedMap = new Map(resolved.map((r) => [r.name, r] as const));
  const meta = buildMeta(source, name, childNames, baseDir);

  if (childNames.length === 0) {
    ancestors.delete(absolutePath);
    return {
      name,
      filePath,
      depth,
      external: false,
      cycle: false,
      truncated: false,
      children: [],
      meta,
    };
  }

  const children: ComponentNode[] = [];
  let deepest = depth;
  for (const childName of childNames) {
    const baseName = childName.includes('.') ? childName.split('.')[0]! : childName;
    const entry = resolvedMap.get(baseName);
    const childNode = buildNode(
      childName,
      entry?.sourceFile ?? null,
      project,
      depth + 1,
      ancestors,
      baseDir,
    );
    children.push(childNode);
    if (childNode.depth > deepest) deepest = childNode.depth;
  }

  ancestors.delete(absolutePath);

  return {
    name,
    filePath,
    depth: deepest,
    external: false,
    cycle: false,
    truncated: false,
    children,
    meta,
  };
}

function buildMeta(
  source: SourceFile,
  componentName: string,
  childNames: string[],
  baseDir: string | undefined,
): ComponentNodeMeta {
  try {
    const propsResult = collectProps(source);
    const hooksResult = collectHooks(source);
    const declaration = findComponentDeclaration(source, componentName);
    const apiNames = [...new Set([...hooksResult.queries, ...collectApiNames(source)])].sort();
    return {
      propsCount: propsResult.props.length,
      propNames: propsResult.props.map((p) => p.name),
      hookNames: hooksResult.hooks,
      apiNames,
      leadingComment: declaration ? getLeadingCommentText(declaration) : undefined,
      codeLink: buildCodeLink(source, declaration, baseDir),
      childComponentCount: childNames.length,
    };
  } catch {
    return {
      propsCount: 0,
      propNames: [],
      hookNames: [],
      apiNames: [],
      childComponentCount: childNames.length,
    };
  }
}

function findComponentDeclaration(source: SourceFile, componentName: string): Node | null {
  const baseName = componentName.includes('.') ? componentName.split('.')[0]! : componentName;

  for (const fn of source.getFunctions()) {
    if (fn.getName() === baseName) return fn;
  }

  for (const statement of source.getVariableStatements()) {
    for (const declaration of statement.getDeclarations()) {
      if (declaration.getName() === baseName) return declaration;
    }
  }

  const defaultExport = source.getDefaultExportSymbol();
  for (const declaration of defaultExport?.getDeclarations() ?? []) {
    if (Node.isExportAssignment(declaration)) {
      const expr = declaration.getExpression();
      if (Node.isIdentifier(expr)) {
        for (const symbolDeclaration of expr.getSymbol()?.getDeclarations() ?? []) {
          if (Node.isFunctionDeclaration(symbolDeclaration) || Node.isVariableDeclaration(symbolDeclaration)) {
            return symbolDeclaration;
          }
        }
      }
    }
    if (Node.isFunctionDeclaration(declaration) || Node.isVariableDeclaration(declaration)) {
      return declaration;
    }
  }

  return null;
}

function getLeadingCommentText(node: Node): string | undefined {
  const ranges = node.getLeadingCommentRanges();
  const lastRange = ranges[ranges.length - 1];
  if (!lastRange) return undefined;

  const raw = lastRange.getText();
  const cleaned = raw
    .replace(/^\/\*\*?/, '')
    .replace(/\*\/$/, '')
    .split('\n')
    .map((line) => line.replace(/^\s*\*\s?/, '').replace(/^\/\/\s?/, '').trim())
    .filter(Boolean)
    .join('\n')
    .trim();

  return cleaned || undefined;
}

function collectApiNames(source: SourceFile): string[] {
  const apiBindings = new Set<string>();

  for (const declaration of source.getImportDeclarations()) {
    const moduleSpecifier = declaration.getModuleSpecifierValue();
    if (!isApiModule(moduleSpecifier)) continue;

    const defaultImport = declaration.getDefaultImport();
    if (defaultImport) apiBindings.add(defaultImport.getText());

    const namespaceImport = declaration.getNamespaceImport();
    if (namespaceImport) apiBindings.add(namespaceImport.getText());

    for (const namedImport of declaration.getNamedImports()) {
      apiBindings.add(namedImport.getAliasNode()?.getText() ?? namedImport.getName());
    }
  }

  const names = new Set<string>();
  for (const call of source.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expression = call.getExpression();
    if (Node.isIdentifier(expression)) {
      const name = expression.getText();
      if (apiBindings.has(name) || isApiLikeCall(name)) names.add(name);
    } else if (Node.isPropertyAccessExpression(expression)) {
      const owner = expression.getExpression().getText();
      const name = expression.getName();
      // Skip react-query key factories (`priceKeys.foo`, `companiesKey.bar`).
      // They're imported from query/ modules so they slip into apiBindings,
      // but they build queryKey arrays — not API calls — and never resolve
      // to an endpoint. Keep genuine object-wrapper clients (`userApi.getById`).
      if (isQueryKeyFactory(owner)) continue;
      if (apiBindings.has(owner) || isApiLikeCall(name)) names.add(`${owner}.${name}`);
    }
  }

  return [...names].sort();
}

function isApiModule(moduleSpecifier: string): boolean {
  return /(^|\/)(api|apis|services|requests?|query|queries|mutation|mutations)(\/|$)|api|client/i.test(moduleSpecifier);
}

function isApiLikeCall(name: string): boolean {
  return /^(fetch|api[A-Z]|use[A-Z].*(Query|Mutation)$|.*(Api|Query|Mutation)$)/.test(name);
}

/** react-query key factories: `priceKeys`, `companiesKey`, `adminKeys`… */
function isQueryKeyFactory(owner: string): boolean {
  return /Keys?$/.test(owner);
}

function buildCodeLink(
  source: SourceFile,
  declaration: Node | null,
  baseDir: string | undefined,
): string {
  const filePath = source.getFilePath();
  const line = declaration?.getStartLineNumber() ?? 1;
  const absolutePath = baseDir && !filePath.startsWith('/') ? `${baseDir}/${filePath}` : filePath;
  return `vscode://file/${absolutePath}:${line}:1`;
}

function toRelativePath(absolutePath: string, baseDir: string | undefined): string {
  if (!baseDir) return absolutePath;
  const normalizedBase = baseDir.endsWith('/') ? baseDir : baseDir + '/';
  if (absolutePath.startsWith(normalizedBase)) {
    return absolutePath.slice(normalizedBase.length);
  }
  return absolutePath;
}
