import { type SourceFile, type Project } from 'ts-morph';
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
  const meta = buildMeta(source, childNames);

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

  const resolved = resolveComponentSources(source, childNames, project);
  const resolvedMap = new Map(resolved.map((r) => [r.name, r] as const));

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

function buildMeta(source: SourceFile, childNames: string[]): ComponentNodeMeta {
  try {
    const propsResult = collectProps(source);
    const hooksResult = collectHooks(source);
    return {
      propsCount: propsResult.props.length,
      propNames: propsResult.props.map((p) => p.name),
      hookNames: hooksResult.hooks,
      childComponentCount: childNames.length,
    };
  } catch {
    return {
      propsCount: 0,
      propNames: [],
      hookNames: [],
      childComponentCount: childNames.length,
    };
  }
}

function toRelativePath(absolutePath: string, baseDir: string | undefined): string {
  if (!baseDir) return absolutePath;
  const normalizedBase = baseDir.endsWith('/') ? baseDir : baseDir + '/';
  if (absolutePath.startsWith(normalizedBase)) {
    return absolutePath.slice(normalizedBase.length);
  }
  return absolutePath;
}
