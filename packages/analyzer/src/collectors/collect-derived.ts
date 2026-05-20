import { type SourceFile, SyntaxKind, Node } from 'ts-morph';

/**
 * 부모에서 가공된 데이터가 자식에게 전달되는 패턴을 탐지한다.
 * SPEC 1.6 — Derived Data Props 탐지 규칙.
 *
 * 탐지 조건:
 * 1. 자식에게 전달되는 prop의 value가 변수인가?
 * 2. 그 변수가 현재 컴포넌트 스코프에서 선언되었는가?
 * 3. 그 변수의 초기값이 props에서 직접 온 것이 아닌 계산/변환 결과인가?
 *
 * 제외: 직접 props 전달, 함수 전달, 상수 전달.
 */
export function collectDerived(
  sourceFile: SourceFile,
  propNames: Set<string>,
): string[] {
  const derivedProps: Set<string> = new Set();

  // Collect all local variable declarations in the component scope
  const localVars = collectLocalVariableDeclarations(sourceFile);

  // Find all JSX attributes that pass a variable
  const jsxAttributes = sourceFile.getDescendantsOfKind(
    SyntaxKind.JsxAttribute,
  );

  for (const attr of jsxAttributes) {
    const initializer = attr.getInitializer();
    if (!initializer) continue;

    // Must be a JSX expression: value={someVar}
    if (!Node.isJsxExpression(initializer)) continue;

    const expr = initializer.getExpression();
    if (!expr) continue;

    // Only check identifiers (variable references)
    if (!Node.isIdentifier(expr)) continue;

    const varName = expr.getText();

    // Skip if it's a direct prop pass-through
    if (propNames.has(varName)) continue;

    // Check if it's a locally declared variable
    const localDecl = localVars.get(varName);
    if (!localDecl) continue;

    // Check if the declaration involves computation (not just props assignment)
    if (isDerivedComputation(localDecl, propNames)) {
      const attrName = attr.getNameNode().getText();
      derivedProps.add(attrName);
    }
  }

  return [...derivedProps];
}

/**
 * 소스 파일의 컴포넌트 스코프 내 로컬 변수 선언을 수집한다.
 * key: 변수 이름, value: 초기값 텍스트.
 */
function collectLocalVariableDeclarations(
  sourceFile: SourceFile,
): Map<string, string> {
  const vars = new Map<string, string>();

  const varDecls = sourceFile.getDescendantsOfKind(
    SyntaxKind.VariableDeclaration,
  );

  for (const decl of varDecls) {
    const init = decl.getInitializer();
    if (!init) continue;
    vars.set(decl.getName(), init.getText());
  }

  return vars;
}

/**
 * 변수 초기값이 derived computation인지 판별한다.
 *
 * derived로 판별:
 * - 템플릿 리터럴 (` ... `)
 * - 배열 메서드 호출 (.filter, .map, .sort, .reduce 등)
 * - useMemo 호출
 * - 산술/논리 연산
 * - 함수 호출 결과 (단, 상수나 직접 prop이 아닌 경우)
 *
 * derived 아님:
 * - 직접 props 참조 (propNames에 포함)
 * - 상수 (UPPER_CASE)
 * - 함수 선언/표현식 (이벤트 핸들러)
 */
function isDerivedComputation(
  initializerText: string,
  propNames: Set<string>,
): boolean {
  const text = initializerText.trim();

  // Not derived: direct prop reference
  if (propNames.has(text)) return false;

  // Not derived: constant (ALL_CAPS)
  if (/^[A-Z][A-Z0-9_]*$/.test(text)) return false;

  // Not derived: arrow function or function expression (event handler)
  if (text.startsWith('(') && text.includes('=>')) return false;
  if (text.startsWith('function')) return false;

  // Not derived: simple literal values
  if (/^['"`]/.test(text) && !text.includes('${')) return false;
  if (/^\d+$/.test(text)) return false;
  if (text === 'true' || text === 'false' || text === 'null' || text === 'undefined') {
    return false;
  }

  // Derived: template literal with interpolation
  if (text.startsWith('`') && text.includes('${')) return true;

  // Derived: array method calls (.filter, .map, .sort, .reduce, .slice, .find)
  if (/\.(filter|map|sort|reduce|slice|find|flatMap|some|every)\(/.test(text)) {
    return true;
  }

  // Derived: useMemo
  if (text.startsWith('useMemo(') || text.startsWith('React.useMemo(')) {
    return true;
  }

  // Derived: function call that's not just a direct reference
  if (/\w+\(/.test(text) && !propNames.has(text.replace(/\(.*\)$/, ''))) {
    return true;
  }

  // Derived: property access chain with computation
  if (text.includes('.') && (text.includes('(') || text.includes('+'))) {
    return true;
  }

  return false;
}
