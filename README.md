# axday_agent

> **현재 기획 v0.8 / 구현 지시서1.5:** [임원 에이전트·AI 비서실장](docs/AGENT_BOARDROOM_SPEC.md). 임원4명 실제 AI 판단과 실제 내 발언 정리를 P0 기본 목표로 반영했습니다. PPT·이미지는 v0.7 시각 참고이며 그 안의 P2 AI·고정 표결 설명은 최신 구현 기준이 아닙니다.

삼성화재 AX Day 2026 · BOARDROOM 2026: 4분 이사회

참가자는 특별 이사로 가상 임원 4명과 토론하고 마지막에 한 표를 행사합니다. P0(안건 ② 완주, live/scripted 겸용)는 구현이 끝났고 PR 준비 단계입니다([진행 상황](docs/TASKS.md#진행-상황)). P1(안건 ①·③, 관람 뷰)·P2(서버 배포·튜닝)는 아직 착수 전입니다.

## 설치

```
npm install
```

Node 22, npm을 전제로 합니다. 런타임에 외부 네트워크 요청은 하지 않습니다(live 모드의 모델 호출만 예외이며 서버에서만 나갑니다. 아래 "데모(scripted)와 실제 AI(live) 차이" 참고).

## 개발

```
npm run dev                                  # scripted만 확인 — 클라이언트 단독, 8787 서버 불필요
MODEL_PROVIDER=mock PORT=8787 npm run server # 다른 터미널: live 배지·흐름을 mock 응답으로 확인
MODEL_PROVIDER=anthropic npm run server      # 실제 모델. ANTHROPIC_API_KEY를 같은 셸에만 설정
```

서버가 없거나 `/api/health`가 1.5초 안에 응답하지 않으면 화면은 자동으로 scripted로 표시됩니다. `?mode=scripted` 쿼리를 붙이면 서버가 떠 있어도 강제로 scripted 경로만 탑니다.

## 빌드

```
npm run build      # tsc -b && vite build. dist/에 정적 산출물 생성
npm run preview     # 빌드 산출물을 4173 포트로 로컬 기동(오프라인 실행 확인용)
```

## 테스트

```
npm run check       # lint + typecheck(클라이언트·서버) + vitest 단위 테스트
npm run test         # vitest만(tests/domain, tests/content, tests/services, tests/server)
npm run build && npx playwright test   # e2e(1920×1080·1280×720 두 해상도, mock 서버 자동 기동)
```

단위 테스트 203개(도메인 규칙·표결 평가·조건·시계·서버 검증·live 어댑터), E2E 54개(27개 spec × 2 해상도). `e2e/fixtures.ts`가 모든 spec에 외부 요청 차단 fixture를 자동 적용해 `localhost` 밖으로 나간 요청이 있으면 테스트가 실패합니다.

## 오프라인 실행 확인

```
bash scripts/offline-check.sh
```

빌드 산출물(`vite preview`)만으로, 그리고 로컬 밖으로 나가는 요청이 0건인 상태로 scripted 경로가 완주되는지 확인하는 스크립트입니다. 순서: 1) `npm run build` 2) `vite preview`를 4173 포트로 기동해 응답을 기다림 3) `e2e/smoke.spec.ts`·`flow-full.spec.ts`·`discuss.spec.ts`·`operations.spec.ts`를 외부 요청 차단 fixture와 함께 실행. 이 subset은 대기→선택→토론→최종 투표→결과의 scripted 전 구간과 240초 만료·무입력 75초/90초·운영자 메뉴·중복 클릭 방지를 포함합니다. 통과하면 인터넷 연결 없는 현장 PC에서도 scripted 체험이 끝까지 동작한다는 근거가 됩니다. live(실제 모델 호출)는 이 스크립트의 범위가 아니며 서버 환경변수와 API 키가 있는 별도 네트워크가 필요합니다.

테스트용 무료 웹호스팅(GitHub Pages·Render) 배포 절차는 [docs/DEPLOY.md](docs/DEPLOY.md)를 참고하세요(행사 당일 운영은 로컬 서버를 씁니다).

## 데모(scripted)와 실제 AI(live) 차이

| 항목 | scripted (데모) | live (실제 AI) |
| --- | --- | --- |
| 임원 의견·반응·표 | 시나리오 규칙표로 결정, 고정 문구 | 역할 프롬프트를 가진 에이전트 4개가 참가자 발언·동료 발언·자료를 읽고 판단 |
| 내 발언 정리(AI 비서실장) | 사전 구성된 초안 | 서버가 실제 모델을 호출해 원문/초안을 비교 제시(세션당 2회·동시 1개·5초 실패 시 원문 유지) |
| 의견 한눈에 보기 | 사전 구성된 요약 | 실제 회의 기록 요약, 실패 시 발언 카드 목록으로 대체 |
| 네트워크 | 없음(완전 오프라인) | 브라우저→서버(로컬 또는 사내망)→모델 API. 클라이언트는 상대 경로 `/api/...`만 호출 |
| 모드 판정 | `?mode=scripted` 또는 서버 미응답 시 자동 | `/api/health`가 1.5초 안에 성공해야 진입, 화면 배지로 표시 |
| 표결 검증 기준 | 고정 테스트로 득표수까지 검증 | 근거·역할·논거 반영·안건 동일성·응답 실패 처리를 검수. 득표수 고정은 요구하지 않음 |

실제 키로 검증된 항목: `MODEL_PROVIDER=mock`(결정적 mock 제공자)으로만 검증된 live 흐름(E2E `e2e/live.spec.ts`, 단위 `tests/server/*.test.ts`·`tests/services/live.test.ts`·`tests/services/assistant-live.test.ts`). **실제 Anthropic API 키로의 실측은 아직 실행하지 않았습니다.** 절차와 예상 비용은 [docs/LIVE_EVAL.md](docs/LIVE_EVAL.md)에 있고, `npm run eval:live -- --runs 3` 결과 파일(`docs/eval/`)은 아직 비어 있습니다.

## 완료 범위 (P0)

- 안건 ② 전 구간을 실제 브라우저에서 마우스 클릭·키보드만으로 완주(추천 문구만 / 직접 입력만 두 경로 모두).
- 추천 문구 복수 선택, 300자 제한, 편집 보존, 공백 방지, 후속 질문 조건 유지/해제.
- 최종 투표 이전에는 찬성/보류/반대 버튼이 없고, 표 선택 후 미확정 상태로 240초가 지나면 UNCAST로 집계.
- 240초 만료, 무입력 75초 안내·90초 대기 화면 복귀, 운영자 메뉴(새 체험 확인, 전체화면 진입/종료), 새로고침 시 새 세션, 최종 투표 중복 클릭 방지.
- scripted 표결 결과(가결·보류·부결·내 표 영향)는 고정 테스트로 검증. live는 mock 제공자로 근거·역할·안건 동일성·응답 실패(UNCAST)를 검증.
- AI 비서실장을 한 번도 쓰지 않고 완주해도 결과 화면에 자료 자동 정리 기록이 남고, 실제로 적용했는지 여부를 정확히 구분해 표시.
- live/scripted 모드를 세션 시작 전 한 번 고정하고 화면에 배지로 표시. 서버 실패를 scripted로 몰래 대체하지 않음.
- 1920×1080·1280×720에서 주요 CTA·입력이 잘리지 않고, 아바타는 전 화면 비실사 아이콘/이니셜로 통일. 키보드만으로 완주, `prefers-reduced-motion`, 200% 확대 상당 뷰포트 대응.
- 선택·토론·투표·결과 화면 스크린샷(`docs/screenshots/desktop-1080/`, `docs/screenshots/desktop-720/`)을 문서 증빙으로 저장.
- 상세 체크리스트와 증빙은 [docs/PR_P0.md](docs/PR_P0.md) 참고.

## 미구현 (P1 · P2)

- **P1** — 안건 ①·③ 데이터·정규화, ③의 실행 방식 표시와 제안 꼬리표, 관람 뷰(원문·AI 초안·미확정 표 미전송, 재접속·연결 끊김 처리), 서기 입력 확인 리허설. 카드: `docs/TASKS.md`의 T18~T22.
- **P2** — 실제 모델 응답 비용·지연 튜닝(임원 에이전트 고도화 2차), 결과 출력(프린터) 선택 확장. 카드: T23·T24·T34·T35.
- 임원 에이전트 실제 키 실측(`npm run eval:live -- --runs 3`)은 아직 실행하지 않았고, T34(고도화 1차)는 이 실측 결과가 있어야 시작합니다.

## 현장 미검증 목록

아래 항목은 자동 테스트로 재현할 수 없어 실제 행사 장비에서 리허설로 확인해야 합니다.

- 한글 IME 실기기 입력(물리 키보드 조합 입력·Enter 처리).
- 전체화면(Fullscreen API) 진입 — 브라우저 사용자 제스처가 필요해 E2E로 완전히 검증할 수 없고, 거부·미지원 분기만 코드로 구현되어 있음(자동 테스트 없음).
- 실제 모니터에서의 거리 가독성(행사장 조명·해상도·시야각).

## Claude Code 시작점

[CLAUDE_IMPLEMENTATION.md](CLAUDE_IMPLEMENTATION.md)를 읽고 안건 ② 프로토타입부터 구현합니다. 문서 마지막의 시작 프롬프트를 그대로 전달할 수 있습니다.

- [기획서 v0.7](AX_Day_2026_Boardroom_Plan.md)
- [안건 ① 상세 시나리오·표결 분기](docs/SCENARIO_CUSTOMER_SUPPORT.md)
- [안건 ③ 상세 시나리오·표결 분기](docs/SCENARIO_PREVENTION.md)
- [안건 ② 상세 시나리오·표결 분기](docs/SCENARIO_AI_ASSISTANT.md)
- [디자인 명세·화면 이미지](docs/design/DESIGN_SPEC.md)
- [CSS 디자인 토큰](docs/design/tokens.css)
- [개정 PPT v0.7 · 18장](docs/reference/AX_Day_2026_Boardroom_Proposal.pptx)
- [작업 카드·진행 상황](docs/TASKS.md)
- [P0 완료 체크리스트(PR 초안)](docs/PR_P0.md)

## 반드시 유지할 체험

토론은 추천 문구 복수 선택 또는 직접 입력·수정 → 의견 전달 → 임원 반응입니다. 투표는 최종 안건 확인 이후 마지막에만 합니다. CFO는 한 사람이며 참가자를 포함해 총 5석입니다.

모든 안건·인물·자료·의결 규칙은 체험용 가상 설정입니다. 이미지들은 AI로 생성된 콘셉트 목업이며 실제 서비스 캡처나 실제 임원 사진이 아닙니다.

2026-09-09 검토 반영: AI 자동 정리 상시 표시, 찬성·반대 양방향 결정 경로, 세 안건 구조화, 무입력90초 복귀와 현장 검수 기준. 최신 구현 지시서는 v1.5입니다. PPT·이미지는 시각 레퍼런스이며 최신 문서의 동작·수량·비실사 아바타 기준을 우선합니다.

현장 입력 확정(2026-09-09): 기본 조작은 PC 마우스 한 번 클릭입니다. 직접 입력은 물리 키보드를 사용하며 추천 문구만으로도 완주합니다. 이전 터치 키보드·롱프레스 필수 요건은 대체되었고 운영 메뉴는 화면의 ‘운영’ 버튼 클릭으로 엽니다.

v0.6 반영 이력: [검토 반영표](docs/REVISION_DECISIONS_v0.6.md) · [진행 요원 가이드](docs/FACILITATOR_GUIDE.md) · [규칙 검증](docs/VALIDATION_v0.6.md). 안건③은 원안 기본절차를 유지한 확대/선검증 판단으로 개정했습니다. PPT와 이미지 7종은 v0.7로 교체했습니다. 안건② 네 조건+참가자 찬성 결과는 찬성5·보류0·반대0입니다.

최신 v0.7: [검토 반영표](docs/REVISION_DECISIONS_v0.7.md) · [변경 확인](docs/VALIDATION_v0.7.md). 관람 창 실행·③ 표결 영향 설명·제안 꼬리표·선택 문구·P0 범위를 명확히 했으며 표결 규칙은 v0.6과 같습니다.

2026-09-09 시각 자료 동기화: AI 자동 정리 브리핑과 안건③ 검증안(확대 재심의) 화면을 추가했습니다. [자산 버전표](docs/design/assets/README.md)에서 PPT 페이지·파일·검증 내역을 확인할 수 있습니다.

2026-09-10 v0.8 구현: 임원 4명 실제 AI 판단(live)과 실제 내 발언 정리를 서버(`server/`)로 구현했습니다. scripted는 오프라인 데모 경로로 유지됩니다. 자세한 완료 범위는 위 "완료 범위 (P0)"와 [docs/PR_P0.md](docs/PR_P0.md)를 참고하세요.
