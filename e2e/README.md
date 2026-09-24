# E2E 테스트 (Playwright)

BOARDROOM 2026 체험의 주요 경로를 실제 브라우저(Chromium, 1920×1080·1280×720 두 프로젝트)로
검증한다. `e2e/fixtures.ts`가 모든 spec에 공통 fixture를 제공하며, 각 파일은
`@playwright/test` 대신 `./fixtures`에서 `test`·`expect`를 가져온다.

## 실행법

```
npm run build && npx playwright test              # 전체 spec, 두 해상도
npx playwright test e2e/live.spec.ts               # 특정 파일만
npx playwright test -g "UNCAST"                     # 제목으로 필터
UPDATE_SCREENSHOTS=1 npx playwright test e2e/screenshots.spec.ts   # 문서용 캡처 갱신
```

`playwright.config.ts`가 mock board 서버(`MODEL_PROVIDER=mock`, 8787번, `/api/health`로
기동 확인)와 `npm run preview`(4173번, `/api`를 8787로 프록시)를 자동으로 함께 띄운다.
`live.spec.ts`를 제외한 나머지 spec은 모두 `?mode=scripted`로 이동해 이 서버를 무시하고
scripted 경로만 결정적으로 검증한다.

## 공통 fixture — 외부 요청 차단

`e2e/fixtures.ts`는 `page.route('**/*', ...)`로 모든 요청의 호스트를 검사해
`localhost`/`127.0.0.1` 밖으로 나가는 요청은 실제로 보내기 전에 `route.abort()`로 막고
URL을 기록한다. 각 테스트가 끝나면 기록된 외부 요청이 0건인지 자동으로 단언한다
(`toHaveLength(0)`). mock board 서버(`/api`, 8787→4173 프록시)는 같은 호스트이므로
그대로 통과한다. 개별 spec이 `page.route()`로 `/api/board/round`나 `/api/health` 같은
특정 경로만 따로 가로채도(live.spec.ts) Playwright는 나중에 등록한 route를 먼저 적용하므로
이 fixture와 충돌하지 않는다.

## 경로 목록

- `smoke.spec.ts` — 제목 렌더 확인.
- `flow-early.spec.ts` — 대기 화면부터 임원 의견까지, 준비 중 안건 선택 차단.
- `flow-full.spec.ts` — ATTRACT부터 RESULT까지 완주(추천 문구만 / 직접 입력만 두 경로),
  5석 결과 카드.
- `discuss.spec.ts` — 추천 문구 조합, 직접 입력만으로 의견 전달, 직접 수정 후 유지/재구성
  확인 UI.
- `reactions.spec.ts` — 누적 조건 충돌 재검사, 후속 질문에서 이전 조건 유지/해제.
- `operations.spec.ts` — 시계를 앞으로 돌려도 화면이 바뀌지 않음(타이머 없음, T50), 운영자
  새 체험 확인, 새로고침 시 새 세션, 최종 투표 중복 클릭 방지, 모델 연결 확인(mock 정보·
  실패 메시지), scripted로 새 체험(URL·배지).
- `live.spec.ts` — mock 서버로 live 완주, 임원 응답 실패 시 UNCAST·제한 안내, 서버 상태
  확인 실패 시 scripted 배지로 폴백.
- `assistant.spec.ts` — AI 비서실장 적용 기록, 패널 미사용 시 자동 정리 기록만 남는지,
  live 실시간 호출 기록.
- `a11y.spec.ts` — 키보드만으로 완주, prefers-reduced-motion, 200% 확대 상당 뷰포트.
- `viewport-fit.spec.ts` — 화면 맞춤 축소(T51): 설계 크기(1200×700)보다 조금 작은 뷰포트
  (1272×698, 실측 노트북 창 모드 사례)에서 조종석 배치를 축소 유지한 채 완주, 운영 메뉴·
  비서실장 드로어 위치, 1920×1080·1280×720에서는 축소 미적용(natural) 확인.
- `screenshots.spec.ts` — 선택·토론·투표·결과 화면 캡처(문서 증빙용).
