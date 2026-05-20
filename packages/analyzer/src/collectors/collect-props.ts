import {
  type SourceFile,
  type FunctionDeclaration,
  type VariableDeclaration,
  type ParameterDeclaration,
  type TypeNode,
  type PropertySignature,
  type PropertyDeclaration,
  SyntaxKind,
  Node,
} from 'ts-morph';
import type { DirectProp } from '@page-dep-map/shared';

/**
 * 컴포넌트의 Props 수집 결과.
 */
export interface PropsResult {
  props: DirectProp[];
  spreadPropsDetected: boolean;
}

/**
 * 소스 파일의 default export 컴포넌트에서 props를 추출한다.
 * SPEC 1.2 — 5가지 Case를 모두 처리한다.
 *
 * Case 1: inline type — function Page({ name }: { name: string }) {}
 * Case 2: interface/type alias — function Page({ name }: UserPageProps) {}
 * Case 3: arrow function — const Page = ({ name }: Props) => {}
 * Case 4: React.FC — const Page: React.FC<Props> = ({ name }) => {}
 * Case 5: forwardRef — forwardRef<Div, Props>(({ name }, ref) => {})
 */
export function collectProps(sourceFile: SourceFile): PropsResult {
  const empty: PropsResult = { props: [], spreadPropsDetected: false };

  // Find the main component function (default export or first uppercase function)
  const componentFn = findComponentFunction(sourceFile);
  if (!componentFn) return empty;

  return extractPropsFromNode(componentFn, sourceFile);
}

/**
 * 소스 파일에서 주 컴포넌트 함수를 찾는다.
 * 우선순위: default export > 첫 번째 대문자 함수/변수.
 */
function findComponentFunction(
  sourceFile: SourceFile,
): FunctionDeclaration | VariableDeclaration | null {
  // Check default export
  const defaultExport = sourceFile.getDefaultExportSymbol();
  if (defaultExport) {
    const decls = defaultExport.getDeclarations();
    for (const decl of decls) {
      if (Node.isFunctionDeclaration(decl)) return decl;
      if (Node.isVariableDeclaration(decl)) return decl;
      // export default function Page() {} has ExportAssignment pointing to the function
      if (Node.isExportAssignment(decl)) {
        const expr = decl.getExpression();
        if (Node.isIdentifier(expr)) {
          const sym = expr.getSymbol();
          if (sym) {
            const symDecls = sym.getDeclarations();
            for (const sd of symDecls) {
              if (Node.isFunctionDeclaration(sd)) return sd;
              if (Node.isVariableDeclaration(sd)) return sd;
            }
          }
        }
      }
    }
  }

  // Fallback: first uppercase function declaration
  for (const fn of sourceFile.getFunctions()) {
    const name = fn.getName();
    if (name && /^[A-Z]/.test(name)) return fn;
  }

  // Fallback: first uppercase variable (arrow function)
  for (const stmt of sourceFile.getVariableStatements()) {
    for (const decl of stmt.getDeclarations()) {
      const name = decl.getName();
      if (/^[A-Z]/.test(name)) return decl;
    }
  }

  return null;
}

/**
 * 함수/변수 선언에서 props를 추출한다.
 */
function extractPropsFromNode(
  node: FunctionDeclaration | VariableDeclaration,
  sourceFile: SourceFile,
): PropsResult {
  if (Node.isFunctionDeclaration(node)) {
    // Case 1 & 2: function Page({ name }: Props)
    return extractFromParams(node.getParameters(), sourceFile);
  }

  // VariableDeclaration cases
  const initializer = node.getInitializer();

  // Case 5: forwardRef
  if (initializer && Node.isCallExpression(initializer)) {
    const exprText = initializer.getExpression().getText();
    if (exprText === 'forwardRef' || exprText.endsWith('.forwardRef')) {
      return extractFromForwardRef(initializer, sourceFile);
    }
  }

  // Case 4: React.FC<Props>
  const typeNode = node.getTypeNode();
  if (typeNode) {
    const typeText = typeNode.getText();
    const fcMatch = typeText.match(
      /(?:React\.)?FC<(.+)>|(?:React\.)?FunctionComponent<(.+)>/,
    );
    if (fcMatch) {
      const propsTypeName = fcMatch[1] ?? fcMatch[2];
      if (propsTypeName) {
        return extractFromTypeName(propsTypeName, sourceFile);
      }
    }
  }

  // Case 3: arrow function — const Page = ({ name }: Props) => {}
  if (initializer) {
    if (
      Node.isArrowFunction(initializer) ||
      Node.isFunctionExpression(initializer)
    ) {
      return extractFromParams(initializer.getParameters(), sourceFile);
    }
  }

  return { props: [], spreadPropsDetected: false };
}

/**
 * 함수 파라미터에서 props를 추출한다. (Case 1, 2, 3)
 */
function extractFromParams(
  params: ParameterDeclaration[],
  sourceFile: SourceFile,
): PropsResult {
  if (params.length === 0) return { props: [], spreadPropsDetected: false };

  const firstParam = params[0]!;

  // Check if the parameter itself is a rest parameter (spread)
  if (firstParam.isRestParameter()) {
    return { props: [], spreadPropsDetected: true };
  }

  // Check if destructured
  const nameNode = firstParam.getNameNode();
  const isDestructured = Node.isObjectBindingPattern(nameNode);

  // Get the type
  const typeNode = firstParam.getTypeNode();

  if (isDestructured && Node.isObjectBindingPattern(nameNode)) {
    // Extract from destructuring with inline or referenced type
    return extractFromDestructuringAndType(nameNode, typeNode, sourceFile);
  }

  // Non-destructured: function Page(props: Props)
  // This means spread props likely
  if (typeNode) {
    const props = resolvePropsFromTypeNode(typeNode, sourceFile);
    return { props, spreadPropsDetected: true };
  }

  return { props: [], spreadPropsDetected: false };
}

/**
 * Destructuring pattern + type에서 props를 추출한다.
 */
function extractFromDestructuringAndType(
  bindingPattern: Node,
  typeNode: TypeNode | undefined,
  sourceFile: SourceFile,
): PropsResult {
  let spreadDetected = false;
  const props: DirectProp[] = [];

  // If type annotation exists, use it for detailed type info
  if (typeNode) {
    const typeProps = resolvePropsFromTypeNode(typeNode, sourceFile);
    if (typeProps.length > 0) {
      // Check for default values in the binding pattern to override required
      const defaults = collectDefaultValues(bindingPattern);
      for (const prop of typeProps) {
        if (defaults.has(prop.name)) {
          props.push({ ...prop, required: false });
        } else {
          props.push(prop);
        }
      }
    }
  }

  // Check binding elements for spread
  if (Node.isObjectBindingPattern(bindingPattern)) {
    for (const element of bindingPattern.getElements()) {
      if (element.getDotDotDotToken()) {
        spreadDetected = true;
      }
    }
  }

  // If no type info, fall back to binding element names
  if (props.length === 0 && Node.isObjectBindingPattern(bindingPattern)) {
    for (const element of bindingPattern.getElements()) {
      if (element.getDotDotDotToken()) {
        spreadDetected = true;
        continue;
      }
      const name = element.getNameNode().getText();
      const hasDefault = element.getInitializer() !== undefined;
      props.push({
        name,
        required: !hasDefault,
        type: undefined,
      });
    }
  }

  return { props, spreadPropsDetected: spreadDetected };
}

/**
 * TypeNode에서 property 정보를 추출한다.
 */
function resolvePropsFromTypeNode(
  typeNode: TypeNode,
  sourceFile: SourceFile,
): DirectProp[] {
  const props: DirectProp[] = [];
  const typeText = typeNode.getText().trim();

  // Inline type literal: { name: string; age?: number }
  if (typeText.startsWith('{')) {
    return extractFromTypeLiteral(typeNode);
  }

  // Type reference: SomeProps
  return resolveTypeReference(typeText, sourceFile);
}

/**
 * Type literal에서 직접 props를 추출한다.
 */
function extractFromTypeLiteral(typeNode: Node): DirectProp[] {
  const props: DirectProp[] = [];
  const members = typeNode.getDescendantsOfKind(SyntaxKind.PropertySignature);

  for (const member of members) {
    // Only take direct children (not nested objects)
    if (
      member.getParent() !== typeNode &&
      member.getParent()?.getParent() !== typeNode
    ) {
      continue;
    }
    props.push(propertySignatureToProp(member));
  }

  return props;
}

/**
 * 타입 이름으로부터 interface/type alias를 찾아 props를 추출한다.
 */
function resolveTypeReference(
  typeName: string,
  sourceFile: SourceFile,
): DirectProp[] {
  // Strip generic params for lookup
  const baseName = typeName.replace(/<.*>$/, '').trim();

  // Search in same file
  for (const iface of sourceFile.getInterfaces()) {
    if (iface.getName() === baseName) {
      return iface.getProperties().map(propertySignatureToProp);
    }
  }

  for (const alias of sourceFile.getTypeAliases()) {
    if (alias.getName() === baseName) {
      const typeNode = alias.getTypeNode();
      if (typeNode) {
        const members = typeNode.getDescendantsOfKind(
          SyntaxKind.PropertySignature,
        );
        return members.map(propertySignatureToProp);
      }
    }
  }

  // Could not resolve — return empty
  return [];
}

/**
 * PropertySignature → DirectProp 변환.
 */
function propertySignatureToProp(
  prop: PropertySignature | PropertyDeclaration,
): DirectProp {
  const name = prop.getName();
  const isOptional = prop.hasQuestionToken?.() ?? false;
  const typeNode = prop.getTypeNode();
  const type = typeNode ? typeNode.getText() : undefined;
  return { name, required: !isOptional, type };
}

/**
 * Binding pattern에서 default value가 있는 prop 이름을 수집한다.
 */
function collectDefaultValues(bindingPattern: Node): Set<string> {
  const defaults = new Set<string>();
  if (Node.isObjectBindingPattern(bindingPattern)) {
    for (const element of bindingPattern.getElements()) {
      if (element.getInitializer()) {
        defaults.add(element.getNameNode().getText());
      }
    }
  }
  return defaults;
}

/**
 * forwardRef 호출에서 props를 추출한다. (Case 5)
 * forwardRef<HTMLDivElement, Props>(({ name }, ref) => {})
 * → 두 번째 제네릭에서 props 추출, ref 파라미터 제외.
 */
function extractFromForwardRef(
  callExpr: Node,
  sourceFile: SourceFile,
): PropsResult {
  if (!Node.isCallExpression(callExpr)) {
    return { props: [], spreadPropsDetected: false };
  }

  // Try to get props from the second type argument
  const typeArgs = callExpr.getTypeArguments();
  if (typeArgs.length >= 2) {
    const propsType = typeArgs[1]!;
    const typeName = propsType.getText();
    const props = resolveTypeReference(typeName, sourceFile);
    if (props.length > 0) {
      return { props, spreadPropsDetected: false };
    }
  }

  // Fallback: get from the callback function parameter
  const args = callExpr.getArguments();
  if (args.length > 0) {
    const callback = args[0]!;
    if (Node.isArrowFunction(callback) || Node.isFunctionExpression(callback)) {
      const params = callback.getParameters();
      if (params.length > 0) {
        // First param is props, second is ref (exclude ref)
        return extractFromParams([params[0]!], sourceFile);
      }
    }
  }

  return { props: [], spreadPropsDetected: false };
}

/**
 * 타입 이름(문자열)으로부터 props를 추출한다. (React.FC<Props> 용)
 */
function extractFromTypeName(
  typeName: string,
  sourceFile: SourceFile,
): PropsResult {
  const props = resolveTypeReference(typeName, sourceFile);
  return { props, spreadPropsDetected: false };
}
