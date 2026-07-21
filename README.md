# hablo-content

Hablo(스페인어 동사 학습 앱)의 콘텐츠 배포 저장소입니다.

- `manifest.json` — 현재 발행 버전 포인터 (앱이 시작 시 체크)
- `packs/` — 버전별 불변 콘텐츠 팩 (packId.version.json)
- `_headers` — Cloudflare Pages 캐시 정책

발행은 앱 저장소의 `npm run content:publish`로만 수행합니다.
