# 프롬프트 v22 실측(대표 4케이스) — 반대 입장 첫 의견 균형 + 처음 입장 교체(T138)

- 변경: OPINIONS에 처음 입장을 stance 필드로 단정하는 지시, 첫 반응 MAY_CROSS("UNDECIDED로 적을 것")·KEEP("처음 입장 {값} 그대로")을 단정형으로, 모델이 어기면 서버가 stance만 규칙표 분류대로 교정(`stance_clamped`, 문장이 "찬성합니다·반대합니다" 같은 절대 방향을 밝히면 제외, "동의합니다" 같은 상대적 표현은 선언으로 보지 않는다). 반대 쪽 함정 제거. 처음 입장 교체(CISO 반대·CFO 고민 중)와 반대 쪽 조건 재배치.
- 실측: `scripts/eval-set-run.ts --out docs/eval/tuning-v22-after.jsonl --case ai-approval/opposition_conditional-1 --case ai-approval/opposition_ceo-1 --case experience-first/opposition_conditional-1 --case ai-approval/condition_supplement-1`(live, claude-sonnet-5), 2026-10-17, 한 번. 케이스: 안건 ① 반대 조건 2개(AG_AUDIT+AG_SCALE → CAIO·CFO를 겨눔), 안건 ① CEO를 겨눈 조건(AG_TRUST), 안건 ② 반대 조건 2개(AG_WARN+AG_SPLIT → CFO·CAIO), 찬성 확인용(안건 ① 조건 보완, 조건 4개).
- 분류·기대는 `classifyFirstReaction`·`decideMember`로 계산했다(규칙표 방향 지시와 같은 기준).

| 케이스 | 임원 | OPINIONS | 첫 반응 [분류 → 기대] | 최종표 [규칙표] |
|---|---|---|---|---|
| ① 반대 · AG_AUDIT+AG_SCALE | CEO | 찬성 | 찬성 [KEEP → 찬성] | 찬성 [찬성] |
|  | CFO | 고민 중 | 고민 중 [MAY_CROSS → 고민 중] | 반대 [반대] |
|  | CAIO | 고민 중 | (응답 실패) | 반대 [반대] |
|  | CISO | 반대 | 반대 [SAME_SIDE → 반대] | 반대 [반대] |
| ② 반대 · AG_WARN+AG_SPLIT | CEO | 찬성 | 찬성 [KEEP → 찬성] | 찬성 [찬성] |
|  | CFO | 고민 중 | 고민 중 [MAY_CROSS → 고민 중] | 반대 [반대] |
|  | CAIO | 고민 중 | 고민 중 [MAY_CROSS → 고민 중] | 반대 [반대] |
|  | CISO | 반대 | 반대 [SAME_SIDE → 반대] | 반대 [반대] |
| ① 반대 · AG_TRUST(CEO를 겨눔) | CEO | 찬성 | 고민 중 [MAY_CROSS → 고민 중] | 반대 [반대] |
|  | CFO | 고민 중 | 고민 중 [KEEP → 고민 중] | 찬성 [찬성] |
|  | CAIO | 고민 중 | 고민 중 [KEEP → 고민 중] | 찬성 [찬성] |
|  | CISO | 반대 | 반대 [SAME_SIDE → 반대] | 반대 [반대] |
| ① 찬성 확인(조건 4개) | CEO | 찬성 | 찬성 [SAME_SIDE → 찬성] | 찬성 [찬성] |
|  | CFO | 고민 중 | (응답 실패) | 찬성 [찬성] |
|  | CAIO | 고민 중 | 고민 중 [MAY_CROSS → 고민 중] | 찬성 [찬성] |
|  | CISO | 반대 | 고민 중 [MAY_CROSS → 고민 중] | 찬성 [찬성] |

- OPINIONS: 16/16이 처음 입장(찬성·고민 중·고민 중·반대)과 일치(이전 실측에서는 CISO가 "반대"로 나오던 문제가 처음 입장 교체로 방향이 바뀐 뒤에도 단정 지시로 안정적이다).
- 첫 반응: 응답이 온 14개가 모두 규칙표 분류 기대와 일치한다(MAY_CROSS는 기울기만, KEEP·SAME_SIDE는 처음 입장 유지). 응답 실패 2개(provider_error)는 판정 불가.
- 최종표: 응답이 온 16개가 모두 규칙표와 같다(반대 경로 12개 + 찬성 확인 4개).
- 금지 어휘 1건("책임 소재", 자유 발언 1행).
