import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateDependencyReports } from '../reports/dependency-report';

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

describe('generateDependencyReports', () => {
  it('writes JSON, HTML, and SVG reports with resolved child component dependencies', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'page-dep-map-report-'));

    writeFile(
      path.join(root, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
          paths: {
            'components/*': ['src/components/*'],
          },
          jsx: 'react-jsx',
        },
      }),
    );
    writeFile(
      path.join(root, 'src/pages/index.tsx'),
      "import { Hero } from 'components/Hero';\nexport default function HomePage() { return <Hero />; }\n",
    );
    writeFile(
      path.join(root, 'src/components/Hero.tsx'),
      "import { Badge } from './Badge';\nexport function Hero() { return <Badge />; }\n",
    );
    writeFile(
      path.join(root, 'src/components/Badge.tsx'),
      "import { Hero } from './Hero';\nexport function Badge() { return <Hero />; }\n",
    );

    const report = await generateDependencyReports(root, {
      pagePatterns: ['src/pages/**/*.tsx'],
      tsConfigPath: 'tsconfig.json',
      output: { dir: path.join(root, 'page-dep-map-reports') },
    });

    const outputDir = path.join(root, 'page-dep-map-reports');
    const jsonPath = path.join(outputDir, 'pages-deps-report.json');
    const htmlPath = path.join(outputDir, 'interactive-dependency-map.html');
    const svgPath = path.join(outputDir, 'full-dependency-graph.svg');

    expect(fs.existsSync(jsonPath)).toBe(true);
    expect(fs.existsSync(htmlPath)).toBe(true);
    expect(fs.existsSync(svgPath)).toBe(true);

    expect(report.pages[0]?.tree[0]?.children[0]).toMatchObject({
      name: 'Hero',
      importSource: 'components/Hero',
      filePath: 'src/components/Hero.tsx',
    });
    expect(report.circularDependencies.length).toBeGreaterThan(0);

    const html = fs.readFileSync(htmlPath, 'utf-8');
    expect(html).toContain('Search pages');
    expect(html).toContain('Circular Dependency');

    const svg = fs.readFileSync(svgPath, 'utf-8');
    expect(svg).toContain('<svg');
    expect(svg).toContain('#dc2626');
  });
});
