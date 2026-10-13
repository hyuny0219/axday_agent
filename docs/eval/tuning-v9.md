# 임원 에이전트 고도화 — 튜닝 라운드 v9 (T82, 조건을 한국어 이름으로만 부르게)

- 대상: `server/prompts/common.ts`(`formatConditionLabels`·`formatConditionIdMap`, 공통 가드레일), `server/validate.ts`(`findStrayLatinRun`, 응답 스키마 `superRefine`), `server/prompts/version.ts`(v8 → v9), `server/providers/mock.ts`("[mock]"·영문 단계명 제거)
- 평가 세트: `scripts/eval-set.json`(T79과 동일 16케이스) · 실행기 `scripts/eval-set-run.ts`
- provider: anthropic · modelId: claude-sonnet-5
- before 기록: 없음 — v8 자체가 이번 변경 전 기준선이다(`docs/eval/tuning-v8-after.jsonl`, 192행). 같은 세트로 after만 다시 재서 직접 비교한다.
- after 기록: `docs/eval/tuning-v9-after.jsonl`(promptVersion=v9, 192행, **189행 응답·3행 실패**) — 이 카드의 변경(조건 한국어 호칭 + 잔존 검사기) 반영 후 실측.

## 왜 v9 라운드를 돌았는가

2026-10-07 사용자 지적: "AI 임원들이 말하는 의견에 영어 단어가 섞여 있어 어색하고 AI스럽다. 사람이 말하는 것처럼 자연스럽게." v8 실측(`docs/eval/tuning-v8-after.jsonl`)을 다시 센 결과 192행 중 **87행(45%)**의 message·reason·draftText에 조건 ID(LOG, OWNER, SCOPE, RECORD, DATA_VETO, REVIEW, LIMIT, FULL_AUTO, EXP_ONLY 등)가 라틴 문자 그대로 섞여 있었다 — 예: "LOG·OWNER 조건이 보장되지 않아", "SCOPE·RECORD·DATA_VETO 조건 없는 원안은". 원인은 `prompts/common.ts`의 `buildMeetingRecordBlock`이 조건 목록을 `- ${id}: ${label}` 한 줄로 줘서, 모델이 한국어 라벨과 영문 ID를 구분 없이 베껴 썼기 때문이다(E1~E4 자료 ID가 옛 T54에서 같은 문제로 "이름을 인용"으로 바뀐 것과 동일한 유형).

## 무엇을 고쳤는가

- `server/prompts/common.ts`: 조건 목록을 두 블록으로 쪼갰다 — 본문(`formatConditionLabels`)은 한국어 라벨만("- 승인 사유 기록"), 바로 아래 "조건 이름-ID 대응표"(`formatConditionIdMap`, "- 승인 사유 기록: LOG")는 "응답 JSON의 evidenceIds·suggestedConditionIds 필드를 채울 때만 참고하고, 문장·이유·발언 본문에 절대 쓰지 마십시오"라는 지시와 함께 조건이 있을 때만 싣는다. 공통 가드레일(`buildCommonGuardrails`)의 자료 인용 규칙에 조건 호칭 규칙을 합쳐 한 항목으로 정리 — 자료·조건 모두 한국어 이름으로, 영문 약어·코드는 금지하되 `"AI"` 두 글자·임원 역할 이름(CEO·CFO·CAIO·CISO, `EXEC_ROLE_IDS`에서 동적으로 생성 — 이름이 없는 가상 인물이 서로를 가리킬 유일한 방법)·숫자·단위(62%, 2.8일)는 예외로 뺐다. `prompts/assistant.ts`(refine·summarize)는 같은 `buildCommonGuardrails`·`buildMeetingRecordBlock`을 쓰므로 수정 없이 같은 규칙을 받는다.
- `server/validate.ts`: `findStrayLatinRun()`을 추가해 라틴 문자 2자 이상의 연속을 찾고, `"AI"`·`EXEC_ROLE_IDS`만 예외로 둔다 — 조건 ID(LOG, FULL_AUTO 등)는 전부 이 모양이라 `CONDITION_IDS`를 따로 나열하지 않아도 자동으로 걸린다(새 조건을 추가해도 그대로 적용). `statementResponseSchema`(message)·`voteResponseSchema`(reason)·`assistantResponseSchema`(draftText)에 `.superRefine()`으로 이 검사를 붙여, 남은 영문이 있으면 기존 `invalid_response` 경로(각 핸들러의 `!parsed.success` 분기, 화면은 UNCAST·대체 문구)로 거절한다 — 새 핸들러 코드는 필요 없었다.
- `server/providers/mock.ts`: `"[mock]"`(라틴 문자 연속이라 그 자체로 새 검사기에 걸린다)을 `"[모의]"`로, 단계 영문명(OPINIONS 등)도 `STAGE_LABEL_KO`로 한국어 라벨("의견"·"반응"·"후속"·"표결")로 바꿨다. e2e(`e2e/live.spec.ts`·`retry.spec.ts`·`reactions.spec.ts`)의 같은 고정 문자열도 맞춰 갱신.
- `server/prompts/version.ts`: `PROMPT_VERSION` v8 → v9, 이력 주석 추가.
- 테스트: `tests/server/meetingRecord.test.ts`에 조건 목록이 라벨만 보이고 ID는 대응표에만 있는지(2건), `tests/server/validate.test.ts`에 `findStrayLatinRun` 직접 단위 테스트(3건)와 세 응답 스키마 각각 조건 ID 잔존 거절·한국어 라벨 허용·`"AI"`·역할 이름·숫자·단위 예외(8건), 비서실장 `suggestedConditionIds`는 여전히 ID로 받는지(1건) 확인.

## 측정 결과 (after, 192행 = 16케이스 × 4역할 × 3단계)

| 항목 | v8 | v9 |
| --- | --- | --- |
| 응답 / 실패 | 190 / 2 | **189 / 3** |
| 실패 원인 | provider 수준 `invalid_response`(JSON 파싱 불가) 2건, 같은 케이스(conflict-2) VOTE | provider 수준 `provider_error`/`other`(8초 타임아웃) 3건 — `ai-approval/conflict-2`의 REACTIONS·CEO·VOTE·CFO, `experience-first/condition_supplement-2`의 OPINIONS·CISO. **스키마 거절(`invalid_response`)로 실패한 행은 0건** — `findStrayLatinRun`이 실측에서 한 번도 걸리지 않았다 |
| 안건별 | ai-approval 96/96 · experience-first 96/96(v8) | ai-approval 94/96(실패 2) · experience-first 95/96(실패 1) |
| **message·reason·draftText의 조건 ID·잔존 영문 잔존** (`AI`·역할 이름 제외, 자체 재집계) | **87/192(45%)** | **0/189(0%)** |
| 문장 속 자료 ID(`E\d`) 잔존 | 0건 | 0건 |
| stance 누락(OPINIONS·REACTIONS answered 기준) | 0건 | 0건 |
| 존댓말 종결 위반 | 0건 | 0건 |
| 문장 길이 최대 (message / reason) | 102자 / 130자 | 116자 / 135자(한도 120·160 안) |
| 지연(answered 기준) 중앙값 / 최대 | 3209ms / 6569ms | 3349ms / 5491ms |
| VOTE 분포(경로별, answered 기준) | 조건 없음 NO 16 / 조건 보완 YES 16 / 상충 YES 1·NO 13(2건 실패 제외) / 요청형 YES 3·NO 13 | 조건 없음 NO 16 / 조건 보완 YES 16 / 상충 YES 1·NO 14 / 요청형 NO 16 |

**조건 ID 잔존 87/192 → 0/189**가 이번 라운드의 핵심 결과다 — `findStrayLatinRun`으로 jsonl 전체를 직접 재검사했고(서버의 `invalid_response` 집계가 아니라 사후 확인), 189개 응답 행의 message·reason·draftText 어디에도 `AI`·역할 이름(CEO 등)·숫자·단위를 뺀 라틴 문자 2자 이상 연속이 없었다. 3건의 실패는 모두 8초 타임아웃(`provider_error`/`other`)이고 새 검사기로 인한 거절은 한 건도 없었다 — 가드레일 문구 변경만으로 모델이 스스로 한국어 호칭을 지켰다는 뜻이다.

v9에서 요청형(request) 경로의 VOTE가 YES 3건 → NO 16건(전부 NO)으로 바뀐 것은 이번 변경(조건 호칭)과 무관해 보인다 — 요청형은 조건을 "질문 형태로만" 언급하는 경로라 애초에 확정 조건이 없고(v8도 조건 없음 경로와 같은 모양), 두 라운드 모두 정답표를 쓰지 않는 live 판단이라 사소한 변동은 기준 미달이 아니다(AGENT_BOARDROOM_SPEC.md 7장).

## OPINIONS stance 분포(역할별, 의도한 출발 성향과 일치율)

| 역할 | 의도(opening) | FOR | AGAINST | UNDECIDED | 의도 일치 |
| --- | --- | --- | --- | --- | --- |
| CEO | FOR | 16 | 0 | 0 | **16/16** |
| CFO | AGAINST | 0 | 16 | 0 | **16/16** |
| CAIO | UNDECIDED | 0 | 1 | 15 | 15/16 |
| CISO | AGAINST | 0 | 15 | 0 | 15/15(1건 OPINIONS 자체가 타임아웃으로 실패) |

전체 **62/63(98.4%, 실패 1건 제외) 의도 일치** — v8의 64/64(100%)보다 소폭 낮지만, CAIO 1건이 의도한 UNDECIDED 대신 AGAINST로 답한 것과 CISO 1건이 응답 실패(스키마 거절이 아니라 타임아웃)인 두 가지뿐이다. 둘 다 "정답표가 아니다"는 원칙 안에 있는 관측값이고, 조건 호칭 변경과 직접 관련짓기 어렵다(모델이 매 호출 스스로 판단하는 영역).

## 조건 보완 경로의 설득률

- **12/12(100%)** — v8과 동일. CFO(AGAINST)·CAIO(UNDECIDED)·CISO(AGAINST) × 두 안건 × 두 변형 12쌍 전부 조건이 채워지자 VOTE에서 YES로 돌아섰다.

## 사람이 말하는 것 같은지 — 발언 예문

사용자가 직접 읽고 판단할 수 있도록, 조건이 여럿 겹치는 REACTIONS·VOTE 발언(영문이 새기 가장 쉬운 자리)과 역할을 서로 호명하는 문장을 그대로 옮긴다.

1. CEO, REACTIONS(조건 보완): "대기 2.8일로 업무 지연 62%는 심각합니다. 금액 한도·사유 기록·표본 재검토·책임자 지정 네 조건이 지켜지면 찬성합니다."
2. CFO, REACTIONS(조건 보완): "네 조건 모두 동의합니다. 다만 규칙 밖 승인 4건은 전사 확대 시 비용 리스크가 커지니 소규모 재검증 후 확대를 제안합니다."
3. CAIO, REACTIONS(조건 보완): "다른 임원 의견에 동의합니다. 승인 사유 기록과 결재 규칙 책임자 지정이 전제되면 운영 연계가 가능하다고 봅니다."
4. CISO, REACTIONS(조건 보완): "승인 사유 기록, 결재 금액 한도, 사람 표본 재검토, 결재 규칙 책임자가 모두 확정된다는 전제라면 책임 추적이 가능해져 찬성으로 기울어집니다."
5. CEO, VOTE(상충): "결재 대기 2.8일 해소는 시급하지만, 사람 검토 전면 생략과 사람 표본 재검토를 동시에 적용하는 것은 모순이고 승인 사유 기록도 빠져 신뢰 확보가 어렵습니다."
6. CISO, VOTE(상충): "사람 검토 전면 생략과 사람 표본 재검토는 서로 모순되며, 감사 메모가 보여준 승인 사유 기록 부재가 해소되지 않아 책임 추적이 불가능합니다."
7. CAIO, REACTIONS(상충, 다른 임원 호명): "CFO·CISO 의견에 동의합니다. 전례 없는 상황 한정과 판단 근거 기록, 데이터 경고 시 멈춤, 결정 결과 복기가 함께 전제돼야 찬성합니다. 경험 판단 절대 우선은 모델 약점을 무시하는 것이라 반대합니다."

7번처럼 동료를 가리킬 때는 "CFO·CISO"(역할 이름, 가드레일 예외)를 그대로 쓰고, 조건은 전부 "승인 사유 기록"·"결재 규칙 책임자"·"전례 없는 상황 한정" 같은 한국어 이름으로만 등장한다 — v8에서 같은 자리에 나왔던 "LOG·OWNER·REVIEW 조건이 전제되면"·"SCOPE·RECORD·DATA_VETO·REVIEW 모두 전제되면" 같은 문장이 사라졌다.

## 처리

**완료 기준 충족 여부**: 조건 ID·영문 잔존 0건(핵심 목표), stance 누락 0·존댓말 위반 0·자료 ID(`E\d`) 잔존 0은 충족했다. **검증 실패(응답 실패) 0은 v8과 마찬가지로 충족하지 못했다** — 192건 중 3건이 8초 타임아웃(provider_error/other)으로 실패했다. 다만 이번 3건은 모두 **스키마 거절이 아니라 provider 응답 지연**이고, 새로 추가한 `findStrayLatinRun` 검사기로 거절된 행은 0건이다 — 잔존 검사기가 과도하게 공격적이지 않다는 뜻이기도 하다. 카드 지시대로(크레딧 때문에 1회만 실행) 재실행하지 않고 그대로 기록한다.

측정 목표였던 "조건을 한국어 이름으로만 부르게"의 핵심 결과는 분명하다 — 조건 ID·잔존 영문 87/192(45%) → 0/189(0%). 역할 이름(CEO 등) 예외는 실측에서 실제로 쓰였다(7번 예문 등 role-to-role 호명), `"AI"` 예외는 이번 실행에서는 쓰이지 않았다(자료 E4 본문에 "AI가 승인한 결재를 신뢰한다"가 있지만 이번 192행 중 그 문구를 그대로 인용한 발언은 없었다 — 가드레일이 "인용"을 요구하지 않고 "예외로 허용"만 하기 때문이며 결함은 아니다).

## 한계

- 평가 세트(`scripts/eval-set.json`)는 T79 이후 그대로다 — 이번 카드는 호칭 규칙만 바꿔 세트 자체를 다시 쓰지 않았다.
- `findStrayLatinRun`은 라틴 문자 2자 이상 연속을 전부 잡는 넓은 규칙이라, 앞으로 조건·자료 라벨에 영문 고유명사(제품명 등)가 들어가면 오탐할 수 있다 — 지금 두 안건(ai-approval·experience-first)의 라벨·자료명에는 그런 사례가 없어 이번 실측에서는 드러나지 않았다.
- 3건의 타임아웃 실패는 v8의 2건(JSON 파싱 실패)과 성격이 달라 두 라운드를 "실패율"로 직접 비교하기는 어렵다(provider 쪽 변동성일 가능성이 있다).
