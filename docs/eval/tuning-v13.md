# 임원 에이전트 고도화 — 튜닝 라운드 v13 (T114, 답변 뒤 방향 봉인) — 초안

- 대상: `server/prompts/common.ts`(`FOLLOWUP_NO_VERDICT_RULE` 신설), `server/handlers/round.ts`(FOLLOWUP 단계 지시에 연결), `server/providers/mock.ts`(FOLLOWUP 발언을 방향 없는 문장으로), `server/prompts/version.ts`(v12 → v13). 응답 스키마는 그대로다.
- provider: **mock 단위·통합 테스트만 돌렸다. live 실측(`npm run eval:live`)은 하지 않았다** — 크레딧을 쓰므로 사용자 승인 뒤에 돌린다. 이 문서는 "무엇을 검사할지"의 초안이다.

## 왜 v13 라운드인가

2026-10-09 사용자 지시: "답하기 후 AI 임원들의 찬반 방향을 몰라야 결과가 더 극적". 화면은 답변 뒤(MOTION·VOTE) 임원 입장을 봉인하고 결과 화면에서 한 장씩 공개한다. 그런데 live FOLLOWUP 발언 문장에 "찬성합니다"가 섞이면 회의록·말풍선으로 방향이 새 버린다.

## 바꾼 것

- FOLLOWUP 지시 한 문단 추가: 답변에 대한 평가·소회만 말하고 최종 찬반·표결 방향을 문장으로 밝히지 말 것(예: "찬성합니다", "반대로 남겠습니다", "찬성표를 던지겠습니다"). `stance` 필드에는 지금 기울어 있는 쪽을 정직하게 적는다(화면에서만 가림).
- 그 밖의 지시(OPINIONS·REACTIONS·VOTE, v12 두 단계 설득 규칙)는 바꾸지 않았다.

## 확인한 것 (mock·단위)

- `tests/server/round.test.ts`: 프롬프트 버전 v13, FOLLOWUP 시스템 프롬프트에만 금지 규칙이 들어가고 OPINIONS·REACTIONS에는 없음, mock FOLLOWUP 발언에 "찬성"·"반대" 단어 없음.

## live 실측 때 검사할 항목 (승인 뒤)

`scripts/eval-set.json` 22케이스의 FOLLOWUP 행(22 × 4역할 = 88행)에 대해:

| 검사 | 기준 |
| --- | --- |
| FOLLOWUP 발언 `message`에 방향 선언 단어 없음 — `찬성합니다`·`찬성하겠습니다`·`반대합니다`·`반대로 남`·`찬성표`·`반대표`·`찬성 쪽`·`반대 쪽` 정규식 | 0건이 목표 (일반 명사로 "찬성 의견이 있었다" 같은 문장은 사람이 읽어 판정) |
| `stance` 필드는 여전히 채워짐 | 누락 0건 (화면에서만 가리므로 필수) |
| v12 기준선 유지: 존댓말 위반·자료 ID 잔존·조건 ID 잔존 | 0건 |
| 설득 두 단계 동작(REACTIONS는 UNDECIDED까지, FOLLOWUP 확정) | v12 결과와 같은 수준 |
| 발언이 너무 밋밋해지지 않는지(평가·소회가 실제 내용을 담는가) | 샘플 8개를 사람이 읽고 기록 |

실행: `npx tsx scripts/eval-set-run.ts --out docs/eval/tuning-v13-after.jsonl` (사용자 승인 뒤). 집계 후 이 문서의 결과 절을 채운다.
