# PR 초안 — P0 완료 체크리스트

버전 1.0 · 2026-09-10 · 근거: CLAUDE_IMPLEMENTATION.md 7장 "P0 공통 흐름·안건②"(구현 지시서 1.5)

이 문서는 지시서 7장의 P0 완료 기준 항목마다 증빙(테스트 이름 또는 스크린샷 경로)을 붙인 체크리스트다. 실제 행사 장비·실제 모델 키로만 확인 가능해 아직 검증하지 못한 항목은 미체크로 남긴다. PR 생성은 오케스트레이터가 사용자 지시로 수행한다(T17 범위 아님).

## 체크리스트

- [x] P0 전체 흐름을 실제 브라우저에서 조작 가능. 추천 문구만으로 키보드 없이 완주, 직접 입력만으로도 완주 가능.
  - 증빙: `e2e/flow-full.spec.ts` — "추천 문구만으로 ATTRACT부터 RESULT까지 완주하고, 결과에 5석과 결론이 보인다", "추천 문구를 하나도 고르지 않고 직접 입력만으로 ATTRACT부터 RESULT까지 완주한다"

- [x] 추천 문구 복수 선택, 300자 제한, 편집 보존, 공백 방지, IME 조합 입력 확인.
  - 증빙: `e2e/discuss.spec.ts` — "문구 2개를 선택하면 textarea에 조합되고, 의견 전달로 다음 단계로 넘어간다", "직접 수정 후 체크를 바꾸면 유지/재구성 확인 UI가 뜨고, 유지를 고르면 입력을 보존한다"; `tests/components/DraftEditor.test.tsx` — "조합 중 Enter는 기본 동작을 막고, 조합이 끝난 뒤 Enter는 막지 않는다", "300자를 넘으면 글자 수 표시와 함께 하단 오류를 보여준다"; `tests/domain/draft.test.ts`

- [x] 최종 투표 이전에는 찬성/보류/반대 선택 버튼 없음. 토론에서 전달해도 ballot은 생성되지 않음.
  - 증빙: `e2e/flow-full.spec.ts`(DISCUSS 화면에서 `getByRole('button', { name: '찬성'|'보류'|'반대' })`가 0개임을 단언하는 구간); `tests/domain/session.test.ts` — SUBMIT_OPINION은 ballots를 만들지 않음(정상 완주 스펙)

- [x] 5명 각 1표, CFO·CAIO 1표, 고정된 동일 안건 ID. 표 선택 후 미확정 상태에서 만료 시 UNCAST.
  - 증빙: `tests/domain/voting.test.ts` — "허용 조건 조합 전수 (24개 × 참가자 4표)", "문서 대표 경로표 — v0.6 (12행)"; `e2e/operations.spec.ts` — "표만 선택하고 확정하지 않은 채 240초가 지나면 내 표가 UNCAST로 집계된다"

- [x] scripted의 가결·보류·부결·내 표 영향은 고정 테스트로 검증. live는 근거·역할·논거 반영·안건 동일성·응답 실패를 검수하며 고정 득표수를 요구하지 않음.
  - 증빙(scripted): `tests/domain/voting.test.ts`(대표 경로표 12행 전수)
  - 증빙(live, mock 제공자): `e2e/live.spec.ts` — "mock 서버가 떠 있으면 live로 완주하고 발언 카드·판단 근거를 보여준다", "한 임원이 응답하지 않으면 결과에 UNCAST와 제한 안내가 보인다"; `tests/server/round.test.ts` — "참가자 발언의 지시 문구는 meeting_record 데이터 블록 안에 격리되고, 검증을 통과한 응답만 채택된다"; `tests/server/vote.test.ts` — "고정된 motionId/motionHash를 각 임원에게 전달하고 그대로 돌아오면 채택한다"
  - 실제 Anthropic 키로의 득표·근거 실측은 **미실행**(docs/LIVE_EVAL.md, `docs/eval/`가 비어 있음)

- [x] 무입력 75초 안내·90초 복귀, 계속 버튼, RESULT 진입 후 타이머 재시작, 240초와 동시 만료 우선순위, 운영 버튼 클릭·초기화 확인 메뉴 확인.
  - 증빙: `e2e/operations.spec.ts` — "무입력 75초 안내에서 계속 체험을 누르면 세션이 유지된다", "무입력 90초가 지나면 대기 화면으로 복귀한다", "운영자 메뉴의 새 체험은 확인 후에만 세션을 초기화한다"; `tests/domain/clock.test.ts` — "RESULT에서도 무입력 90초가 지나면 다시 IDLE_RESET을 낸다", "같은 tick에 만료와 무입력이 동시에 성립하면 IDLE_RESET만 낸다"
- [ ] 전체화면 거부 처리 확인.
  - 사유: `src/components/parts/OperatorMenu.tsx`에 거부(catch)·미지원(`fullscreenEnabled`) 분기가 구현되어 있으나, Fullscreen API는 사용자 제스처가 있어야 동작해 자동 테스트로 재현하지 못했다. 자동 테스트 없음 — 현장 리허설 항목(README "현장 미검증 목록")

- [x] 시간 만료, AI timeout, 늦은 응답, 새 체험, 두 번 클릭에서 상태가 일관됨.
  - 증빙: `tests/domain/session.test.ts` — "안건이 고정되지 않은 채 만료되면 원안을 자동 고정하고 참가자는 UNCAST다"; `tests/services/orchestrator.test.ts` — "임원 표가 도착하지 않으면 8초 뒤 UNCAST로 채워 FINALIZE_RESULT를 반영한다", "세션 리셋 뒤 도착한 응답은 폐기하고 아무것도 반영하지 않는다"; `e2e/operations.spec.ts` — "운영자 메뉴의 새 체험은 확인 후에만 세션을 초기화한다", "최종 투표 확정을 빠르게 두 번 눌러도 표는 한 번만 반영된다", "새로고침하면 이전 진행 상황이 남지 않고 새 세션으로 시작한다"

- [x] 추가 AI 버튼을 전혀 누르지 않은 완주에서도 BRIEFING 요약 카드와 결과의 자동 정리 표시 기록이 있음. 자동 데모/추가 데모/실제 호출을 구분. 내 의견이 채택되지 않았는데 채택됐다고 쓰지 않음.
  - 증빙: `e2e/assistant.spec.ts` — "패널을 열지 않고 완주해도 결과에는 자료 자동 정리 기록만 남는다", "AI 비서실장을 열고 내 발언 정리를 적용하면, 결과에 사용 기록이 남는다", "live 모드에서 내 발언 정리가 실제로 서버를 호출하면 결과에 실시간 AI 호출 기록이 남는다"; `tests/domain/assistantLog.test.ts` — "scripted 결과는 \"실제 AI 사용\"을 언급하지 않는다", "live 결과는 실제 호출임을 덧붙인다", "DRAFT_REFINE은 applied:true일 때만 한 줄을 만든다(미적용 요청은 조용히 무시)"

- [ ] 현장 마우스·물리 키보드 한글 입력 및 오프라인 로컬 자산 검증을 완료하고 장비·OS·브라우저·미검증 항목을 기록.
  - 증빙(오프라인 로컬 자산 부분만): `bash scripts/offline-check.sh`(빌드 산출물을 `vite preview`로 기동해 외부 요청 차단 fixture로 scripted 스모크 실행, PASS)
  - 사유(미체크): 실제 행사 장비의 마우스·물리 키보드·한글 IME 리허설은 아직 하지 않았다. README "현장 미검증 목록" 참고

- [x] 1280×720에서 추천 문구 6개·300자 입력·최종 조건 4개를 실제 콘텐츠로 배치해 캡처. 아바타는 전 화면 비실사 아이콘/이니셜로 통일.
  - 증빙: `docs/screenshots/desktop-720/select.png`, `discuss.png`, `vote.png`, `result.png`; `e2e/screenshots.spec.ts` — "선택·토론·투표·결과를 실제 콘텐츠로 채운 상태로 캡처한다"

- [x] 1920×1080 및 1280×720에서 주요 CTA와 입력이 잘리지 않음. PC의 키보드 접근성과 200% 확대 대응은 유지.
  - 증빙: `docs/screenshots/desktop-1080/*.png`, `docs/screenshots/desktop-720/*.png`; `e2e/a11y.spec.ts` — "키보드만으로 추천 문구 경로를 완주해 결과 화면에 도달한다", "960×540 뷰포트(200% 확대 상당)에서 스크롤로 CTA에 도달할 수 있다", "prefers-reduced-motion에서는 화면 전환에 애니메이션이 남지 않는다"; 모든 E2E spec이 `desktop-1080`·`desktop-720` 두 프로젝트로 실행됨(`playwright.config.ts`)

- [x] PPT와 대비하여 네이비·시안·임원 카드·내 발언·최종 투표 화면의 시각적 일관성 확인. 최소 안건 선택/토론/투표/결과 스크린샷 저장.
  - 증빙: `docs/design/tokens.css`(네이비·시안 색상 토큰) 적용, `docs/screenshots/desktop-1080/`·`docs/screenshots/desktop-720/`(선택·토론·투표·결과 4장 × 2해상도)
  - 참고: 목업 수준 시각 완성도(그라디언트·조명감 등)는 T33(디자인 마감, P0 PR 이후)에서 별도로 보강한다(`docs/TASKS.md` T33)

- [x] README에 설치·개발·빌드·테스트 방법, 데모/실제 AI 차이, 완료 범위와 미구현 항목 작성.
  - 증빙: `README.md`의 "설치"·"개발"·"빌드"·"테스트"·"오프라인 실행 확인"·"데모(scripted)와 실제 AI(live) 차이"·"완료 범위 (P0)"·"미구현 (P1 · P2)"·"현장 미검증 목록" 절

## 요약

- 자동 테스트로 확인한 항목: 11 / 13
- 실제 행사 장비·실제 모델 키가 있어야 확인 가능해 미체크로 남긴 항목: 전체화면 거부 처리(사용자 제스처 필요), 현장 마우스·물리 키보드·한글 IME 리허설(오프라인 로컬 자산 자체는 확인 완료)
- 단위 테스트 203개, E2E 27개 spec × 2 해상도(54개) 모두 통과(`npm run check`, `npm run build && npx playwright test`)
