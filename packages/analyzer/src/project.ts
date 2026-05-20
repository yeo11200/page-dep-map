import { Project } from 'ts-morph';

/**
 * ts-morph Project를 초기화한다.
 * 분석 대상 프로젝트의 tsconfig.json을 사용하여 path alias를 해석한다.
 * tsconfig가 없으면 기본 설정으로 생성한다.
 */
export function createProject(tsConfigPath?: string): Project {
  if (tsConfigPath) {
    return new Project({
      tsConfigFilePath: tsConfigPath,
      skipAddingFilesFromTsConfig: true,
    });
  }

  return new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      target: 99, // ESNext
      module: 99, // ESNext
      jsx: 4,     // ReactJSX
      strict: true,
      esModuleInterop: true,
      allowJs: true,
    },
  });
}
