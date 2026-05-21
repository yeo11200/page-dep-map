---
name: cli-guide
description: "Page Dependency Map의 CLI 도구(packages/cli) 구현 가이드. Commander.js CLI, Express 서버, 설정 파일 로딩, NPM 패키지 빌드 절차를 정의한다. cli-engineer 에이전트가 참조한다."
user-invocable: false
---

# CLI Guide

packages/cli 패키지의 구현 절차를 정의한다.

## 구현 순서

1. 패키지 스캐폴딩 (package.json with bin, tsup.config.ts)
2. Commander.js CLI 프레임워크
3. analyze 커맨드
4. serve 커맨드
5. default 커맨드 (analyze + serve)
6. Express 서버 + API 라우트
7. 설정 파일 로딩
8. NPM 패키지 빌드 검증

## CLI 커맨드 구조

```
page-dep-map [dir]                    # 기본: analyze + serve
page-dep-map analyze <dir> [options]  # JSON 생성만
page-dep-map serve <dir> [options]    # 대시보드만
```

### 옵션

| 옵션 | 기본값 | 설명 |
|------|--------|------|
| `-o, --output <dir>` | `./page-dep-map-output` | JSON 출력 디렉토리 |
| `-p, --port <number>` | `3399` | 대시보드 서버 포트 |
| `--no-open` | `false` | 브라우저 자동 오픈 비활성화 |
| `-c, --config <path>` | 자동 탐색 | 설정 파일 경로 |

## Express 서버 구현

```ts
// 핵심 구조
app.use(express.static(dashboardDir));  // SPA 정적 파일

// API 라우트
app.get('/api/summary', (req, res) => {
  const data = readJsonSync(path.join(analysisDir, 'project-summary.json'));
  res.json(data);
});

app.get('/api/pages', (req, res) => {
  const files = globSync('*.json', { cwd: path.join(analysisDir, 'pages') });
  const pages = files.map(f => readJsonSync(path.join(analysisDir, 'pages', f)));
  res.json(pages);
});

app.get('/api/pages/:name', (req, res) => {
  const filePath = path.join(analysisDir, 'pages', `${req.params.name}.json`);
  if (!existsSync(filePath)) return res.status(404).json({ error: 'Page not found' });
  res.json(readJsonSync(filePath));
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(dashboardDir, 'index.html'));
});
```

## 설정 파일 로딩 (SPEC 4)

로딩 우선순위:
1. `--config` CLI 플래그
2. `page-dep-map.config.ts` (jiti 또는 tsx로 로드)
3. `page-dep-map.config.js`
4. `.pagedeprc.json`
5. `package.json`의 `"pageDepMap"` 필드
6. 기본값 (`@page-dep-map/shared`의 상수)

TS 설정 파일 로딩에는 `jiti` 또는 `tsx` 패키지를 사용한다.

## Dashboard 임베딩

빌드 시 dashboard dist를 cli 패키지에 복사:

```json
// package.json scripts
{
  "prebuild": "cp -r ../dashboard/dist ./dashboard"
}
```

런타임에 `__dirname` 기준으로 dashboard 디렉토리를 찾는다:

```ts
const dashboardDir = path.join(__dirname, '../dashboard');
```

## package.json

```json
{
  "name": "page-dep-map",
  "version": "0.1.0",
  "bin": { "page-dep-map": "./dist/index.js" },
  "files": ["dist", "dashboard"],
  "dependencies": {
    "@page-dep-map/analyzer": "workspace:*",
    "@page-dep-map/shared": "workspace:*",
    "commander": "^12.0.0",
    "express": "^4.21.0",
    "open": "^10.0.0",
    "ora": "^8.0.0",
    "chalk": "^5.0.0"
  }
}
```

## 완료 기준

- [ ] `page-dep-map analyze ./sample` 로 JSON 생성 성공
- [ ] `page-dep-map serve ./output` 로 대시보드 브라우저 오픈
- [ ] `page-dep-map ./sample` 로 전체 파이프라인 동작
- [ ] 설정 파일 로딩 (최소 JSON, TS 파일)
- [ ] 포트 충돌 시 자동 대체
- [ ] `tsup` 빌드 성공
