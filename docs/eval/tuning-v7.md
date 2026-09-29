# 임원 에이전트 고도화 — 튜닝 라운드 v7 (T63, stance 필드 추가)

- 대상: `server/validate.ts`(`STANCE_VALUES`, `statementResponseSchema`에 `stance` 필수 필드), `server/handlers/round.ts`(응답 JSON 스키마에 `stance` 추가), `server/prompts/common.ts`(가드레일에 stance 지시 추가), `server/prompts/version.ts`(v6 → v7), `server/providers/mock.ts`(고정 stance), `src/domain/types.ts`(`Stance`, `Statement.stance`)
- 평가 세트: `scripts/eval-set.json`(12케이스) · 실행기 `scripts/eval-set-run.ts`
- provider: anthropic · modelId: claude-sonnet-5
- before 기록: `docs/eval/tuning-v7-before.jsonl`(promptVersion=v6, 144행) — stance 필드가 없던 T62 상태(커밋 전 상태를 `git stash`로 되돌려 실행).
- after 기록: `docs/eval/tuning-v7-after.jsonl`(promptVersion=v7, 144행) — 이 카드의 변경(stance 필드 추가) 반영 후 측정.

## 왜 v7 라운드를 돌았는가

2026-09-29 사용자 결정: "AI 임원들이 안건을 보고 느낀 감정을 항상 표시하고, 마지막에 설득되어 내가 선택한 표가 과반수 이상이면" 추가 도장을 찍는다(`docs/TASKS.md` T63). 무대 표정 배지·"설득 도장"은 domain/stance.ts의 순수 함수(scripted는 표결 규칙표로 미리 계산)로 구현했지만, live는 임원이 각 발언 끝에 스스로 밝힌 stance가 있어야 무대에 실을 수 있다. 응답 스키마가 필드 하나(`stance`)만큼 바뀌므로 `PROMPT_VERSION`을 v6 → v7로 올린다.

## 무엇을 고쳤는가

- `server/validate.ts`: `STANCE_VALUES = ['FOR','AGAINST','UNDECIDED']` 추가, `statementResponseSchema`에 `stance: z.enum(STANCE_VALUES)` 필수 필드 추가(`.strict()`라 누락·오탈자 값은 그대로 거절된다).
- `server/handlers/round.ts`: `STATEMENT_JSON_SCHEMA`의 `required`·`properties`에 `stance` 추가.
- `server/prompts/common.ts`: `buildCommonGuardrails()`에 "발언 끝에 지금 기울어 있는 쪽을 stance 필드로 적으십시오. … 아직 조건이 갖춰지지 않아 판단을 유보하면 UNDECIDED로 적으십시오" 지시를 추가.
- `server/providers/mock.ts`: `ROLE_STANCE`(CEO·CAIO FOR, CFO·CISO AGAINST — 기존 `ROLE_VOTE`와 같은 방향)를 추가해 mock 발언에 실어 보낸다.
- `server/prompts/version.ts`: `PROMPT_VERSION` v6 → v7.
- `src/domain/types.ts`·`src/domain/stance.ts`: `Stance` 타입, `Statement.stance?`, `liveStances()`(transcript의 가장 최근 발언 stance)·`scriptedStances()`(표결 규칙표로 미리 계산)·`persuasionStamp()`(3석 판정) 순수 함수.

## 전후 비교 (both 144행)

| 항목 | before(v6) | after(v7) | 판정 |
| --- | --- | --- | --- |
| 검증 실패·호출 실패(status=failed) | 0건 | 0건 | 유지 — 완료 기준 충족 |
| stance 누락(OPINIONS·REACTIONS answered 기준) | (필드 없음, 해당 없음) | 0건 | 완료 기준 충족 — 스키마가 필수로 요구한 값이 매 응답에 실제로 들어왔다 |
| 발언 문장(message·reason)에 `E\d` 패턴 잔존 | 0건 | 0건 | 유지 — 완료 기준 충족 |
| 존댓말 종결 위반 | 0건 | 0건 | 유지 — 완료 기준 충족 |
| VOTE 응답의 `vote` 값 분포(48건) | YES 12 · NO 36 | YES 12 · NO 36 | 동일 — stance 필드 추가가 표결 판단 자체를 바꾸지 않았다 |
| 문장 길이 message / reason 최대 | 106자 / 126자 | 94자 / 110자 | 유지(한도 120·160 안) |
| 라운드당 8초 초과 | 0/144 | 0/144 | 유지 — 완료 기준 충족 |
| 지연 최대(answered 기준) | 6568ms | 6417ms | 유지 |

## OPINIONS stance와 최종 표의 일치율 — 관측값(기준 없음)

카드가 지정한 대로 기준을 새로 못 박지 않고 관측값만 남긴다. `stanceVoteAgreement()`(`scripts/eval-set-run.ts`)로 같은 케이스·역할의 OPINIONS stance(FOR/AGAINST만, UNDECIDED는 비교 대상에서 뺀다)와 VOTE의 vote(YES/NO)를 비교했다.

- **OPINIONS stance 분포(48건 = 12케이스 × 4역할):** UNDECIDED 44 · AGAINST 4(CISO만 4건) · FOR 0. CEO·CFO·CAIO는 12케이스 모두 UNDECIDED, CISO만 4케이스에서 AGAINST를 냈다.
- **REACTIONS stance 분포(48건):** UNDECIDED 20 · AGAINST 23 · FOR 5 — 참가자 의견·후속 답이 들어온 뒤에는 더 많은 임원이 FOR/AGAINST로 입장을 밝혔다.
- **비교 가능 쌍(OPINIONS stance가 FOR/AGAINST인 경우만):** 4건 중 2건 일치(AGAINST→NO), 2건 불일치(AGAINST인데 최종 YES) — `runCheck` 출력 그대로 "OPINIONS stance-최종 표 일치 2/4".
- **해석(관측, 결론 아님):** 이번 평가 세트 참가자 발언은 아직 조건 논의가 없는 첫 의견 단계라 임원 대부분이 "판단을 유보"(UNDECIDED)로 답했다. stance가 FOR/AGAINST로 나온 4건 중 절반만 최종 표와 맞았다는 점에서, OPINIONS 시점의 stance를 "이 임원이 이미 마음을 정했다"는 신호로 쓰기는 이르다. T59(말투·판단 기준 튜닝)에서 이 값을 더 쌓아 판단할 문제로 남긴다.

## after2 — 표결·stance 지시를 공통 가드레일에서 임원 전용 규칙으로 이동(PR #11 Codex 10차 P2)

공통 가드레일(`buildCommonGuardrails`)은 비서실장 refine·summarize에도 들어가므로, "찬성·반대 중 하나를 고르라"·"stance를 적으라" 지시가 참가자 원문 정리·회의 요약에까지 전달되던 것을 `server/prompts/roles/index.ts`의 `EXEC_DECISION_RULE`로 옮겼다(round·vote 임원 호출에만 붙는다). 같은 v7로 다시 쟀다(`tuning-v7-after2.jsonl`, 144행, 실패 0).

| 항목 | after(v7) | after2(이동 후) |
| --- | --- | --- |
| 검증 실패 / stance 누락 / `E\d` 잔존 / 존댓말 위반 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| VOTE 분포 | YES 12 · NO 36 | YES 12 · NO 36(경로별 동일) |
| OPINIONS stance | UNDECIDED 44 · AGAINST 4 · FOR 0 | UNDECIDED 43 · AGAINST 5 · FOR 0 |
| REACTIONS stance | UNDECIDED 20 · AGAINST 23 · FOR 5 | UNDECIDED 22 · AGAINST 14 · FOR 12 |
| 문장 길이 최대 / 지연 중앙값·최대 / 8초 초과 | 94·110자 / — / 0 | 98·119자 / 3971·5053ms / 0 |

이동 자체는 임원 판단·품질을 바꾸지 않았다. 비서실장 경로는 이 평가 세트가 재지 않으므로(round·vote만), 분리 효과는 구조로 보장한다.

## after3 — "첫 의견부터 방향을 밝히라"로 stance 지시 수정(전수 재측정 144행, 실패 0)

OPINIONS stance가 after·after2에서 48건 중 43~44건 UNDECIDED라, live에서 임원 의견 단계의 표정 배지가 거의 전부 "생각 중"으로 나올 상황이었다(T63의 취지 — 조건을 붙이기 전에 누가 반대인지 보이게 — 가 살지 않는다). `EXEC_DECISION_RULE`의 stance 문장을 "첫 의견부터 방향을 밝히고, 우려가 남아도 지금 표결한다면 어느 쪽인지 정하라. UNDECIDED는 자료로 어느 쪽도 말할 수 없을 때만 쓰고 그때는 무엇이 확인돼야 하는지 적으라"로 고쳤다. 첫 실행은 크레딧 소진으로 중단됐고, 두 번째 실행은 응답 실패 5행(provider_error 4·invalid_response 1)이 있어 "검증 실패 0"에 어긋났다(PR #11 Codex 11차 P2). 같은 최종 문구로 세 번째 실행해 **144행 전부 응답, 실패 0**을 확보했다(`tuning-v7-after3.jsonl`은 이 세 번째 기록이다).

| 항목 | after2 | after3(최종 문구, 실패 0) |
| --- | --- | --- |
| 응답 실패 / stance 누락 / `E\d` 잔존 / 존댓말 위반 | 0 / 0 / 0 / 0 | **0 / 0 / 0 / 0** |
| VOTE 분포(48건) | YES 12 · NO 36 | YES 12 · NO 36 — 조건 보완 12/12 YES, 상충·부정·조건 없음 36/36 NO(경로별 판단 동일) |
| **OPINIONS stance(48건)** | UNDECIDED 43 · AGAINST 5 · FOR 0 | **FOR 13 · AGAINST 20 · UNDECIDED 15** — 방향 표명 5/48(10%) → 33/48(69%) |
| 역할별 OPINIONS | — | CEO FOR 12·AGAINST 0·UNDECIDED 0 / CFO FOR 1·AGAINST 4·UNDECIDED 7 / CAIO FOR 0·AGAINST 4·UNDECIDED 8 / CISO FOR 0·AGAINST 12·UNDECIDED 0 |
| REACTIONS stance(48건) | UNDECIDED 22 · AGAINST 14 · FOR 12 | AGAINST 31 · FOR 17 · **UNDECIDED 0** |
| OPINIONS stance–최종 표 일치(비교 가능 쌍) | — | 20/33 |
| 문장 길이 최대 / 지연 중앙값·최대 / 8초 초과 | 98·119자 / 3971·5053ms / 0 | 102·113자 / 4113·5060ms / 0 |

읽기: 첫 의견 단계에서 CEO는 방향 쪽, CISO는 위험 쪽으로 기울고 CFO·CAIO는 절반쯤 유보한다 — 무대에서 "누가 반대인지"가 처음부터 보이고, 참가자 의견이 들어온 뒤(REACTIONS)에는 넷 다 방향을 밝힌다. OPINIONS stance와 최종 표의 일치 20/33은 "처음 입장이 조건에 따라 바뀐다"는 체험 구조와 어긋나지 않는 관측값이다(기준 없음). 앞선 실행의 invalid_response 1건은 재현되지 않았다.

## 처리

(after 기준) 완료 기준 네 항목(검증 실패 0, stance 누락 0, `E\d` 잔존 0, 존댓말 위반 0) 모두 충족. after2(규칙 이동)도 동일하게 충족. after3(최종 stance 문구, 전수 재측정 144행)는 **실패 0**·stance 누락 0·`E\d` 0·존댓말 0, VOTE 판단 동일, OPINIONS 방향 표명 10%→69%. 완료 기준 네 항목 모두 최종 문구 기준으로 충족. stance는 필드 추가일 뿐 표결 판단 로직을 바꾸지 않아 VOTE 분포·문장 품질 지표가 v6과 동일하게 유지됐다. "OPINIONS stance와 최종 표의 일치율"은 카드 지시대로 기준을 세우지 않고 위 관측값만 남긴다.
