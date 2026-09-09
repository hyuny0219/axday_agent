# 작업 카드 — BOARDROOM 2026

버전 1.0 · 2026-09-09 · 기준: docs/DEV_PLAN.md, 구현 지시서 1.4, 시나리오 ② 1.1

각 카드는 builder 한 번의 실행 단위다. builder·reviewer는 자기 카드만 `awk '/^## T04 /{p=1;print;next} /^## T[0-9][0-9] /{p=0} p' docs/TASKS.md`로 읽는다. 카드 형식: 목표 / 읽을 것 / 만들 것 / 허용 경로 / 하지 말 것 / 완료 확인 / 크기.

공통 전제: Node 22, npm. 저장소 루트에 앱. 모든 화면 문구는 한국어, 식별자는 영어. 런타임 네트워크 요청 없음.

## 진행 상황

| 작업 | 상태 | 비고 |
| --- | --- | --- |
| T01~T02 | 완료 | M0 스캐폴드·기반. 각 1라운드 PASS, 커밋 e61e907·c7dfa90 |
| T03~T07 | 완료 | M1 엔진. T06만 수정 1라운드(reducer 순수성), 나머지 1라운드 PASS. 단위 테스트 83개 |
| T08~T17 | 대기 | P0 |
| T18~T22 | 대기 | P1, P0 PR 이후 카드 상세화 |
| T23~T24 | 대기 | P2, 네트워크·모델 확정 후 |

---

## T01 스캐폴드

- 목표: Vite + React 18 + TypeScript(strict) 앱과 검사 스크립트를 만든다.
- 읽을 것: docs/DEV_PLAN.md 2절(기술 결정)과 3절(구조)만.
- 만들 것: `package.json`(scripts: dev, build, preview, lint, typecheck, test, check=lint+typecheck+test), `vite.config.ts`, `tsconfig.json`(strict), ESLint flat config(typescript-eslint, react-hooks), Prettier 설정, Vitest 설정, `.gitignore`, `src/main.tsx`, `src/app/App.tsx`("BOARDROOM 2026" 제목만), `tests/smoke.test.ts`(1개), `package-lock.json` 커밋.
- 허용 경로: 루트 설정 파일, `src/`, `tests/`.
- 하지 말 것: 폰트·토큰·Playwright·CI(T02). UI 라이브러리 추가 금지.
- 완료 확인: `npm ci && npm run check && npm run build` 성공. `dist/`가 `.gitignore`에 있음.
- 크기: S.

## T02 토큰·폰트·E2E 기반·CI

- 목표: 디자인 토큰, 로컬 폰트, Playwright 두 해상도, GitHub Actions를 붙인다.
- 읽을 것: `docs/design/tokens.css`, docs/design/DESIGN_SPEC.md 2절(디자인 토큰) 폰트 문단, docs/DEV_PLAN.md 2절.
- 만들 것: `src/styles/tokens.css`(원본 복사), `src/styles/base.css`(배경·본문색·`--font-ui` 적용), `@fontsource/noto-sans-kr` 400·700 설치와 `main.tsx` import, `playwright.config.ts`(projects: `desktop-1080` 1920×1080, `desktop-720` 1280×720, Chromium만, `webServer`로 `vite preview`), `e2e/smoke.spec.ts`(제목 렌더 확인), `.github/workflows/ci.yml`(npm ci → check → build → e2e), README에 실행 명령 4줄.
- 허용 경로: `src/styles/`, `src/main.tsx`, `e2e/`, `playwright.config.ts`, `.github/`, `README.md`, `package.json`.
- 하지 말 것: 화면 구현. 외부 URL 폰트.
- 완료 확인: `npm run build && npx playwright test` 성공. `grep -rl "https://" dist/assets/*.css dist/assets/*.js | wc -l`이 0(라이선스 주석 제외는 `grep -v "@license"`로 확인). `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` 환경에서 브라우저 재다운로드 없음.
- 크기: S.

## T03 시나리오 타입과 안건 ② 데이터

- 목표: 시나리오 데이터 스키마를 정의하고 안건 ②를 문서 그대로 옮긴다.
- 읽을 것: docs/SCENARIO_AI_ASSISTANT.md 전체, docs/DEV_PLAN.md 4절(핵심 설계 결정).
- 만들 것: `src/content/types.ts` — `Scenario { id, title, selectLine, subtitle, originalMotion{id,text}, evidence: EvidenceCard[4], briefingSummary{text, evidenceIds}, chairLine, initialOpinions: {memberId, text, evidenceIds}[], phrases: {id,text,conditionId|null,tag?}[], conditions: {id,label}[], conflicts: [id,id][], reactions: {conditionId|'none', memberId, text}[], followUp: {question, options: {text, proposeConditionId|null, keepPrevious?}[]}, voteRules: Record<ExecMemberId, {when: Predicate, vote: Vote}[]>, resultCopy: {pass,hold,reject}, remainingTasks: string[], baseConditionIds: string[], status:'active'|'preparing' }`. `Predicate` = `{has:string}|{all:Predicate[]}|{any:Predicate[]}|{not:Predicate}|{mode:string}|{always:true}`. `src/content/scenarios/aiAssistant.ts`(문서의 표를 그대로, 규칙은 문서 순서대로), `src/content/scenarios/index.ts`(② active, ①③ preparing 자리표시), `tests/content/aiAssistant.test.ts`(참조 ID 존재, 각 임원 규칙의 마지막이 `always`, 충돌쌍의 ID 존재, 문구 6개·자료 4개).
- 허용 경로: `src/content/`, `tests/content/`.
- 하지 말 것: 평가기 구현(T04). 문구·대사 의역 금지, 문서 문장 그대로.
- 완료 확인: `npm run check` 성공. 테스트가 규칙 행 수(CEO 2, CFO 3, CIO 3, CISO 4)를 검사.
- 크기: M.

## T04 표결 평가기와 집계

- 목표: 우선순위 규칙 평가기와 5석 집계를 만들고 문서 경로 전수를 테스트한다.
- 읽을 것: `src/content/types.ts`, docs/SCENARIO_AI_ASSISTANT.md의 "가상 임원 표결 규칙"과 "대표 경로" 절만(`sed -n '/^## 가상 임원 표결 규칙/,/^## 결과와/p'`), 구현 지시서 6장 마지막 두 문단(집계·차단 규칙).
- 만들 것: `src/domain/voting.ts` — `evalPredicate(p, ctx:{conditionIds:string[], executionMode:string})`, `decideMember(rules, ctx)`(첫 일치 행, 없으면 throw), `decideBoard(scenario, motion)`(임원 4명 Ballot), `tally(ballots)`(YES≥3 PASS, NO≥3 REJECT, 그 외 HOLD; counts에 UNCAST 별도; 의석 5 아니면 throw), `castParticipant(ballots, motionId, vote)`(motionId 불일치·중복 의석·확정 후 재투표 거부). `tests/domain/voting.test.ts` — (1) ② 허용 조합 24개 × 참가자 4표 전수: 규칙 총괄성, 5석, 세 결론 도달, OPEN_ALL이면 항상 REJECT, 네 임원 각각 YES 행 존재; (2) 문서 대표 경로표를 표 데이터로 옮겨 행마다 임원 표와 결론이 일치; (3) 차단 규칙.
- 허용 경로: `src/domain/voting.ts`, `tests/domain/`.
- 하지 말 것: 세션·UI. Motion 타입은 지시서 6장 인터페이스를 `src/domain/types.ts`에 그대로 두되 이 카드에서는 타입만 추가.
- 완료 확인: `npm run check` 성공. 대표 경로 테스트 케이스 수가 문서 행 수(12)와 같음.
- 크기: M.

## T05 초안과 조건 제안

- 목표: 추천 문구·직접 입력 편집 규칙과 조건 제안·충돌·확정 흐름을 순수 함수로 만든다.
- 읽을 것: 구현 지시서 4장 전체(`sed -n '/^## 4\. /,/^## 5\. /p' CLAUDE_IMPLEMENTATION.md`), `src/content/types.ts`.
- 만들 것: `src/domain/draft.ts` — `DraftState { selectedPhraseIds, draftText, dirty }`, `togglePhrase`(dirty가 아니면 draft 재구성, dirty면 `needsConfirm` 반환), `resolveConfirm('keep'|'rebuild')`, `editText`(300자 절단 없이 초과 여부 반환, dirty=true), `isSubmittable`(공백만이면 false, 300자 초과면 false). `src/domain/conditions.ts` — `proposeFromPhrases(scenario, ids)`, `proposeFromText(scenario, text)`(조건 라벨 키워드 기반 **제안만**, 부정어 "없이·생략·말고" 근처는 제안하지 않음), `findConflicts(scenario, ids)`, `confirmConditions(scenario, proposedIds, acceptedIds)`(충돌쌍 동시 확정 거부, 결과 `{status:'proposed'|'confirmed'}[]`). `tests/domain/draft.test.ts`, `tests/domain/conditions.test.ts`(문서 예: "검토 없이 공유"에서 REVIEW를 제안하지 않음).
- 허용 경로: `src/domain/draft.ts`, `src/domain/conditions.ts`, `tests/domain/`.
- 하지 말 것: React·IME 이벤트(T09). 키워드 사전을 시나리오 데이터 밖에 하드코딩하지 않음(조건 라벨과 문구 텍스트에서 파생).
- 완료 확인: `npm run check` 성공.
- 크기: M.

## T06 최종 안건 고정과 세션 reducer

- 목표: Motion 고정과 상태 전이를 순수 reducer로 만든다.
- 읽을 것: 구현 지시서 3장 상태표와 "시간 만료·리셋" 절, 6장(`sed -n '/^## 6\. /,/^## 7\. /p'`), `src/domain/voting.ts` 공개 함수 시그니처, `src/domain/conditions.ts` 시그니처.
- 만들 것: `src/domain/types.ts`에 `Session`(stage, sessionId, scenarioId, startedAt, deadline, lastActivityAt, draft, opinions, followUpUsed, assistantActions, finalMotion, ballots, outcome, expiredWithoutMotion). `src/domain/motion.ts` — `freezeMotion(scenario, confirmedIds, now)`: kind는 확정 조건이 원안과 의미 차이가 있을 때만 amended, `baseConditionIds=[]`, `effectiveConditionIds=[...ids]`, `executionMode='DEFAULT'`, 배열 복사; `freezeOriginal(scenario, now)`. `src/domain/session.ts` — 액션: START, SELECT_SCENARIO, NEXT_STAGE, SUBMIT_OPINION, SUBMIT_FOLLOWUP, KEEP_PREVIOUS, FREEZE_MOTION, SELECT_VOTE, CONFIRM_VOTE, EXPIRE, IDLE_RESET, OPERATOR_RESET, MARK_SUMMARY_SHOWN, RECORD_ASSISTANT_ACTION; `reduce(session, action, now)` 순수; 잘못된 단계의 액션은 무시하고 `warnings`에 기록; CONFIRM_VOTE는 finalMotion 없으면 거부, 두 번째 CONFIRM 무시; EXPIRE는 finalMotion 없으면 freezeOriginal 후 참가자 UNCAST로 집계, `expiredWithoutMotion=true`; RESET은 새 sessionId. `tests/domain/session.test.ts` — 정상 완주, 후속 1회 제한, 만료(안건 있음/없음), 이중 확정, 리셋 후 이전 값 없음, 단계 밖 액션 무시.
- 허용 경로: `src/domain/types.ts`, `src/domain/motion.ts`, `src/domain/session.ts`, `tests/domain/`.
- 하지 말 것: 시계·무입력 판정(T07), React.
- 완료 확인: `npm run check` 성공.
- 크기: M.

## T07 시계·만료·무입력

- 목표: 주입형 시계로 240초 만료와 75/90초 무입력 규칙을 결정적으로 구현한다.
- 읽을 것: 구현 지시서 3장 "시간 만료·리셋"과 "현장 운영" 절(`sed -n '/^### 시간 만료/,/^### P1 관람 뷰/p'`), `src/domain/session.ts` 액션 목록.
- 만들 것: `src/domain/clock.ts` — `Clock { now(): number }`, `systemClock`, `fakeClock(start)`(advance), 상수 `EXPERIENCE_MS=240000, WARN_60, WARN_30, IDLE_WARN_MS=75000, IDLE_RESET_MS=90000`; `remaining(session, now)`; `idleState(session, now)` → 'active'|'warn'|'reset'; `tick(session, now)` → 액션 배열(같은 tick에 둘 다면 IDLE_RESET만; 이미 RESULT면 EXPIRE 없음; RESULT 진입 시 lastActivityAt 재설정은 reducer가 담당); `touch(session, now)`(클릭·키·스크롤만 호출). `src/app/useTicker.ts`(250ms 간격으로 `tick`을 dispatch하는 훅, 시계는 props로 주입). `tests/domain/clock.test.ts` — 60·30초 경계, 75초 warn, 90초 reset, 240초 expire, 동시 만료 우선순위, RESULT에서 idle 재시작, `touch`가 deadline을 늘리지 않음.
- 허용 경로: `src/domain/clock.ts`, `src/app/useTicker.ts`, `tests/domain/`.
- 하지 말 것: 화면 표시. `setInterval` 카운트로 시간 계산.
- 완료 확인: `npm run check` 성공.
- 크기: S.

## T08 화면 1: 대기·선택·브리핑·임원 의견

- 목표: 앱 골격과 앞 네 화면을 최소 스타일로 만든다.
- 읽을 것: 구현 지시서 3장 상태표(ATTRACT~OPINIONS 행), 5장 첫 문단(상시 정리 카드), docs/design/DESIGN_SPEC.md 3장 표의 해당 4행, `src/domain/session.ts`, `src/content/scenarios/index.ts`.
- 만들 것: `src/app/App.tsx`(SessionProvider: useReducer + systemClock + useTicker, stage별 화면 라우팅), `src/components/parts/Header.tsx`(BOARDROOM 2026 · 단계명 · 남은 시간 자리), `Nameplate.tsx`(나 · 특별 이사), `screens/AttractScreen`(제목, 부제, "사전 구성 시뮬레이션" 표기, 체험 시작), `SelectScreen`(카드 3장, ①③은 disabled + '준비 중' 문구, 선택 강조, 이사회 입장 → SELECT_SCENARIO+START), `BriefingScreen`(안건, 의장 발언, 자료 4장, 옆에 AI 정리 카드 "체험용 사전 구성"+근거 ID; 마운트 시 한 번 MARK_SUMMARY_SHOWN), `OpinionsScreen`(임원 4카드 한 줄 의견, 펼치면 근거). 각 화면에 다음 버튼. `e2e/flow-early.spec.ts`(대기→임원 의견 도달, 준비 중 카드 클릭 불가).
- 허용 경로: `src/app/`, `src/components/`, `src/styles/screens/`, `e2e/`.
- 하지 말 것: 토론·투표 화면(T09·T10), 디자인 마감(T14).
- 완료 확인: `npm run check && npx playwright test flow-early` 성공.
- 크기: M.

## T09 화면 2: 의견 작성

- 목표: 추천 문구·직접 입력·조건 칩·의견 전달 화면을 만든다.
- 읽을 것: 구현 지시서 4장, docs/design/DESIGN_SPEC.md 4장 "의견 체크 카드"·"textarea" 항목, `src/domain/draft.ts`, `src/domain/conditions.ts`.
- 만들 것: `screens/DiscussScreen`, `parts/PhraseCard`(체크박스, 선택 시 시안 테두리+체크, "찬성" 표기 금지), `parts/DraftEditor`(textarea, placeholder 문서 문구, 글자 수 표시, 300자 초과 시 하단 오류, compositionstart/compositionend 추적, 조합 중 Enter 무시, Enter로 제출하지 않음), `parts/RebuildConfirm`(직접 쓴 내용 유지 / 선택 문구로 다시 구성, 기본 유지), `parts/ConditionChips`(제안 조건 칩 토글, 충돌 시 둘 중 하나 선택 안내, 해석 불가 시 안내 문구), 의견 전달 버튼(공백·초과 시 비활성, 사유 텍스트 유지) → SUBMIT_OPINION. `tests/components/DraftEditor.test.tsx`(Testing Library: 조합 중 Enter 무시, 300자 표시). `e2e/discuss.spec.ts`(문구 2개 선택 후 전달, 직접 입력만으로 전달, 수정 후 체크 변경 시 확인 UI).
- 허용 경로: `src/components/`, `src/styles/screens/`, `tests/components/`, `e2e/`, `package.json`(Testing Library 추가).
- 하지 말 것: AI 패널(T12), 반응 화면(T10).
- 완료 확인: `npm run check && npx playwright test discuss` 성공.
- 크기: M.

## T10 화면 3: 반응·최종 안건·투표·결과

- 목표: 나머지 네 화면을 만들어 완주 가능하게 한다.
- 읽을 것: 구현 지시서 3장 상태표(REACTIONS~RESULT 행), docs/SCENARIO_AI_ASSISTANT.md "첫 반응 및 후속 질문"·"결과와 AI 효율 체험" 절, DESIGN_SPEC 3장 해당 4행과 4장 "최종 투표 radio".
- 만들 것: `screens/ReactionsScreen`(내 발언 인용, 확정 조건별 관련 임원 반응, 나머지 임원은 기존 의견 유지 표시, 후속 질문 1회: 선택지 버튼 + 직접 입력 + '앞선 의견 유지'; 두 번째 후속 없음), `screens/MotionScreen`(원안 문장, 확정 조건 목록, 남은 확인 사항, '이 안건으로 표결' → FREEZE_MOTION), `screens/VoteScreen`(안건 카드, 찬성/보류/반대 radio 초기 미선택, '최종 투표 확정'은 선택 전 비활성, 클릭 즉시 비활성화로 이중 확정 방지 → CONFIRM_VOTE), `screens/ResultScreen`(결론 제목 = resultCopy, 같은 크기 5석 카드에 표 상태 색+텍스트, 내 원문과 실제 포함된 조건만 "반영"으로 표시, 남은 과제, 'AI가 도운 일' 자리(T12에서 채움), '체험 종료' → OPERATOR_RESET 없이 ATTRACT 복귀+세션 초기화). `e2e/flow-full.spec.ts`(추천 문구만으로 완주, 결과 5석·결론 표시).
- 허용 경로: `src/components/`, `src/styles/screens/`, `e2e/`.
- 하지 말 것: 타이머 표시·운영 메뉴(T11).
- 완료 확인: `npm run check && npx playwright test flow-full` 성공. 토론 화면 어디에도 찬성/보류/반대 버튼이 없음(E2E에서 확인).
- 크기: M.

## T11 운영 규칙 연결

- 목표: 타이머 표시, 무입력 안내·복귀, 운영 메뉴, 전체화면, 늦은 응답 폐기를 연결한다.
- 읽을 것: 구현 지시서 3장 "시간 만료·리셋"·"현장 운영" 절, DESIGN_SPEC 4장 "타이머" 항목, `src/domain/clock.ts`, `src/app/useTicker.ts`.
- 만들 것: `parts/Timer`(mm:ss, 60·30초 짧은 안내, 30초 이하 앰버, 점멸 없음), `parts/IdleNotice`(75초: "15초 뒤 처음 화면으로 돌아갑니다" + '계속 체험'), 활동 감지(click, keydown, wheel/scroll만 `touch`; mousemove 제외), 만료 시 RESULT로 이동하며 원안 자동 고정 안내 문구 표시, `parts/OperatorMenu`(우측 상단 작은 '운영' 버튼 → 새 체험(확인 대화상자), 전체화면 진입/종료(Fullscreen API, 미지원·거부 시 안내와 닫기), 닫기), `src/app/requests.ts`(sessionId·requestId 레지스트리, 리셋 시 전부 abort, 늦은 응답 무시). 테스트용 시계 훅: URL `?testClock=1`일 때 `window.__boardroom.advance(ms)` 노출(프로덕션 빌드에서도 파라미터 없으면 비활성). `e2e/operations.spec.ts`(만료→결과에 안내 문구, 75초 안내→계속, 90초→대기 화면, 새 체험 확인, 두 번 클릭 이중 확정 없음).
- 허용 경로: `src/app/`, `src/components/`, `src/styles/`, `e2e/`.
- 하지 말 것: 관람 창 열기(P1).
- 완료 확인: `npm run check && npx playwright test operations` 성공.
- 크기: M.

## T12 AI 비서실장(사전 구성)

- 목표: 어댑터 인터페이스, 사전 구성 구현, 사이드 패널, 결과의 'AI가 도운 일'을 만든다.
- 읽을 것: 구현 지시서 5장 전체(`sed -n '/^## 5\. /,/^## 6\. /p'`), docs/SCENARIO_AI_ASSISTANT.md "AI 도움 예시" 문단과 "결과와 AI 효율 체험" 절, `src/app/requests.ts`.
- 만들 것: `src/services/assistant/types.ts`(`AssistantAdapter { summarizeOpinions(req), compareConditions(req), refineDraft(req) }`, req에 sessionId·requestId·signal, 응답에 mode 'scripted'|'live'와 evidenceIds), `scripted.ts`(시나리오 데이터에서 즉시 생성, 200ms 지연, refineDraft는 원문의 부정·유보 표현을 유지한 300자 이내 정리), `src/domain/assistantLog.ts`(AssistantAction 기록: type, mode, evidenceIds, shownAt|requestedAt, applied), `parts/AssistantPanel`(DISCUSS·REACTIONS에서 열기, '닫기' 항상 표시, 세 기능 버튼, 결과에 근거 ID, '내 발언에 적용'은 클릭 시에만 draft 교체, 5초 timeout·오류 시 "기본 안내로 전환했습니다"), 패널 제목 'AI 비서실장(시연)', ResultScreen의 'AI가 도운 일'(항상 "자료 4장 자동 정리 데모 표시" + 사용 기록 또는 "추가 AI 도움은 사용하지 않았습니다"). `tests/services/scripted.test.ts`(리셋 후 도착한 응답 무시, timeout 폴백, refine이 "않" "없이" 같은 부정 표현을 삭제하지 않음). `e2e/assistant.spec.ts`(패널 열고 적용, 안 열고 완주해도 결과에 자동 정리 기록).
- 허용 경로: `src/services/assistant/`, `src/domain/assistantLog.ts`, `src/components/`, `tests/services/`, `e2e/`.
- 하지 말 것: 실제 모델 호출(P2), 절감률 등 수치 생성.
- 완료 확인: `npm run check && npx playwright test assistant` 성공.
- 크기: M.

## T13 공개 payload selector와 전송 인터페이스

- 목표: 관람 뷰가 받을 수 있는 데이터를 P0에서 함수와 테스트로 고정한다.
- 읽을 것: 구현 지시서 3장 "P1 관람 뷰" 절의 payload 문단 두 개만(`grep -n "공개 payload" CLAUDE_IMPLEMENTATION.md`로 위치 확인 후 그 문단), `src/domain/types.ts`.
- 만들 것: `src/domain/publicPayload.ts` — `selectPublic(session, scenario, revision)` → `{ sessionId, revision, stage, scenarioTitle, memberOpinionIds, reactionIds, confirmedConditionLabels(MOTION 고정 이후에만), tally+outcome(RESULT에서만), participantStatus:'discussing'|'voting'|'done' }`. `src/services/transport/types.ts`(`Transport { publish(payload), subscribe(cb), close() }`), `noop.ts`. `tests/domain/publicPayload.test.ts` — 직렬화된 JSON 전체를 깊이 탐색해 originalText·draftText·AI 초안·미확정 표 값(SELECT_VOTE만 한 상태)이 어느 필드에도 없음; RESULT 전에는 tally 없음.
- 허용 경로: `src/domain/publicPayload.ts`, `src/services/transport/`, `tests/domain/`.
- 하지 말 것: BroadcastChannel 구현, 관람 화면(P1).
- 완료 확인: `npm run check` 성공.
- 크기: S.

## T14 디자인 1: 레이아웃·카드·아바타

- 목표: 두 해상도 레이아웃과 카드·아바타·CTA를 디자인 명세대로 입힌다.
- 읽을 것: docs/design/DESIGN_SPEC.md 2장·3장·6장·8장(비실사 아바타 문단), 참조 이미지는 `docs/design/assets/opinion-compose.png`와 `final-vote.png` 두 장만.
- 만들 것: `src/styles/`에 화면별 CSS, 임원 4열 카드(1280에서 접힌 한 줄 요약), 내 좌석 정체성, 이니셜·아이콘 아바타(CSS만), 안건 카드 3열, 최종 투표 3열 radio + 별도 확정 CTA, 결과 5석 동일 크기, sticky footer CTA, 타이포 크기(1920: 제목 40–48, 본문 24–28; 1280: 32/20), 간격 8px 배수, 최소 클릭 영역 56px. `e2e/screenshots.spec.ts`(두 프로젝트에서 선택·토론·투표·결과 4장을 `docs/screenshots/<project>/<screen>.png`로 저장, 추천 문구 6개·300자 입력·조건 4개를 실제 콘텐츠로 배치한 상태).
- 허용 경로: `src/styles/`, `src/components/`(className·구조 변경만), `e2e/`, `docs/screenshots/`.
- 하지 말 것: 동작 변경. 이미지 속 슬로건 문구 복제. 실사 아바타.
- 완료 확인: `npx playwright test screenshots` 성공, 8장 생성. 1280×720에서 CTA·입력이 잘리지 않음(스크린샷으로 reviewer가 확인).
- 크기: M.

## T15 디자인 2: 모션·접근성·확대

- 목표: 전환 모션, reduced-motion, 키보드 접근성, 200% 확대, 상태 색+텍스트를 마감한다.
- 읽을 것: docs/design/DESIGN_SPEC.md 4장 전체.
- 만들 것: 화면 전환 180–250ms opacity/translate, 선택 120ms, 임원 발언 glow 1회, `prefers-reduced-motion`에서 이동·빛 제거, `:focus-visible` 스타일, 모든 버튼 Tab·Enter 조작, radio 방향키, 타이머 앰버, 반대·보류·미표결은 색+텍스트+아이콘, 200% 확대(뷰포트 960×540 상당)에서 세로 재배치·스크롤 허용. `e2e/a11y.spec.ts`(키보드만으로 추천 문구 경로 완주, reduced-motion 에뮬레이션에서 transition 없음, 960×540 뷰포트에서 CTA 도달).
- 허용 경로: `src/styles/`, `src/components/`, `e2e/`.
- 하지 말 것: 레이아웃 재설계.
- 완료 확인: `npx playwright test a11y` 성공.
- 크기: S.

## T16 E2E 전체와 외부 요청 차단

- 목표: 완료 기준의 E2E 경로를 모두 갖추고 외부 요청이 없음을 자동 검증한다.
- 읽을 것: 구현 지시서 7장 "P0 공통 흐름·안건②" 목록, 기존 `e2e/*.spec.ts` 파일 이름과 describe 제목만.
- 만들 것: 누락 경로 보강 — 직접 입력만으로 완주, 후속 질문 보완 후 조건 유지/해제, 표 선택만 하고 만료 시 UNCAST, 새로고침 시 새 세션. `e2e/fixtures.ts`에 공통 fixture: 모든 non-localhost 요청을 `route.abort()`하고 발생 목록을 기록해 테스트 종료 시 0건 단언. 모든 spec이 fixture 사용. `e2e/README.md`(경로 목록과 실행법).
- 허용 경로: `e2e/`, `playwright.config.ts`.
- 하지 말 것: 앱 코드 변경(버그 발견 시 findings로 보고).
- 완료 확인: `npx playwright test` 전체 성공, 외부 요청 0건.
- 크기: S.

## T17 오프라인 검증·README·PR 초안

- 목표: 오프라인 실행을 확인하고 README와 PR 본문 초안을 완성한다.
- 읽을 것: 구현 지시서 7장 P0 목록, 기존 README.md, docs/DEV_PLAN.md 7절.
- 만들 것: `scripts/offline-check.sh`(빌드 후 `vite preview`를 띄우고 외부 차단 fixture로 E2E 스모크 실행), README 절: 설치·개발·빌드·테스트·오프라인 실행·데모/실제 AI 차이·완료 범위·미구현(P1·P2)·현장 미검증 목록(한글 IME 실기기, 전체화면 진입, 실제 모니터 가독성). `docs/PR_P0.md`: 지시서 7장 P0 항목을 체크리스트로, 항목마다 증빙(테스트 이름 또는 스크린샷 경로), 미검증 항목은 미체크로 남김. docs/TASKS.md "진행 상황" 표 갱신.
- 허용 경로: `scripts/`, `README.md`, `docs/PR_P0.md`, `docs/TASKS.md`.
- 하지 말 것: PR 생성(오케스트레이터가 사용자 지시로 수행).
- 완료 확인: `bash scripts/offline-check.sh` 성공. PR 초안의 체크 항목이 모두 증빙을 가짐.
- 크기: S.

---

## T18 안건 ① 데이터·테스트 (P1)

- 목표: docs/SCENARIO_CUSTOMER_SUPPORT.md를 데이터로 옮기고 전수·대표 경로 테스트를 추가한다. SELECT 카드 활성.
- 크기: M. 상세 카드는 P0 PR 이후 작성.

## T19 안건 ③ 데이터·정규화·테스트 (P1)

- 목표: docs/SCENARIO_PREVENTION.md를 데이터로 옮기고 `normalize()`(기본 조건 병합, DROP_CONSENT 삭제, executionMode)를 추가. 128개 조합 전수, 원안 승인 경로, 반대 부결 불가 확인.
- 크기: M.

## T20 관람 뷰 (P1)

- 목표: `?view=spectator`, BroadcastChannel 전송 어댑터, heartbeat 2초·끊김 5초, revision·reset, 운영 메뉴 '관람 창 열기'(window.open 이름 재사용), 관람 창 전체화면 버튼, 팝업 차단 안내.
- 크기: M. 두 카드(전송 / 화면)로 나눌 수 있음.

## T21 ③ 꼬리표·안건 종류 표시 (P1)

- 목표: 추천 카드 꼬리표(제안 유형), MOTION·RESULT 안건 종류 표시, P1+P4 → 검증안 표시.
- 크기: S.

## T22 P1 E2E·README·PR 초안 (P1)

- 크기: S.

## T23 서버 어댑터 (P2)

- 목표: `/api/refine` Node 서버, 환경변수 키, 스키마 검증, 5초 timeout. 네트워크·모델 확정 후 카드 작성.
- 크기: M.

## T24 클라이언트 live 연결·플래그 (P2)

- 목표: refineDraft만 live, 실패 시 원문 유지, live/scripted 기록, 네트워크 없으면 전부 scripted.
- 크기: S.
