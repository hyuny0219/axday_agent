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

## 처리

완료 기준 네 항목(검증 실패 0, stance 누락 0, `E\d` 잔존 0, 존댓말 위반 0) 모두 충족. stance는 필드 추가일 뿐 표결 판단 로직을 바꾸지 않아 VOTE 분포·문장 품질 지표가 v6과 동일하게 유지됐다. "OPINIONS stance와 최종 표의 일치율"은 카드 지시대로 기준을 세우지 않고 위 관측값만 남긴다.
