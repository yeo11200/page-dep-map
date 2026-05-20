import { type SourceFile, type Project } from 'ts-morph';
import * as path from 'node:path';
import * as fs from 'node:fs';

export interface ResolvedComponent {
  name: string;
  sourceFile: SourceFile;
}

const EXTENSION_CANDIDATES = [
  '.tsx',
  '.ts',
  '.jsx',
  '.js',
  '/index.tsx',
  '/index.ts',
  '/index.jsx',
  '/index.js',
];

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
    const namespaceImport = decl.getNamespaceImport();
    if (namespaceImport) candidates.push(namespaceImport.getText());

    const matches = candidates.filter((c) => wanted.has(c));
    if (matches.length === 0) continue;

    let target = decl.getModuleSpecifierSourceFile();

    if (!target && isRelative(moduleSpec)) {
      target = resolveRelativeModule(sourceFile, moduleSpec, project);
    }

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

function isRelative(moduleSpec: string): boolean {
  return moduleSpec.startsWith('./') || moduleSpec.startsWith('../');
}

function resolveRelativeModule(
  sourceFile: SourceFile,
  moduleSpec: string,
  project: Project,
): SourceFile | undefined {
  const fromDir = path.dirname(sourceFile.getFilePath());
  const baseTarget = path.resolve(fromDir, moduleSpec);

  for (const ext of EXTENSION_CANDIDATES) {
    const candidate = baseTarget + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      const added = project.addSourceFileAtPathIfExists(candidate);
      if (added) return added;
      const existing = project.getSourceFile(candidate);
      if (existing) return existing;
    }
  }

  return undefined;
}
