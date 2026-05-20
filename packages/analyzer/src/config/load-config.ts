import * as path from 'node:path';
import * as fs from 'node:fs';
import type { PageDepMapConfig } from '@page-dep-map/shared';

/** 설정 파일 탐색 이름 (우선순위 순) */
const CONFIG_FILE_NAMES = [
  'page-dep-map.config.ts',
  'page-dep-map.config.js',
  'page-dep-map.config.mjs',
];

/**
 * 대상 디렉토리에서 설정 파일을 찾아 로드한다.
 * 설정 파일이 없으면 빈 객체를 반환한다.
 *
 * MVP에서는 JSON 형태의 설정만 지원하고,
 * TS/JS 설정 파일은 향후 지원 예정.
 */
export async function loadConfig(
  targetDir: string,
): Promise<Partial<PageDepMapConfig>> {
  for (const fileName of CONFIG_FILE_NAMES) {
    const configPath = path.resolve(targetDir, fileName);
    if (fs.existsSync(configPath)) {
      try {
        // For MVP, try to import the config file
        // Note: TS config files need to be compiled first in production
        const module = await import(configPath);
        return module.default ?? module;
      } catch {
        // Config file exists but failed to load — use defaults
        return {};
      }
    }
  }

  // Also check for JSON config
  const jsonPath = path.resolve(targetDir, 'page-dep-map.config.json');
  if (fs.existsSync(jsonPath)) {
    try {
      const content = fs.readFileSync(jsonPath, 'utf-8');
      return JSON.parse(content) as Partial<PageDepMapConfig>;
    } catch {
      return {};
    }
  }

  return {};
}
