import { type SourceFile, type Project, SyntaxKind, Node } from 'ts-morph';
import type { PropFlow, DeepestProp, DirectProp } from '@page-dep-map/shared';

/** Prop flow 수집 결과 */
export interface PropFlowResult {
  propFlows: PropFlow[];
  deepestProps: DeepestProp[];
  maxDrillingDepth: number;
  passThroughPropsCount: number;
  unusedCandidateProps: string[];
}

/** 기본 최대 추적 깊이 */
const DEFAULT_MAX_TRACE_DEPTH = 5;

/**
 * 부모→자식 prop 전달을 추적한다.
 * SPEC 1.5 — Prop Flow 추적 규칙.
 *
 * 1. 현재 컴포넌트의 props가 자식에게 전달되는지 확인
 * 2. pass-through 판별: JSX 전달 외 다른 곳에서 참조 없으면 pass-through
 * 3. unused candidate: 어디서도 참조되지 않는 prop
 */
export function collectPropFlows(
  sourceFile: SourceFile,
  props: DirectProp[],
  componentName: string,
  _project?: Project,
  maxTraceDepth?: number,
): PropFlowResult {
  const maxDepth = maxTraceDepth ?? DEFAULT_MAX_TRACE_DEPTH;

  if (props.length === 0) {
    return {
      propFlows: [],
      deepestProps: [],
      maxDrillingDepth: 0,
      passThroughPropsCount: 0,
      unusedCandidateProps: [],
    };
  }

  const propFlows: PropFlow[] = [];
  const unusedCandidates: string[] = [];
  let maxDrillingDepth = 0;

  // Analyze each prop
  for (const prop of props) {
    const { jsxTargets, usedElsewhere } = analyzePropUsage(
      sourceFile,
      prop.name,
    );

    if (jsxTargets.length === 0 && !usedElsewhere) {
      // Not passed to children, not used anywhere → unused candidate
      unusedCandidates.push(prop.name);
      propFlows.push({
        propName: prop.name,
        sourceComponent: componentName,
        targetPath: [componentName],
        depth: 0,
        isPassThroughOnly: false,
        isUnusedCandidate: true,
      });
      continue;
    }

    for (const target of jsxTargets) {
      const isPassThrough = !usedElsewhere;
      const depth = 1; // Single-file depth for MVP

      propFlows.push({
        propName: prop.name,
        sourceComponent: componentName,
        targetPath: [componentName, target],
        depth,
        isPassThroughOnly: isPassThrough,
        isUnusedCandidate: false,
      });

      if (depth > maxDrillingDepth && depth <= maxDepth) {
        maxDrillingDepth = depth;
      }
    }

    if (jsxTargets.length === 0 && usedElsewhere) {
      // Used but not passed to children — not drilling
      propFlows.push({
        propName: prop.name,
        sourceComponent: componentName,
        targetPath: [componentName],
        depth: 0,
        isPassThroughOnly: false,
        isUnusedCandidate: false,
      });
    }
  }

  // Build deepest props
  const deepestProps = buildDeepestProps(propFlows);

  const passThroughPropsCount = propFlows.filter(
    (f) => f.isPassThroughOnly,
  ).length;

  return {
    propFlows,
    deepestProps,
    maxDrillingDepth,
    passThroughPropsCount,
    unusedCandidateProps: unusedCandidates,
  };
}

/**
 * 특정 prop이 컴포넌트 내에서 어떻게 사용되는지 분석한다.
 *
 * - jsxTargets: prop이 JSX attribute로 전달되는 자식 컴포넌트 목록
 * - usedElsewhere: JSX 전달 외에 다른 곳에서 참조되는지 여부
 */
function analyzePropUsage(
  sourceFile: SourceFile,
  propName: string,
): { jsxTargets: string[]; usedElsewhere: boolean } {
  const jsxTargets = new Set<string>();
  let usedElsewhere = false;

  // Find all identifier references to this prop name
  const identifiers = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier);

  for (const id of identifiers) {
    if (id.getText() !== propName) continue;

    const parent = id.getParent();
    if (!parent) continue;

    // Skip: destructuring binding (not a "use")
    if (Node.isBindingElement(parent)) continue;

    // Skip: parameter declaration
    if (Node.isParameterDeclaration(parent)) continue;

    // Skip: property signature in type/interface definition
    if (Node.isPropertySignature(parent)) continue;

    // Skip: import specifier
    if (Node.isImportSpecifier(parent)) continue;

    // Check if this is a JSX attribute value
    if (isJsxAttributeValue(id)) {
      const targetComponent = findParentJsxComponent(id);
      if (targetComponent) {
        jsxTargets.add(targetComponent);
      }
      continue;
    }

    // Any other usage counts as "used elsewhere"
    usedElsewhere = true;
  }

  return { jsxTargets: [...jsxTargets], usedElsewhere };
}

/**
 * Identifier가 JSX attribute의 값인지 확인한다.
 * <Child userId={userId} /> 에서 두 번째 userId.
 */
function isJsxAttributeValue(id: Node): boolean {
  let current = id.getParent();

  // {userId} → JsxExpression → JsxAttribute
  if (current && Node.isJsxExpression(current)) {
    current = current.getParent();
  }

  return current !== undefined && Node.isJsxAttribute(current);
}

/**
 * JSX attribute를 포함하는 부모 컴포넌트 이름을 찾는다.
 */
function findParentJsxComponent(node: Node): string | null {
  let current = node.getParent();

  while (current) {
    if (
      Node.isJsxOpeningElement(current) ||
      Node.isJsxSelfClosingElement(current)
    ) {
      const tagName = current.getTagNameNode().getText();
      // Only count component tags (uppercase)
      if (tagName.charAt(0) === tagName.charAt(0).toUpperCase() &&
          tagName.charAt(0) !== tagName.charAt(0).toLowerCase()) {
        return tagName;
      }
      return null;
    }
    current = current.getParent();
  }

  return null;
}

/**
 * PropFlow 배열에서 가장 깊게 전달되는 prop들을 추출한다.
 */
function buildDeepestProps(propFlows: PropFlow[]): DeepestProp[] {
  const depthMap = new Map<string, { depth: number; path: string[] }>();

  for (const flow of propFlows) {
    if (flow.depth === 0) continue;
    const existing = depthMap.get(flow.propName);
    if (!existing || flow.depth > existing.depth) {
      depthMap.set(flow.propName, {
        depth: flow.depth,
        path: flow.targetPath,
      });
    }
  }

  return [...depthMap.entries()]
    .map(([name, { depth, path }]) => ({ name, depth, path }))
    .sort((a, b) => b.depth - a.depth);
}
