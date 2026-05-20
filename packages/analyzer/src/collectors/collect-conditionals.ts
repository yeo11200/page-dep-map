import { type SourceFile, SyntaxKind, Node, ts } from 'ts-morph';

/**
 * 조건 분기 수를 카운팅한다.
 * SPEC 1.8 — 조건 분기 수집 규칙.
 *
 * 카운팅 대상:
 * - if문: +1
 * - else if: +1
 * - switch case: +1 (case당)
 * - 삼항 연산자: +1
 * - JSX 조건부 렌더링 (&&, ternary): +1
 *
 * 카운팅 안 함:
 * - optional chaining (user?.name)
 * - nullish coalescing (value ?? defaultValue)
 */
export function collectConditionals(sourceFile: SourceFile): number {
  let count = 0;

  // if statements (includes else-if)
  const ifStatements = sourceFile.getDescendantsOfKind(
    SyntaxKind.IfStatement,
  );
  count += ifStatements.length;

  // switch case clauses (not default)
  const caseClauses = sourceFile.getDescendantsOfKind(
    SyntaxKind.CaseClause,
  );
  count += caseClauses.length;

  // Ternary (ConditionalExpression): a ? b : c
  const conditionalExprs = sourceFile.getDescendantsOfKind(
    SyntaxKind.ConditionalExpression,
  );
  count += conditionalExprs.length;

  // JSX && short-circuit: {isLoading && <Spinner />}
  const binaryExprs = sourceFile.getDescendantsOfKind(
    SyntaxKind.BinaryExpression,
  );

  for (const binExpr of binaryExprs) {
    const opToken = binExpr.getOperatorToken();
    const opKind = opToken.getKind();

    // Only count && inside JSX expressions
    if (opKind === SyntaxKind.AmpersandAmpersandToken) {
      // Check if this is inside a JsxExpression (JSX context)
      if (isInsideJsxExpression(binExpr)) {
        count += 1;
      }
    }
    // Skip ?? (nullish coalescing) — explicitly not counted per SPEC
  }

  return count;
}

/**
 * Node가 JsxExpression 내에 있는지 확인한다.
 */
function isInsideJsxExpression(node: Node): boolean {
  let current = node.getParent();
  while (current) {
    if (Node.isJsxExpression(current)) return true;
    // Stop at function boundary
    if (
      Node.isFunctionDeclaration(current) ||
      Node.isArrowFunction(current) ||
      Node.isFunctionExpression(current)
    ) {
      return false;
    }
    current = current.getParent();
  }
  return false;
}
