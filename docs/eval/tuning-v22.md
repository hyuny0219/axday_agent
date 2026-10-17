# 프롬프트 v22 실측(대표 3케이스) — 반대 입장 첫 의견 균형(T138)

- 변경: OPINIONS에 처음 입장을 stance 필드로 단정하는 지시, 첫 반응 MAY_CROSS("UNDECIDED로 적을 것")·KEEP("처음 입장 {값} 그대로")을 단정형으로, 모델이 어기면 서버가 stance만 규칙표 분류대로 교정(`stance_clamped`, 문장이 "찬성합니다·반대합니다" 같은 절대 방향을 밝히면 제외). 반대 쪽 함정 조건 제거.
- 실측: `scripts/eval-set-run.ts --out docs/eval/tuning-v22-after.jsonl --case ai-approval/opposition_conditional-1 --case ai-approval/opposition_ceo-1 --case experience-first/opposition_conditional-1`(live, claude-sonnet-5), 2026-10-17, 한 번. 서버 교정은 두 번째 수정 전 실행이라 아래 값은 교정 보강(상대적 "동의합니다" 허용) **이전**이다 — 보강 효과는 단위 테스트(`tests/server/stanceClamp.test.ts`)로 확인했다.

| 케이스(참가자 반대) | 임원 | OPINIONS | 첫 반응 | 규칙표 첫 반응 분류 → 기대 | 최종표 | 규칙표 표 |
|---|---|---|---|---|---|---|
| ① 조건 2개(AG_AUDIT+AG_TRUST) | CEO | 찬성 | 찬성 | KEEP → 찬성 | 찬성 | 찬성 |
|  | CFO | 반대 | 반대 | SAME_SIDE → 반대 | 반대 | 반대 |
|  | CAIO | 고민 중 | 고민 중 | MAY_CROSS → 고민 중 | 반대 | 반대 |
|  | CISO | 고민 중 | 고민 중 | MAY_CROSS → 고민 중 | 반대 | 반대 |
| ② 조건 2개(AG_WARN+AG_WHY) | CEO·CFO·CAIO·CISO | 찬성·반대·고민 중·고민 중 | 찬성·반대·고민 중·고민 중 | 모두 일치 | 찬성·반대·반대·반대 | 모두 일치 |
| ① CEO를 겨눈 조건(AG_SCALE) | CEO | 찬성 | 고민 중 | MAY_CROSS → 고민 중 | 반대 | 반대 |
|  | CFO | 반대 | 반대 | SAME_SIDE → 반대 | 반대 | 반대 |
|  | CAIO | 고민 중 | 고민 중 | KEEP → 고민 중 | **반대** | 찬성 (불일치) |
|  | CISO | 고민 중 | **반대** | KEEP → 고민 중 (불일치) | 찬성 | 찬성 |

- OPINIONS는 3케이스 모두 12/12가 처음 입장과 일치한다(CISO 고민 중 3/3, v19에서는 1/3).
- 첫 반응은 12개 중 11개가 규칙표 분류와 맞다. 어긋난 CISO는 "참가자 말씀에 **동의합니다**…"로 반대를 확정했고 서버 교정이 이를 방향 선언으로 보고 건너뛰었다 → 상대적 표현은 선언으로 보지 않게 고쳤다(단위 테스트). CEO를 겨눈 조건에서 CEO가 기울기만(고민 중) 한 것은 T138이 원한 동작이다.
- 최종표는 12개 중 11개가 규칙표와 같다. 어긋난 CAIO(규칙표 찬성)는 "승인 사유 기록이 정해져야 판단"이라며 반대했다 — v20의 표결 방향 지시가 있어도 CAIO 렌즈(기록)가 강하게 남는 경우다. 표결 서버 교정은 이번 카드 범위에 넣지 않았다.
- 금지 어휘 1건("책임 소재", 자유 발언 1행).
