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

## 서버·화면 방어 (Codex 53차)

프롬프트만으로는 모델이 규칙을 어길 수 있어 서버가 FOLLOWUP 응답의 방향 단어를 같은 함수(`src/domain/verdictWords.ts`)로 검사한다. 걸리면 1회 재시도, 그래도 걸리면 역할별 중립 문장으로 대체하고 로그 note에 `followup_verdict_masked`를 남긴다. live 실측 때 이 note 건수(= 프롬프트가 규칙을 못 지킨 횟수)도 함께 센다. 화면 회의록도 MOTION·VOTE에서 한 번 더 가린다.

## 동의어 확장과 원시 위반 보존 (Codex 54차)

- **검사 범위 확장**: 방향 표현 검사는 `src/domain/verdictWords.ts`의 정규식 배열(패턴마다 금지 이유 주석)이다. 찬반·가부 단어에 더해 "지지하겠습니다"·"표를 보태겠습니다"·"손을 들겠습니다"·"같은 편"·"저는 …쪽" 같은 선언 꼴을 잡고, "자동 승인 사유" 같은 안건 용어와 "표결에서 밝히겠습니다"는 걸리지 않게 서술어가 붙은 꼴만 본다. 임원 FOLLOWUP 발언 전용이다. 프롬프트 v13 규칙에도 "지지·동의·같은 편·표를 보탠다 등 어떤 표현으로도 방향을 밝히지 말고 답변 평가·남은 우려만"을 넣었다(버전은 v13 유지).
- **원시 데이터 보존**: 서버는 재시도·중립 대체 뒤에는 위반 원문이 사라지므로, `handleRound`의 내부 수집기(`followUpAudit`, 클라이언트 응답에는 실리지 않음)로 시도별 원문과 위반 건수를 받는다. 평가 행에는 `followUpRawAttempts`·`followUpViolations`·`followUpMasked`가 남는다.
- **요약 지표** (`--check` 출력): `FOLLOWUP 최종 발언 방향 표현`(대체 뒤 문장, 정상이면 0), **원시 위반율**(첫 시도 원문에 방향 표현이 있던 행 비율 = 프롬프트가 규칙을 못 지킨 비율), **대체율**(재시도 뒤에도 남아 중립 문장으로 바뀐 행 비율). live 실측에서는 원시 위반율이 핵심 지표이고, 대체율이 0에 가까워야 한다.

## 평가 행 필드 (Codex 55·56차)

- `followUpAttempts`: `[{text, violations: string[], invalidReason?}]` — 시도별 원문과 걸린 표현, 형식 오류 사유(`schema`·`role_mismatch`·`foreign_condition`). 다른 필드가 검증에 실패한 시도도 message 문자열이 있으면 남는다. `followUpRawAttempts`·`followUpViolations`는 이 배열의 호환용 요약이다. `followUpMasked`는 중립 대체 여부다.
- 원시 위반율·대체율의 분모는 **원문 시도가 1개 이상 있는 FOLLOWUP 행**이다(최종 failed 포함). 타임아웃·연결 오류로 원문이 없는 행은 "원문 없음(장애)" 건수로 따로 표시하고 분모에서 뺀다. 요약에는 형식 오류 시도의 사유별 건수도 나온다.
