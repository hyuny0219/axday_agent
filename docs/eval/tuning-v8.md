# 임원 에이전트 고도화 — 튜닝 라운드 v8 (T79, 안건별 임원 렌즈 + 첫 의견 출발 성향)

- 대상: `server/scenario-data.ts`(`ScenarioRoleLens`, `roleLenses` 안건별 데이터), `server/prompts/roles/index.ts`(`buildRoleLensBlock`·`buildOpeningStanceBlock`, `ROLE_PROMPT_BUILDERS` 시그니처에 `materials`·`stage` 추가), `server/handlers/round.ts`·`server/handlers/vote.ts`(호출부 변경), `server/prompts/version.ts`(v7 → v8)
- 평가 세트: `scripts/eval-set.json`(16케이스 = 안건 2개 × 네 경로(조건 없음·조건 보완·상충·요청형) × 변형 2종, T78 안건 교체 이후 재작성) · 실행기 `scripts/eval-set-run.ts`
- provider: anthropic · modelId: claude-sonnet-5
- before 기록: 없음 — 이전 세트(anon-board, `docs/eval/tuning-v7-after3.jsonl`)는 지금 비활성 안건 기준이라 직접 비교할 수 없고, 카드 지시대로 크레딧 여유가 없어 v7 기준 전후비교는 생략하고 after만 남긴다.
- after 기록: `docs/eval/tuning-v8-after.jsonl`(promptVersion=v8, 192행, **190행 응답·2행 실패**) — 이 카드의 변경(안건별 임원 렌즈·OPINIONS 전용 출발 성향) 반영 후, 안건 교체(T78) 이후 처음으로 실제 키 측정.

## 왜 v8 라운드를 돌았는가

2026-10-02 사용자 결정: live에서도 임원 네 명의 첫 의견이 **찬성 1 · 반대 2 · 미정 1**로 균형 있게 갈리고 각자 특성이 드러나야 한다. T78(안건 교체) 이후에는 역할 프롬프트(`roles/ceo.ts` 등)가 안건 독립적인 일반 판단 기준만 담고 있어, OPINIONS 단계에서 네 명이 비슷한 방향으로 쏠릴 위험이 있었다(옛 v7 측정은 CEO·CFO·CAIO가 UNDECIDED 위주였다). 그래서 안건마다 "각 임원이 무겁게 보는 관점·자료"(`<role_lens>`, 모든 발언·표결 단계)와 "OPINIONS 단계에 한정한 출발 성향"(`<opening_stance>`, 첫 의견에만)을 프롬프트에 추가했다. 두 블록 모두 발언 문장·최종 표를 대신 정하지 않는다 — 정답표 금지 원칙(`AGENT_BOARDROOM_SPEC.md` 1·2장)은 그대로다.

## 무엇을 고쳤는가

- `server/scenario-data.ts`: `ScenarioRoleLens`(`lens`·`evidenceIds`·`opening`) 타입과 `ScenarioMaterials.roleLenses?`를 추가하고, `ai-approval`·`experience-first` 두 안건에 카드가 지정한 문구(CEO 찬성 쪽·CFO 반대 쪽·CAIO 미정·CISO 반대 쪽)를 그대로 채웠다.
- `server/prompts/roles/index.ts`: `buildRoleLensBlock()`(`<role_lens>`, 관점 한 줄 + 자료명)과 `buildOpeningStanceBlock()`(`<opening_stance>`, "출발점이지 결론이 아니며 … 바꿀 수 있습니다")을 추가하고, `withExecStyle()`이 `materials`·`stage`를 받아 role_lens는 모든 단계에, opening_stance는 `stage === 'OPINIONS'`일 때만 덧붙이도록 바꿨다. `EXEC_DECISION_RULE`과 같은 자리(임원 전용 조합)에 둬서 `prompts/assistant.ts`(refine·summarize)에는 전달되지 않는다.
- `server/handlers/round.ts`·`server/handlers/vote.ts`: `ROLE_PROMPT_BUILDERS[roleId]()` 호출부를 `ROLE_PROMPT_BUILDERS[roleId](materials, stage)`로 바꿨다(round는 `input.stage` 그대로, vote는 항상 `'VOTE'`).
- `server/prompts/version.ts`: `PROMPT_VERSION` v7 → v8.
- `tests/server/roleLens.test.ts`(신규): OPINIONS 프롬프트에 `<role_lens>`·`<opening_stance>` 둘 다, REACTIONS·FOLLOWUP·VOTE에는 `<role_lens>`만(둘 다 포함하지 않음 단언 포함), 비서실장 refine·summarize 프롬프트에는 둘 다 없음, 두 안건 모두 역할별 렌즈 문구가 실제로 들어가는지를 확인한다(6개 테스트).
- `scripts/eval-set.json`·`scripts/eval-set-run.ts`: 세트를 두 안건 기준 16케이스로 재작성(아래 "평가 세트 재작성" 절). `EvalCase`·`EvalRow`에 `scenarioId`를 추가하고, `openingStanceByRole()`(OPINIONS stance 분포·의도 일치율)과 `conditionSupplementPersuasion()`(조건 보완 경로의 반대·미정 임원 설득률)을 새로 추가해 `--check` 출력에 포함시켰다.

## 평가 세트 재작성

이전 세트(`docs/eval/tuning-v1~v7`)는 안건 `anon-board`(상충·부정·조건 없음·조건 보완 × 변형 3개 = 12케이스) 기준이었고, T78이 그 안건을 레지스트리에서 뺐다. 새 세트는:

- 안건별(`ai-approval`·`experience-first`) 네 경로 × 변형 2개 = 8케이스, 두 안건 합쳐 16케이스.
- 경로명을 "부정" → "요청형"으로 바꿨다(카드 지시). 네 경로는 조건 없음(`effectiveConditionIds: []`) / 조건 보완(아래) / 상충(서로 반대 방향인 조건 2개를 동시에 요구) / 요청형(조건 1개만 질문 형태로 요청).
- "조건 보완" 경로의 조건 조합은 `src/content/scenarios/aiApproval.ts`·`experienceFirst.ts`의 scripted `voteRules`에서 **네 임원이 모두 YES로 갈리는 조합**을 그대로 가져왔다 — ai-approval은 `LIMIT·REVIEW·LOG·OWNER`, experience-first는 `SCOPE·RECORD·DATA_VETO·REVIEW`. scripted 표결표 자체는 live 프롬프트에 들어가지 않는다(정답표 금지) — 여기서는 평가 세트의 참가자 발언만 결정하는 데 썼다.
- "상충" 경로는 ai-approval에서 `FULL_AUTO`(사람 검토 전면 생략)와 `REVIEW`(사람 표본 재검토)를 동시에 요구(논리적으로 상충), experience-first에서 `EXP_ONLY`(경험 절대 우선)와 `DATA_VETO`(데이터 경고 시 멈춤)를 동시에 요구.

## 측정 결과 (after, 192행 = 16케이스 × 4역할 × 3단계)

| 항목 | 값 |
| --- | --- |
| 응답 / 실패 | **190 / 2** |
| 실패 상세 | `experience-first/conflict-2`(상충, 구어체) VOTE 단계의 CFO·CAIO 2건, `failReason=provider_error`·`providerErrorClass=invalid_response`(`anthropic_invalid_json`/`anthropic_no_text_block` 계열 — 모델 응답이 파싱 가능한 JSON이 아니었던 provider 수준 오류, Zod 스키마 불일치가 아니다) |
| 안건별 | ai-approval 96/96 응답(실패 0) · experience-first 94/96 응답(실패 2, 위 두 건) |
| stance 누락(OPINIONS·REACTIONS answered 기준) | 0건 |
| 존댓말 종결 위반 | 0건 |
| 문장 속 자료 ID(`E\d`) 잔존 | 0건 |
| 문장 길이 최대 (message / reason) | 102자 / 130자(한도 120·160 안) |
| 지연(answered 기준) 중앙값 / 최대 | 3209ms / 6569ms |
| 라운드·표결 8초 초과 | 0/190 |
| VOTE 분포(경로별, answered 기준) | 조건 없음 YES 0·NO 16 / 조건 보완 YES 16·NO 0 / 상충 YES 1·NO 13(2건 실패 제외, 14행) / 요청형 YES 3·NO 13 |

## OPINIONS stance 분포(역할별, 의도한 출발 성향과 일치율) — 64건(16케이스 × 4역할)

| 역할 | 의도(opening) | FOR | AGAINST | UNDECIDED | 의도 일치 |
| --- | --- | --- | --- | --- | --- |
| CEO | FOR | 16 | 0 | 0 | **16/16** |
| CFO | AGAINST | 0 | 16 | 0 | **16/16** |
| CAIO | UNDECIDED | 0 | 0 | 16 | **16/16** |
| CISO | AGAINST | 0 | 16 | 0 | **16/16** |

안건별로 쪼개도 같다(ai-approval 8/8, experience-first 8/8 — 역할마다). 전체 **64/64(100%) 의도 일치**: 16케이스 전부에서 CEO가 FOR, CFO·CISO가 AGAINST, CAIO가 UNDECIDED로 시작했다. 카드 목표("찬성 1 · 반대 2 · 미정 1")가 모든 케이스에서 그대로 재현됐다.

참고로 REACTIONS 단계(64건, 참가자 의견을 들은 뒤)는 FOR 42 · AGAINST 22 · **UNDECIDED 0** — OPINIONS에서 UNDECIDED였던 CAIO 16건 전부가 REACTIONS에서는 FOR/AGAINST로 방향을 정했다.

## OPINIONS stance–최종 표 일치(비교 가능 쌍, 관측값·기준 없음)

`stanceVoteAgreement()`로 같은 케이스·역할의 OPINIONS stance(FOR/AGAINST만, UNDECIDED는 비교 대상에서 뺀다)와 VOTE vote(YES/NO)를 비교하면 **29/47**이다. OPINIONS에서 FOR/AGAINST로 답한 행은 48건(CEO FOR 16 + CFO AGAINST 16 + CISO AGAINST 16, CAIO의 UNDECIDED 16건은 처음부터 제외)인데, 그중 CFO 1건이 VOTE 단계에서 실패해 비교 가능한 쌍이 47건으로 줄었다. 조건 보완 경로의 설득률이 100%(아래)라는 점과 맞물려, "첫 의견이 반대였어도 조건이 채워지면 찬성으로 바뀐다"는 체험 구조와 일치하는 관측값이다. 기준을 세우지 않는다(v7과 같은 원칙).

## 조건 보완 경로의 설득률 — 반대·미정 임원이 VOTE에서 YES로 돌아서는 비율

`conditionSupplementPersuasion()`: 조건 보완 경로(`pathId=condition_supplement`)에서 의도한 출발 성향이 AGAINST 또는 UNDECIDED인 (케이스, 역할) 쌍 가운데 최종 표가 YES인 비율.

- **12/12(100%)** — CFO(AGAINST)·CAIO(UNDECIDED)·CISO(AGAINST) 세 역할 × 두 안건 × 두 변형 = 12쌍 전부 조건이 채워지자 찬성으로 돌아섰다.
- 같은 경로에서 CEO(의도 FOR, 이미 찬성 쪽)를 더하면 16/16 전원 YES — 위 "VOTE 분포" 표의 조건 보완 YES 16·NO 0과 일치한다.

## 처리

**완료 기준 충족 여부**: stance 누락 0·존댓말 위반 0·`E\d` 잔존 0은 충족했으나 **검증 실패(응답 실패) 0은 충족하지 못했다** — 192건 중 2건(`experience-first/conflict-2` VOTE의 CFO·CAIO)이 provider 수준 오류(`invalid_response` 계열)로 실패했다. 카드 지시대로(평가 세트는 크레딧 때문에 1회만 실행) **재실행하지 않고 이 실패를 그대로 기록한다**. 두 실패 모두 같은 케이스(상충 경로, 조건이 서로 충돌하는 구어체 변형)의 VOTE 단계에 몰려 있어 프롬프트 내용 자체(role_lens·opening_stance)가 원인인지, 해당 호출 두 건의 일시적 API 응답 문제인지는 이 표본만으로 가를 수 없다 — 나머지 190건은 모두 정상 응답했고 같은 경로의 다른 변형(conflict-1)·다른 역할(CEO·CISO)은 실패하지 않았다.

측정 목표였던 "안건별 임원 렌즈 + 첫 의견 출발 성향"의 핵심 결과는 분명하다 — OPINIONS stance 의도 일치 64/64(100%), 조건 보완 경로 설득률 12/12(100%). v7(이전 안건 기준)에서는 OPINIONS stance가 48건 중 FOR 13·AGAINST 20·UNDECIDED 15로 흩어졌던 것과 달리, v8은 안건이 바뀌어도 역할마다 의도한 방향으로 정확히 갈린다. REACTIONS 단계에서 UNDECIDED가 전부 사라지는 패턴(v7 after3와 동일)도 재확인했다.
