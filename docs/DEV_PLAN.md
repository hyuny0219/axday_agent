# BOARDROOM 2026 — 개발 계획

버전 1.1 · 2026-09-10 · 기준 문서: 기획서 v0.8, 구현 지시서 1.5, docs/AGENT_BOARDROOM_SPEC.md, 시나리오 ① 1.1 / ② 1.1 / ③ 2.1, 디자인 명세, 진행 요원 가이드

> v0.8(2026-09-10)로 P0 목표가 바뀌었다. 임원 4명은 실제 AI 에이전트(live)로 판단·토론·표결하고, '내 발언 정리'도 실제 AI가 한다. 지금까지 만든 규칙 엔진은 명시적 scripted 모드로 유지한다. 변경 내용과 추가 작업은 11절에 있다.

## 1. 목표와 범위

지시서 2장의 구현 순서를 그대로 따른다.

| 단계 | 범위 | 이 계획에서의 위치 |
| --- | --- | --- |
| P0 | 안건 ② 완주 프로토타입. 추천 문구·직접 입력·반응·사전 구성 AI 도움·최종 투표·시간 만료·무입력 복귀·운영 메뉴·전체화면·오프라인 자산 | M0~M6, 첫 PR |
| P1 | 안건 ①·③ 콘텐츠, ③ 실행 방식 정규화, 관람 뷰, 꼬리표·MOTION 안건 종류 표시 | M7~M9, 두 번째 PR |
| P2 | '내 발언 정리'만 실제 모델 연결, 서버 어댑터, live/scripted 기록 | M10, 네트워크·모델 확정 후 |

P0에서 하지 않는 것: 관람 창과 전송 프로토콜 구현, ③ 전용 정규화, 실제 AI 호출, 서기 모드 전용 UI, 프린터 출력, 모바일·터치 대응. 단, P1이 그대로 쓸 수 있도록 공개 payload selector 순수 함수와 전송 어댑터 인터페이스는 P0에서 정의한다.

## 2. 기술 결정

| 항목 | 결정 | 이유 |
| --- | --- | --- |
| 앱 위치 | 저장소 루트에 `package.json`, `src/`, `public/`, `tests/`, `e2e/` | 문서와 앱이 한 저장소, 단일 앱이므로 하위 폴더 분리 불필요 |
| 프레임워크 | Vite + React 18 + TypeScript(strict) | 지시서 기본안. 정적 빌드로 오프라인 로컬 서버 실행 가능 |
| 상태 관리 | 외부 라이브러리 없음. `domain/`의 순수 reducer + React `useReducer`/Context | 표결·조건·타이머 규칙을 UI와 분리해 단위 테스트 가능하게 함. 지시서 6장 "UI 컴포넌트에 표결 규칙을 넣지 않는다" |
| 스타일 | 일반 CSS + CSS 변수. `docs/design/tokens.css`를 `src/styles/tokens.css`로 복사해 단일 출처로 사용 | Tailwind 등 CDN·빌드 의존 최소화. 디자인 토큰이 이미 정의됨 |
| 폰트 | `@fontsource/noto-sans-kr`(OFL) npm 패키지로 로컬 번들 | 지시서 3장 "폰트를 라이선스와 함께 로컬 번들". CDN 불필요 |
| 단위 테스트 | Vitest | Vite와 동일 설정 공유 |
| E2E 테스트 | Playwright(Chromium), 1920×1080·1280×720 두 프로젝트 | 지시서 7장 해상도 완료 기준. 스크린샷 산출물도 여기서 생성 |
| 린트·포맷 | ESLint(typescript-eslint, react-hooks) + Prettier | CI에서 실패 조건으로 사용 |
| CI | GitHub Actions: lint → unit → build → e2e | PR마다 자동 실행. 오프라인 빌드 검증 포함 |
| 시간 | `now()`를 주입하는 Clock 인터페이스. deadline 절대 시각 기반 | 지시서 "렌더링 횟수나 setInterval 감소로 시간 계산 금지". 테스트에서 가짜 시계 사용 |
| 서버 | P0·P1은 서버 없음(정적). P2에서만 Node 어댑터 1개(모델 호출 프록시) | 키를 브라우저에 두지 않음. P0는 키 없이 완주 |

## 3. 저장소 구조

```
src/
  content/
    types.ts              시나리오 데이터 스키마(자료·문구·조건·충돌·반응·후속·규칙·정리 카드)
    scenarios/
      aiAssistant.ts      안건 ② (P0)
      customerSupport.ts  안건 ① (P1)
      prevention.ts       안건 ③ (P1)
      index.ts            등록·활성 여부('준비 중' 플래그)
  domain/
    session.ts            Session 타입, stage 전이, reducer, 액션
    clock.ts              Clock 인터페이스, 240초 deadline, 75/90초 무입력 규칙
    draft.ts              selectedPhraseIds/draftText 분리, 편집 보존, 300자, 공백 검사
    conditions.ts         문구→조건 제안, 자유 입력 해석기(제안만), 충돌 검사, proposed→confirmed
    motion.ts             최종 안건 고정(kind, effectiveConditionIds, executionMode), 시간 만료 시 원안 고정
    voting.ts             우선순위 규칙 평가기(첫 일치 행), 집계(YES≥3/NO≥3/보류, UNCAST 별도), 중복·무효 차단
    assistantLog.ts       BRIEFING_SUMMARY_SHOWN 등 AssistantAction 기록, mode 구분
    publicPayload.ts      관람 뷰 공개 payload selector(원문·초안·미확정 표 제외) — P0에서 정의, P1에서 사용
  services/
    assistant/
      types.ts            어댑터 인터페이스(요청 sessionId/requestId, 취소, timeout)
      scripted.ts         사전 구성 응답(P0)
      live.ts             실제 모델 어댑터(P2)
    transport/
      types.ts            관람 뷰 전송 어댑터 인터페이스(P0 정의)
      broadcastChannel.ts P1 구현
  components/
    screens/              Attract, Select, Briefing, Opinions, Discuss, Reactions, Motion, Vote, Result
    parts/                MemberCard, EvidenceCard, SummaryCard, PhraseCard, DraftEditor, ConditionChips,
                          Timer, IdleNotice, OperatorMenu, AssistantPanel, VoteRadio, ResultSeats
    spectator/            P1 관람 뷰
  app/
    App.tsx, routes(view=spectator 분기), providers
  styles/
    tokens.css, base.css, screens/*.css
public/
  fonts/ (fontsource가 처리), icons/, backgrounds/
tests/                    Vitest 단위 테스트(domain·content)
e2e/                      Playwright 시나리오·스크린샷
docs/screenshots/         E2E가 생성한 화면 캡처(완료 기준 증빙)
```

## 4. 핵심 설계 결정

**시나리오 데이터는 순수 데이터다.** 규칙은 코드가 아니라 데이터로 표현한다. 임원 규칙은 `{ when: Predicate, vote }` 배열이고 Predicate는 `has(ID)`, `all([...])`, `any([...])`, `not(...)`, `mode(X)`, `always`의 조합이다. ①②③ 규칙표를 그대로 옮길 수 있고, 평가기는 시나리오와 무관하게 하나다.

**Motion은 지시서 6장 인터페이스를 P0부터 그대로 쓴다.** P0에서는 `baseConditionIds=[]`, `effectiveConditionIds=[...conditionIds]`, `executionMode='DEFAULT'`로 고정하고 배열은 복사본으로 저장한다. 평가기는 처음부터 `effectiveConditionIds`와 `executionMode`만 읽는다. ③의 원안 병합·명시적 삭제·실행 방식 정규화는 `content/scenarios/prevention.ts`의 `normalize()` 함수로 추가하고 인터페이스는 바꾸지 않는다.

**세션은 메모리 상태다.** 영구 저장 없음. 새로고침은 새 세션. 모든 비동기 응답은 `sessionId`와 `requestId`를 갖고, 현재 세션과 다르면 폐기한다.

**시간은 두 개의 시계다.** 240초 체험 deadline(연장 불가)과 무입력 시계(클릭·키 입력·실제 스크롤로만 갱신, RESULT 진입 시 재시작). 같은 tick에서 둘 다 만료면 무입력 복귀가 우선한다. 두 시계 모두 주입된 `Clock`으로 계산해 테스트에서 시간을 제어한다.

**공개 payload selector는 P0에서 만든다.** 관람 뷰는 P1이지만, 무엇이 공개 가능한지는 세션 구조가 정해지는 P0에서 함수와 테스트로 고정한다. 발언 원문·draft·AI 초안·선택 중인 표는 selector 출력에 존재하지 않아야 한다.

## 5. 작업 분해와 순서

각 마일스톤은 커밋 단위이자 확인 지점이다. 예상 소요는 사람 1인 기준의 참고값이며, 이 세션에서 직접 구현할 때는 더 짧을 수 있다.

### P0 — 안건 ② 완주 프로토타입

| 단계 | 산출물 | 완료 확인 | 참고 소요 |
| --- | --- | --- | --- |
| M0 스캐폴드 | Vite+React+TS, ESLint/Prettier, Vitest, Playwright, tokens.css, 폰트 번들, README 골격, GitHub Actions | `npm run lint/test/build/e2e` 통과. 빈 화면에 한글 폰트 렌더 | 0.5일 |
| M1 콘텐츠·엔진 | 시나리오 타입, 안건 ② 데이터, 규칙 평가기, 집계, 조건 제안·충돌·확정, 최종 안건 고정, 세션 reducer | 단위 테스트: 96개 조합×4 전수, 대표 경로표 전 행, 무효 투표·중복·확정 후 재투표 차단, 시간 만료 원안 고정·UNCAST | 1.5일 |
| M2 화면 흐름 | 9개 상태 화면(스타일 최소), 문구 체크·draft 편집 보존·300자·IME, 후속 질문 1회, MOTION 고정, VOTE radio+확정, RESULT 5석 | 브라우저에서 추천 문구만으로 완주, 직접 입력만으로 완주. E2E 2경로 | 1.5일 |
| M3 운영 규칙 | 240초 deadline·60/30초 안내, 무입력 75초 안내·90초 복귀·계속 버튼, 운영 메뉴(새 체험·전체화면·닫기), 리셋 시 비동기 취소, 늦은 응답 폐기 | 단위 테스트(가짜 시계), E2E: 만료→결과, 무입력→ATTRACT, 두 번 클릭 중복 없음 | 1일 |
| M4 AI 비서실장(사전 구성) | BRIEFING 상시 정리 카드+표시 이벤트, 사이드 패널 3기능, '내 발언에 적용', AssistantAction 기록, RESULT 'AI가 도운 일' | 버튼을 안 눌러도 결과에 자동 정리 기록. timeout 시 기본 안내 전환 | 1일 |
| M5 디자인 적용 | 토큰·레이아웃(1920/1280), 비실사 아바타, 임원 카드·내 좌석, 전환 모션·reduced-motion, 200% 확대, 상태 색+텍스트 | 두 해상도 스크린샷 4장 이상(선택/토론/투표/결과). 문구 6개·300자·조건 4개 배치 확인 | 1.5일 |
| M6 검증·문서·PR | E2E 전 경로, 오프라인 빌드 실행 확인(네트워크 차단 상태 `vite preview`), README(설치·개발·빌드·테스트·데모/실제 AI 차이·미구현), PR | 지시서 7장 P0 항목 체크리스트를 PR 본문에 대응시켜 전부 체크 | 0.5일 |

P0 합계 참고 소요: 약 7.5일(1인). 현장 마우스·물리 키보드 한글 입력과 실제 장비 검증은 코드로 대신할 수 없으므로 리허설 항목으로 남긴다.

### P1 — 세 안건·관람 뷰

| 단계 | 산출물 | 완료 확인 |
| --- | --- | --- |
| M7 안건 ①·③ | 두 시나리오 데이터, ③ `normalize()`(기본 조건 병합·DROP_CONSENT 삭제·executionMode), SELECT 세 카드 활성 | 전수 테스트 96·128, 대표 경로표 전 행, ③ 원안 승인 경로, ③ 반대 부결 불가 확인 |
| M8 관람 뷰 | `?view=spectator`, BroadcastChannel 어댑터, heartbeat 2초·끊김 5초, revision·reset 처리, 운영 메뉴 '관람 창 열기'(window.open 이름 재사용), 관람 창 전체화면 버튼 | selector 출력에 원문 없음(테스트), E2E: 두 창 동기화·리셋·재접속, 팝업 차단 안내 |
| M9 표시 보강 | ③ 꼬리표(제안 유형), MOTION/RESULT 안건 종류 표시, P1+P4→검증안 표시 | 스크린샷 추가, README 갱신 |

### P2 — 실제 AI(조건부)

| 단계 | 산출물 | 완료 확인 |
| --- | --- | --- |
| M10 live 어댑터 | Node 서버 1개(`/api/refine`), 환경변수 키, 스키마 검증, 5초 timeout, 원문 보존, live/scripted 기록, 기능 플래그 | 실패 시 원문 유지 테스트, 네트워크 없을 때 전부 scripted·'시연' 표기 |

## 6. 테스트 전략

- **엔진 전수 테스트:** 허용 조건 조합×참가자 4표를 모두 열거해 불변식을 검사한다. 규칙 총괄성(모든 입력에 정확히 한 행), 5석 유지, 세 결론 도달, 함정 조건 부결, 참가자 결정 경로 존재. 시나리오 문서의 대표 경로표를 테스트 데이터로 그대로 옮겨 문서와 코드가 어긋나면 실패하게 한다.
- **시간 테스트:** `Clock`을 주입해 240초·75초·90초·동시 만료·RESULT 재시작을 결정적으로 검사한다. 실제 타이머에 의존하는 테스트는 만들지 않는다.
- **입력 테스트:** draft 편집 보존(수정 후 체크 변경 시 확인 UI), 300자 경계, 공백만 입력, IME 조합 중 Enter 무시(compositionstart/end 이벤트 시뮬레이션). 실제 한글 IME 동작은 Playwright로 완전히 재현되지 않으므로 리허설 항목에 남긴다.
- **E2E 경로(Playwright):** 추천 문구만 완주, 직접 입력만 완주, 후속 질문 보완, 시간 만료, 무입력 복귀, 운영 메뉴 새 체험, 두 번 클릭. 두 해상도에서 실행하고 스크린샷을 `docs/screenshots/`에 저장한다.
- **오프라인 검증:** CI에서 빌드 후 네트워크 차단 상태로 preview 서버를 띄워 E2E를 실행한다. 외부 요청이 하나라도 발생하면 실패하도록 Playwright에서 외부 도메인 요청을 차단·기록한다.
- **하지 않는 테스트:** UI 문구를 그대로 복제하는 스냅샷, 스타일 값 검사.

## 7. 브랜치·커밋·PR 운영

- 실행 방식: 마일스톤을 작업 카드(docs/TASKS.md)로 나누고, 카드마다 builder → reviewer → fix 반복을 `task-cycle` 워크플로로 돌린다. 역할·토큰 절약 규칙·실행 방법은 docs/AGENT_WORKFLOW.md를 따른다.
- 개발 브랜치: `claude/ax-day-2026-samsung-booth-syt4do`. main에 직접 커밋하지 않는다.
- 커밋 단위: 마일스톤마다 1개 이상. 메시지는 `feat(engine): …`, `feat(ui): …`, `test: …`, `docs: …` 형식.
- PR: P0 완료 시 1개(M0~M6), P1 완료 시 1개, P2는 조건 충족 시. PR 본문에 지시서 7장 완료 기준을 체크리스트로 옮기고 각 항목의 증빙(테스트 이름·스크린샷 경로)을 적는다.
- CI 통과가 PR 병합 조건이다. 검토는 사용자 또는 GPT가 하고, 지적 사항은 같은 브랜치에 추가 커밋으로 반영한다.
- 수정안 문서(`docs/REVISION_PROPOSAL_v0.6.md`, `v0.7.md`)는 이력으로 브랜치에 남기고 PR에 포함한다. 제외를 원하면 M6에서 삭제한다.

## 8. 리스크와 대응

| 리스크 | 영향 | 대응 |
| --- | --- | --- |
| 한글 IME 동작이 자동 테스트로 재현되지 않음 | 조합 중 Enter 제출 같은 버그가 현장에서 발견 | compositionstart/end 처리 코드를 단위 테스트하고, 리허설 1에서 Windows 실제 키보드로 검증 |
| Fullscreen API는 사용자 제스처 필요 | E2E로 완전 검증 불가 | 거부·미지원 분기만 자동 테스트, 진입은 리허설 항목 |
| BroadcastChannel 프로필 제약(P1) | 두 창 동기화 실패 | 전송 어댑터 인터페이스를 P0에서 분리해 두어 릴레이로 교체 가능하게 함 |
| Noto Sans KR 번들 용량 | 첫 로드 지연 | fontsource 서브셋(한글 필수 weight 400/700만) 사용, preview에서 로드 시간 확인 |
| 1280×720에서 문구 6개·300자 입력·임원 4카드 배치 | 스크롤·잘림 | M5 초반에 실제 콘텐츠로 배치 확인, 임원 카드 접힌 한 줄 요약 사용 |
| 문서와 코드의 규칙 불일치 | 결과 화면 오류 | 대표 경로표를 테스트 데이터로 사용해 어긋나면 CI 실패 |
| 240초 타이머 드리프트 | 만료 시점 오차 | 절대 deadline 기반, 화면은 표시만 담당 |

## 9. 착수 전 확인이 필요한 결정

기본값으로 진행하되, 다른 선택을 원하면 M0 전에 알려 주면 된다.

| 결정 | 기본값 | 대안 |
| --- | --- | --- |
| 앱 위치 | 저장소 루트 | `app/` 하위 폴더 |
| 패키지 관리자 | npm(lockfile 커밋) | pnpm |
| CI | GitHub Actions 추가 | CI 없이 로컬 검증만 |
| 스크린샷 저장 | `docs/screenshots/`에 커밋 | PR 첨부만 |
| 수정안 문서 | 브랜치에 유지 | M6에서 삭제 |
| P1 착수 시점 | P0 PR 병합 후 같은 브랜치에서 계속 | P0 PR과 병행해 새 브랜치 |

## 10. 첫 착수 시 실행 순서

1. M0: 스캐폴드와 CI를 만들고 빈 화면이 한글 폰트로 렌더되는 상태를 커밋한다.
2. M1: 안건 ② 데이터와 엔진을 만들고 전수 테스트·대표 경로 테스트를 통과시킨다. 이 시점에 UI 없이도 규칙이 문서와 일치함을 보고한다.
3. M2~M4: 화면·운영 규칙·AI 패널을 붙이고 E2E 경로를 늘린다.
4. M5~M6: 디자인을 입히고 스크린샷·README·PR을 만든다.

각 마일스톤이 끝날 때마다 커밋을 푸시하고, 실행 방법과 확인된 것·확인 안 된 것을 짧게 보고한다.

## 11. v0.8 반영 — live 임원 에이전트 (2026-09-10)

### 무엇이 바뀌는가

| 항목 | v0.7까지 | v0.8 |
| --- | --- | --- |
| 임원 의견·반응·표 | 시나리오 규칙표로 결정 | 역할 프롬프트를 가진 에이전트 4개가 자료·참가자 발언·동료 발언을 읽고 판단. 규칙표는 scripted 모드 전용 |
| 내 발언 정리 | 사전 구성 | 실제 AI. 원문/초안 비교, 적용은 입력창만 변경, 세션당 2회·동시 1개·5초 |
| 의견 한눈에 보기 | 사전 구성 | live에서는 실제 회의 기록 요약. 실패 시 발언 카드 목록 |
| 표결 대기 | 즉시 | 참가자 확정 후 임원표 수신 대기 min(8초, 남은 시간). 미응답은 UNCAST와 사유 |
| 결과 | 표만 | 역할별 판단 근거(≤160자), 미표결 사유, "일부 임원 미표결로 판단이 제한되었습니다" |
| 모드 | 없음 | 세션 시작 전 live/scripted 고정, 화면 표시. live 실패를 scripted로 몰래 대체하지 않음 |
| 서버 | 없음 | 모델 호출·검증은 서버. 키는 서버 환경변수 |

### 아키텍처

- `server/` (Node + TypeScript): `GET /api/health`, `POST /api/board/round`(opinions·reactions·followup), `POST /api/board/vote`, `POST /api/assistant/refine`, `POST /api/assistant/summarize`. 제공자 인터페이스 `ModelProvider` 뒤에 `mock`(결정적 응답·장애 주입)과 `anthropic`(`@anthropic-ai/sdk`, 구조화 출력) 구현. 응답 검증(스키마·enum·길이·근거 ID·revision·motionHash·중복·종료 후)은 서버가 한다.
- 모델 기본값은 `claude-sonnet-5`(2026-09-10 사용자 결정), `output_config.effort: 'low'`, 짧은 `max_tokens`, 재시도 0회, 호출별 timeout은 요청이 넘긴 남은 예산. 모델 교체 지점은 두 곳뿐이다: 운영 중에는 서버 환경변수 `MODEL_ID`(코드 변경 없음), 코드 기본값은 `server/config.ts`의 `DEFAULT_MODEL_ID` 상수 한 줄. 프롬프트·검증·클라이언트는 모델명을 알지 못하며, 결과 기록과 `/api/health`에 실제 사용 모델이 표시된다.
- 클라이언트: `services/boardAgents`(scripted·live 어댑터, 같은 인터페이스), `services/orchestrator`(라운드 실행, 병렬 호출, 시간 상한, 늦은 응답 폐기, VOTE 대기·FINALIZE), 도메인은 `Statement`·`Transcript`·확장 `Ballot`·`mode`·`motionHash`를 갖는다.
- 프롬프트 주입 방어: 참가자 원문과 회의 기록은 데이터 블록으로 전달하고 역할·집계는 서버 코드가 고정한다. 알 수 없는 근거·조건 ID는 거절한다.
- 테스트 두 층: scripted·정규화·집계·미표결·늦은 응답은 결정적 테스트, live는 mock 제공자로 흐름·장애·주입을 E2E로 검증하고 실제 모델 평가는 별도 하네스(T32)로 기록한다.

### 작업 순서 (갱신)

T26 도메인 확장 → T27 서버 골격·검증 → T28 역할 프롬프트·라운드 → T29 오케스트레이터·어댑터 → T30 화면 연결·모드 → T31 비서실장 live → T32 live 평가 하네스 → T15 모션·접근성 → T16 E2E 전체(mock 서버 포함) → T17 README·오프라인(scripted)·PR 초안. 디자인 마감(T33)은 P0 PR 뒤에 별도로 한다.

### 착수 전 확인이 필요한 결정

| 결정 | 기본값 | 비고 |
| --- | --- | --- |
| 모델 제공자·모델 | Anthropic SDK, `claude-sonnet-5`, effort low (확정) | opus로 올릴 때는 `MODEL_ID=claude-opus-5` 환경변수 또는 `server/config.ts`의 `DEFAULT_MODEL_ID` 한 줄. 8초 상한 실측(T32)으로 판단 |
| 키 확보 | 서버 환경변수 `ANTHROPIC_API_KEY` 또는 `ant auth login` 프로필 | 없으면 live 항목은 미검증으로 보고 |
| E2E의 live 경로 | mock 제공자 서버를 Playwright webServer로 함께 기동 | 실제 키는 CI에 넣지 않음 |
