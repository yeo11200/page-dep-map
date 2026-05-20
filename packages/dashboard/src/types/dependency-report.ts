export interface DependencyReport {
  pages: PageDependency[];
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
