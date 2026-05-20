import * as fs from 'node:fs';
import * as path from 'node:path';
import fg from 'fast-glob';
import {
  Node,
  Project,
  SyntaxKind,
  type ImportDeclaration,
  type SourceFile,
} from 'ts-morph';
import type { PageDepMapConfig } from '@page-dep-map/shared';
import { collectPages } from '../collectors/collect-pages.js';
import { loadConfig } from '../config/load-config.js';
import { mergeConfig } from '../config/merge-config.js';

export interface DependencyReport {
  generatedAt: string;
  targetDir: string;
  maxDepth: number;
  pages: PageDependency[];
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  circularDependencies: CircularDependency[];
}

export interface PageDependency {
  pageName: string;
  filePath: string;
  routePath?: string;
  tree: DependencyTreeNode[];
}

export interface DependencyTreeNode {
  id: string;
  name: string;
  depth: number;
  kind: 'page' | 'component' | 'external';
  importSource?: string;
  filePath?: string;
  children: DependencyTreeNode[];
  isCircularRef?: boolean;
}

export interface DependencyNode {
  id: string;
  name: string;
  kind: 'page' | 'component' | 'external';
  filePath?: string;
}

export interface DependencyEdge {
  from: string;
  to: string;
  childName: string;
  importSource?: string;
  isCircular?: boolean;
}

export interface CircularDependency {
  path: string[];
}

interface ChildReference {
  name: string;
  importSource?: string;
  resolvedFilePath?: string;
  targetId: string;
  kind: 'component' | 'external';
}

interface FileInfo {
  id: string;
  name: string;
  filePath: string;
  children: ChildReference[];
}

interface ImportBinding {
  importSource: string;
  resolvedFilePath?: string;
}

const DEFAULT_MAX_DEPTH = 4;

export async function generateDependencyReports(
  targetDir: string,
  config?: Partial<PageDepMapConfig>,
): Promise<DependencyReport> {
  const resolvedTargetDir = path.resolve(targetDir);
  const fileConfig = await loadConfig(resolvedTargetDir);
  const resolvedConfig = mergeConfig(fileConfig, config);
  const outputDir = path.resolve(
    resolvedTargetDir,
    resolvedConfig.outputDir === './page-dep-map-output'
      ? './page-dep-map-reports'
      : resolvedConfig.outputDir,
  );
  const maxDepth = DEFAULT_MAX_DEPTH;
  const project = createReportProject(resolvedTargetDir, resolvedConfig.tsConfigPath);

  addProjectFiles(project, resolvedTargetDir, resolvedConfig.excludePatterns);

  const pageEntries = collectPages(
    project,
    resolvedTargetDir,
    resolvedConfig.pagePatterns,
    resolvedConfig.excludePatterns,
  );
  const fileInfos = buildFileInfos(project, resolvedTargetDir);
  const pageFileIds = new Set(
    pageEntries.map((entry) => normalizeRelativePath(entry.filePath)),
  );
  const nodes = buildNodes(fileInfos, pageFileIds);
  const edges = buildEdges(fileInfos);
  const circularDependencies = findCircularDependencies(edges);
  const circularEdgeKeys = new Set(
    circularDependencies.flatMap((cycle) => {
      const keys: string[] = [];
      for (let i = 0; i < cycle.path.length - 1; i++) {
        keys.push(`${cycle.path[i]}->${cycle.path[i + 1]}`);
      }
      return keys;
    }),
  );

  for (const edge of edges) {
    edge.isCircular = circularEdgeKeys.has(`${edge.from}->${edge.to}`);
  }

  const pages: PageDependency[] = pageEntries.map((entry) => {
    const id = normalizeRelativePath(entry.filePath);
    const info = fileInfos.get(id);

    return {
      pageName: derivePageName(entry.filePath),
      filePath: entry.filePath,
      routePath: entry.routePath,
      tree: info ? [buildTree(info, fileInfos, pageFileIds, maxDepth, [id], 0)] : [],
    };
  });

  const report: DependencyReport = {
    generatedAt: new Date().toISOString(),
    targetDir: resolvedTargetDir,
    maxDepth,
    pages,
    nodes,
    edges,
    circularDependencies,
  };

  writeReports(outputDir, report);

  return report;
}

function createReportProject(targetDir: string, tsConfigPath?: string): Project {
  const resolvedTsConfigPath = tsConfigPath ? path.resolve(targetDir, tsConfigPath) : undefined;

  if (resolvedTsConfigPath && fs.existsSync(resolvedTsConfigPath)) {
    return new Project({
      tsConfigFilePath: resolvedTsConfigPath,
      skipAddingFilesFromTsConfig: true,
    });
  }

  return new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      allowJs: true,
      jsx: 4,
      module: 99,
      target: 99,
    },
  });
}

function addProjectFiles(
  project: Project,
  targetDir: string,
  excludePatterns: string[],
): void {
  const files = fg.sync(['**/*.{ts,tsx,js,jsx}'], {
    cwd: targetDir,
    absolute: true,
    ignore: [
      ...excludePatterns,
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/page-dep-map-output/**',
      '**/page-dep-map-reports/**',
    ],
    onlyFiles: true,
  });

  for (const file of files) {
    try {
      project.addSourceFileAtPathIfExists(file);
    } catch {
      continue;
    }
  }
}

function buildFileInfos(project: Project, targetDir: string): Map<string, FileInfo> {
  const infos = new Map<string, FileInfo>();

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = getRelativeFilePath(targetDir, sourceFile.getFilePath());
    if (!filePath || filePath.includes('node_modules/')) continue;

    const info: FileInfo = {
      id: filePath,
      name: getComponentName(sourceFile),
      filePath,
      children: [],
    };
    infos.set(info.id, info);
  }

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = getRelativeFilePath(targetDir, sourceFile.getFilePath());
    const info = filePath ? infos.get(filePath) : undefined;
    if (!info) continue;

    info.children = collectChildReferences(sourceFile, targetDir, infos);
  }

  return infos;
}

function collectChildReferences(
  sourceFile: SourceFile,
  targetDir: string,
  infos: Map<string, FileInfo>,
): ChildReference[] {
  const importBindings = getImportBindings(sourceFile, targetDir);
  const localDeclarations = getLocalComponentNames(sourceFile);
  const children = new Map<string, ChildReference>();
  const elements = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
  ];

  for (const element of elements) {
    const tag = element.getTagNameNode().getText();
    if (!isComponentTag(tag)) continue;

    const localName = tag.includes('.') ? tag.split('.')[0]! : tag;
    const binding = importBindings.get(localName);
    const localFilePath = getRelativeFilePath(targetDir, sourceFile.getFilePath());
    let targetId = '';
    let kind: ChildReference['kind'] = 'external';

    if (binding?.resolvedFilePath && infos.has(binding.resolvedFilePath)) {
      targetId = binding.resolvedFilePath;
      kind = 'component';
    } else if (!binding && localDeclarations.has(localName) && localFilePath) {
      targetId = `${localFilePath}#${localName}`;
      kind = 'component';
    } else {
      targetId = `external:${binding?.importSource ?? 'local'}:${tag}`;
    }

    if (!children.has(`${targetId}:${tag}`)) {
      children.set(`${targetId}:${tag}`, {
        name: tag,
        importSource: binding?.importSource,
        resolvedFilePath: binding?.resolvedFilePath ?? (kind === 'component' ? localFilePath : undefined),
        targetId,
        kind,
      });
    }
  }

  return [...children.values()];
}

function getImportBindings(
  sourceFile: SourceFile,
  targetDir: string,
): Map<string, ImportBinding> {
  const bindings = new Map<string, ImportBinding>();

  for (const declaration of sourceFile.getImportDeclarations()) {
    const source = declaration.getModuleSpecifierValue();
    const resolvedFilePath = resolveImportFilePath(declaration, targetDir);
    const binding: ImportBinding = { importSource: source, resolvedFilePath };
    const defaultImport = declaration.getDefaultImport();
    const namespaceImport = declaration.getNamespaceImport();

    if (defaultImport) {
      bindings.set(defaultImport.getText(), binding);
    }
    if (namespaceImport) {
      bindings.set(namespaceImport.getText(), binding);
    }
    for (const namedImport of declaration.getNamedImports()) {
      const alias = namedImport.getAliasNode()?.getText();
      bindings.set(alias ?? namedImport.getName(), binding);
    }
  }

  return bindings;
}

function resolveImportFilePath(
  declaration: ImportDeclaration,
  targetDir: string,
): string | undefined {
  const sourceFile = declaration.getModuleSpecifierSourceFile();
  if (!sourceFile) return undefined;

  return getRelativeFilePath(targetDir, sourceFile.getFilePath());
}

function getLocalComponentNames(sourceFile: SourceFile): Set<string> {
  const names = new Set<string>();

  for (const fn of sourceFile.getFunctions()) {
    const name = fn.getName();
    if (name && isComponentTag(name)) names.add(name);
  }
  for (const statement of sourceFile.getVariableStatements()) {
    for (const declaration of statement.getDeclarations()) {
      const name = declaration.getName();
      if (isComponentTag(name)) names.add(name);
    }
  }

  return names;
}

function buildNodes(
  fileInfos: Map<string, FileInfo>,
  pageFileIds: Set<string>,
): DependencyNode[] {
  const nodes = [...fileInfos.values()].map((info) => ({
    id: info.id,
    name: info.name,
    kind: pageFileIds.has(info.id) ? 'page' as const : 'component' as const,
    filePath: info.filePath,
  }));
  const externalNodes = new Map<string, DependencyNode>();
  const childOnlyNodes = new Map<string, DependencyNode>();

  for (const info of fileInfos.values()) {
    for (const child of info.children) {
      if (child.kind === 'external' && !externalNodes.has(child.targetId)) {
        externalNodes.set(child.targetId, {
          id: child.targetId,
          name: child.name,
          kind: 'external',
        });
      } else if (child.kind === 'component' && !fileInfos.has(child.targetId)) {
        childOnlyNodes.set(child.targetId, {
          id: child.targetId,
          name: child.name,
          kind: 'component',
          filePath: child.resolvedFilePath,
        });
      }
    }
  }

  return [...nodes, ...childOnlyNodes.values(), ...externalNodes.values()];
}

function buildEdges(fileInfos: Map<string, FileInfo>): DependencyEdge[] {
  const edges: DependencyEdge[] = [];
  const seen = new Set<string>();

  for (const info of fileInfos.values()) {
    for (const child of info.children) {
      const key = `${info.id}->${child.targetId}:${child.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({
        from: info.id,
        to: child.targetId,
        childName: child.name,
        importSource: child.importSource,
      });
    }
  }

  return edges;
}

function buildTree(
  info: FileInfo,
  fileInfos: Map<string, FileInfo>,
  pageFileIds: Set<string>,
  maxDepth: number,
  stack: string[],
  depth: number,
): DependencyTreeNode {
  const children: DependencyTreeNode[] = [];

  if (depth < maxDepth) {
    for (const child of info.children) {
      const nextInfo = fileInfos.get(child.targetId);
      const isCircularRef = stack.includes(child.targetId);
      children.push({
        id: child.targetId,
        name: child.name,
        depth: depth + 1,
        kind: child.kind,
        importSource: child.importSource,
        filePath: child.resolvedFilePath,
        isCircularRef,
        children: nextInfo && !isCircularRef
          ? buildTree(
              nextInfo,
              fileInfos,
              pageFileIds,
              maxDepth,
              [...stack, child.targetId],
              depth + 1,
            ).children
          : [],
      });
    }
  }

  return {
    id: info.id,
    name: info.name,
    depth,
    kind: pageFileIds.has(info.id) ? 'page' : 'component',
    filePath: info.filePath,
    children,
  };
}

function findCircularDependencies(edges: DependencyEdge[]): CircularDependency[] {
  const graph = new Map<string, string[]>();
  const cycles = new Map<string, CircularDependency>();

  for (const edge of edges) {
    if (edge.to.startsWith('external:')) continue;
    graph.set(edge.from, [...(graph.get(edge.from) ?? []), edge.to]);
  }

  for (const node of graph.keys()) {
    visit(node, []);
  }

  function visit(node: string, stack: string[]): void {
    const index = stack.indexOf(node);
    if (index !== -1) {
      const cyclePath = [...stack.slice(index), node];
      cycles.set(normalizeCycle(cyclePath), { path: cyclePath });
      return;
    }

    for (const next of graph.get(node) ?? []) {
      visit(next, [...stack, node]);
    }
  }

  return [...cycles.values()];
}

function normalizeCycle(cyclePath: string[]): string {
  const cycle = cyclePath.slice(0, -1);
  const rotations = cycle.map((_, index) => [
    ...cycle.slice(index),
    ...cycle.slice(0, index),
  ].join('->'));
  rotations.sort();
  return rotations[0] ?? cyclePath.join('->');
}

function writeReports(outputDir: string, report: DependencyReport): void {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, 'pages-deps-report.json'),
    JSON.stringify(report, null, 2),
    'utf-8',
  );
  fs.writeFileSync(
    path.join(outputDir, 'interactive-dependency-map.html'),
    renderInteractiveHtml(report),
    'utf-8',
  );
  fs.writeFileSync(
    path.join(outputDir, 'full-dependency-graph.svg'),
    renderSvg(report),
    'utf-8',
  );
}

function renderInteractiveHtml(report: DependencyReport): string {
  const data = JSON.stringify(report).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Interactive Dependency Map</title>
  <style>
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; background: #f9fafb; }
    .layout { display: grid; grid-template-columns: 320px minmax(0, 1fr); min-height: 100vh; }
    aside { border-right: 1px solid #e5e7eb; background: #fff; padding: 20px; position: sticky; top: 0; height: 100vh; overflow: auto; box-sizing: border-box; }
    main { padding: 28px; overflow: auto; }
    input { width: 100%; box-sizing: border-box; border: 1px solid #d1d5db; border-radius: 6px; padding: 9px 10px; font-size: 14px; }
    button { width: 100%; text-align: left; border: 0; border-radius: 6px; background: transparent; padding: 8px 10px; cursor: pointer; font-size: 13px; }
    button:hover, button.active { background: #eef2ff; color: #1d4ed8; }
    .page-list { margin-top: 14px; display: grid; gap: 3px; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 18px; }
    .muted { color: #6b7280; }
    .tree ul { list-style: none; margin: 0; padding-left: 22px; border-left: 1px solid #d1d5db; }
    .tree li { margin: 10px 0; }
    .node { display: inline-grid; gap: 3px; border: 1px solid #d1d5db; border-radius: 6px; padding: 8px 10px; background: #fff; }
    .node.circular { border-color: #dc2626; background: #fef2f2; color: #991b1b; }
    .node.external { border-style: dashed; color: #6b7280; }
    .name { font-weight: 700; font-size: 13px; }
    .meta { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; color: #6b7280; }
    .badge { display: inline-flex; width: fit-content; border-radius: 999px; padding: 2px 7px; font-size: 11px; font-weight: 700; background: #e5e7eb; }
    .badge.circular { background: #fee2e2; color: #b91c1c; }
  </style>
</head>
<body>
  <div class="layout">
    <aside>
      <h1>Dependency Map</h1>
      <label class="muted" for="search">Search pages</label>
      <input id="search" placeholder="Search pages" />
      <div id="page-list" class="page-list"></div>
    </aside>
    <main>
      <div id="detail" class="card"></div>
    </main>
  </div>
  <script>
    const report = ${data};
    const list = document.getElementById('page-list');
    const search = document.getElementById('search');
    const detail = document.getElementById('detail');
    let selected = report.pages[0]?.pageName;

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    }
    function renderList() {
      const q = search.value.toLowerCase();
      list.innerHTML = report.pages
        .filter((page) => page.pageName.toLowerCase().includes(q) || page.filePath.toLowerCase().includes(q))
        .map((page) => '<button class="' + (page.pageName === selected ? 'active' : '') + '" data-page="' + escapeHtml(page.pageName) + '">' + escapeHtml(page.pageName) + '<br><span class="muted">' + escapeHtml(page.routePath ?? page.filePath) + '</span></button>')
        .join('');
    }
    function renderNode(node) {
      const cls = ['node', node.kind === 'external' ? 'external' : '', node.isCircularRef ? 'circular' : ''].filter(Boolean).join(' ');
      const circular = node.isCircularRef ? '<span class="badge circular">Circular Dependency</span>' : '';
      const children = node.children?.length ? '<ul>' + node.children.map(renderNode).join('') + '</ul>' : '';
      return '<li><div class="' + cls + '"><span class="name">' + escapeHtml(node.name) + '</span>' + circular + '<span class="meta">' + escapeHtml(node.filePath ?? node.importSource ?? node.id) + '</span></div>' + children + '</li>';
    }
    function renderDetail() {
      const page = report.pages.find((item) => item.pageName === selected) ?? report.pages[0];
      if (!page) {
        detail.innerHTML = '<h2>No pages found</h2>';
        return;
      }
      detail.innerHTML = '<h2>' + escapeHtml(page.pageName) + '</h2><p class="muted">' + escapeHtml(page.filePath) + '</p><p class="muted">Showing up to depth ' + report.maxDepth + '</p><div class="tree"><ul>' + page.tree.map(renderNode).join('') + '</ul></div>';
    }
    list.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-page]');
      if (!button) return;
      selected = button.dataset.page;
      renderList();
      renderDetail();
    });
    search.addEventListener('input', renderList);
    renderList();
    renderDetail();
  </script>
</body>
</html>
`;
}

function renderSvg(report: DependencyReport): string {
  const internalNodes = report.nodes.filter((node) => !node.id.startsWith('external:'));
  const nodeIndex = new Map(internalNodes.map((node, index) => [node.id, index]));
  const width = 1600;
  const rowHeight = 70;
  const height = Math.max(400, internalNodes.length * rowHeight + 80);
  const xFor = (id: string) => 80 + ((nodeIndex.get(id) ?? 0) % 4) * 370;
  const yFor = (id: string) => 60 + Math.floor((nodeIndex.get(id) ?? 0) / 4) * rowHeight;
  const lines = report.edges
    .filter((edge) => nodeIndex.has(edge.from) && nodeIndex.has(edge.to))
    .map((edge) => {
      const color = edge.isCircular ? '#dc2626' : '#94a3b8';
      return `<line x1="${xFor(edge.from) + 130}" y1="${yFor(edge.from) + 18}" x2="${xFor(edge.to)}" y2="${yFor(edge.to) + 18}" stroke="${color}" stroke-width="${edge.isCircular ? 3 : 1.5}" marker-end="url(#arrow)" />`;
    })
    .join('\n');
  const boxes = internalNodes
    .map((node) => {
      const x = xFor(node.id);
      const y = yFor(node.id);
      const fill = node.kind === 'page' ? '#eef2ff' : '#ffffff';
      return `<g>
  <rect x="${x}" y="${y}" width="260" height="42" rx="6" fill="${fill}" stroke="#cbd5e1" />
  <text x="${x + 10}" y="${y + 18}" font-size="12" font-weight="700" fill="#111827">${escapeXml(node.name)}</text>
  <text x="${x + 10}" y="${y + 34}" font-size="10" fill="#64748b">${escapeXml(node.filePath ?? node.id)}</text>
</g>`;
    })
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>
  <marker id="arrow" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto" markerUnits="strokeWidth">
    <path d="M0,0 L8,4 L0,8 z" fill="#64748b" />
  </marker>
</defs>
<rect width="100%" height="100%" fill="#f8fafc" />
<text x="40" y="28" font-size="18" font-weight="700" fill="#111827">Full Dependency Graph</text>
<text x="270" y="28" font-size="12" fill="#dc2626">red edges = circular dependency</text>
${lines}
${boxes}
</svg>
`;
}

function getComponentName(sourceFile: SourceFile): string {
  const defaultSymbol = sourceFile.getDefaultExportSymbol();
  const defaultDeclaration = defaultSymbol?.getDeclarations()[0];
  if (defaultDeclaration && Node.isFunctionDeclaration(defaultDeclaration)) {
    return defaultDeclaration.getName() ?? basenameWithoutExt(sourceFile.getBaseName());
  }
  if (defaultDeclaration && Node.isVariableDeclaration(defaultDeclaration)) {
    return defaultDeclaration.getName();
  }

  for (const fn of sourceFile.getFunctions()) {
    const name = fn.getName();
    if (name && isComponentTag(name)) return name;
  }
  for (const statement of sourceFile.getVariableStatements()) {
    for (const declaration of statement.getDeclarations()) {
      const name = declaration.getName();
      if (isComponentTag(name)) return name;
    }
  }

  return basenameWithoutExt(sourceFile.getBaseName());
}

function derivePageName(filePath: string): string {
  const normalized = normalizeRelativePath(filePath);
  let name = normalized
    .replace(/^(src\/)?app\//, '')
    .replace(/^(src\/)?pages\//, '');
  name = name
    .replace(/\/page\.\w+$/, '')
    .replace(/\/index\.\w+$/, '')
    .replace(/\.\w+$/, '');

  return name === '' || name === 'page' || name === 'index' ? 'root' : name;
}

function basenameWithoutExt(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '');
}

function getRelativeFilePath(targetDir: string, filePath: string): string | undefined {
  const relative = normalizeRelativePath(path.relative(targetDir, filePath));
  if (relative.startsWith('..')) return undefined;
  return relative;
}

function normalizeRelativePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function isComponentTag(name: string): boolean {
  const baseName = name.includes('.') ? name.split('.')[0]! : name;
  const firstChar = baseName.charAt(0);
  if (!firstChar) return false;
  if (firstChar !== firstChar.toUpperCase() || firstChar === firstChar.toLowerCase()) {
    return false;
  }
  return !['Fragment', 'Suspense', 'ErrorBoundary', 'StrictMode', 'Profiler'].includes(baseName);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
