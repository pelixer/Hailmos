# Hailmos

집중하는 동안 행성 사이를 항해하는 아이폰용 타이머 웹앱.

홈의 빛줄기에서 출발해 집중 시간(10분 단위, 최대 3시간)과 항로를 고르면, 빛줄기가 그대로 휘어 출발 행성의 궤도가 되고 우주선이 안착한 뒤 항해가 시작됩니다. 집중이 끝나는 순간 목적지에 착륙합니다.

## 구조

| 경로 | 내용 |
| --- | --- |
| `public/` | 배포되는 앱 그대로 (빌드 단계 없음) |
| `public/index.html` | 화면 구성 · 스타일 |
| `public/app.js` | 흐름: 홈 → 타이머 시트 → 오프닝 → 집중 항해 → 착륙 |
| `public/engine.js` | 렌더 엔진: 홈 빛줄기(2D) · 3D 항해(오프닝·항로·행성·우주선) · 실 타이머 |
| `public/routes.js` | "우리의 거리" 시간표, 항로 목록, 행성 색 데이터 |
| `tools/build_app.py` | 디자인 원본에서 `public/`을 다시 만드는 스크립트 |

- 기록(다녀온 행성·항로)은 이 기기의 브라우저에만 저장됩니다 (`localStorage`).
- 앱을 벗어나 있는 동안에는 항해가 멈춥니다. 우주선을 끌어 항로에서 떼어 내도 멈춥니다.
- 주소 뒤에 `?demo`를 붙이면 항해 구간이 24초로 줄어 전체 흐름을 빠르게 볼 수 있습니다.

## 배포 (Cloudflare Workers · 정적 사이트)

`wrangler.toml`이 `public` 폴더를 그대로 정적 사이트로 올리도록 설정되어 있습니다. 빌드 단계는 없습니다.

- 대시보드에서 Git 저장소를 연결할 때: Build command는 비워 두고, Deploy command는 `npx wrangler deploy` 그대로 둡니다.
- 직접 올릴 때:

```bash
npx wrangler deploy
```

캐시와 보안 헤더는 `public/_headers`에 있습니다.

## 로컬에서 보기

```bash
python3 -m http.server 8080 --directory public
```
