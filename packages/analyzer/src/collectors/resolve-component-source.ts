import { type SourceFile, type Project } from 'ts-morph';

export interface ResolvedComponent {
  name: string;
  sourceFile: SourceFile;
}

export function resolveComponentSources(
  sourceFile: SourceFile,
  componentNames: string[],
  project: Project,
): ResolvedComponent[] {
  const wanted = new Set<string>();
  for (const raw of componentNames) {
    const base = raw.includes('.') ? raw.split('.')[0]! : raw;
    wanted.add(base);
  }

  const resolved: ResolvedComponent[] = [];
  const seen = new Set<string>();

  for (const decl of sourceFile.getImportDeclarations()) {
    const moduleSpec = decl.getModuleSpecifierValue();
    if (!moduleSpec) continue;

    const candidates: string[] = [];
    const defaultImport = decl.getDefaultImport();
    if (defaultImport) candidates.push(defaultImport.getText());
    for (const named of decl.getNamedImports()) {
      candidates.push(named.getAliasNode()?.getText() ?? named.getName());
    }

    const matches = candidates.filter((c) => wanted.has(c));
    if (matches.length === 0) continue;

    const target = decl.getModuleSpecifierSourceFile();
    if (!target) continue;

    const filePath = target.getFilePath();
    if (filePath.includes('/node_modules/')) continue;

    project.addSourceFileAtPathIfExists(filePath);

    for (const name of matches) {
      if (seen.has(name)) continue;
      seen.add(name);
      resolved.push({ name, sourceFile: target });
    }
  }

  return resolved;
}
