# 근거 인용을 자료명으로 — 튜닝 라운드 v5 (T54)

- 대상: `server/prompts/common.ts`(공통 가드레일의 인용 지시, `<meeting_record>` 자료 목록 표기), `server/prompts/version.ts`(v4 → v5)
- 평가 세트: `scripts/eval-set.json`(12케이스) · 실행기 `scripts/eval-set-run.ts`
- provider: anthropic · modelId: claude-sonnet-5 (기본값 `DEFAULT_MODEL_ID`)
- before 기록: `docs/eval/tuning-v5-before.jsonl` — **v4 프롬프트로 실측(아직 없음)**
- after 기록: `docs/eval/tuning-v5-after.jsonl` — **v5 프롬프트로 실측(아직 없음)**

## 상태

**실측 전.** 코드 변경(v5)과 검사 도구는 들어갔지만, 이 라운드의 before/after는 실제 키가 있는 세션에서 아직 돌리지 않았다. 아래 표의 수치 칸은 비어 있으며, 채우기 전까지 T54는 완료가 아니다.

`tuning-v3-after.jsonl`은 before로 쓸 수 없다 — PR #10 Codex 3차 검토로 평가 세트의 참가자 발언이 새 안건(anon-board) 문구로 다시 쓰였고 역할 프롬프트가 v4가 됐기 때문이다(T54 카드 전제). 그래서 v4 before를 먼저 잰다.

## 무엇을 바꿨는가

1. **인용 지시**: "모든 주장에는 제공된 근거 카드 ID(예: E1)를 인용하십시오" → "주장의 근거는 자료 목록에 적힌 **자료 이름**으로 인용하십시오(예: '게시판 운영 기록에 따르면 …'). 발언 문장 안에는 E1 같은 자료 ID를 쓰지 마십시오 — 참가자 화면에는 ID가 없어 무엇을 가리키는지 알 수 없습니다. 응답 JSON의 evidenceIds에는 인용한 자료의 ID를 그대로 넣으십시오." 이유: T52가 참가자 화면에서 `E1~E4`를 없앴으므로 "…미정입니다(E4)" 같은 발언은 참가자에게 뜻이 없다.
2. **자료 목록 표기**: `- E1 (게시판 운영 기록): …` → `- 게시판 운영 기록 (id: E1): …`. 모델이 이름을 그대로 베껴 쓰기 쉽게 이름을 앞에 두고, evidenceIds를 채울 id는 뒤에 붙인다.
3. **검증 스키마는 불변**: `evidenceIds`는 계속 `E1~E4` enum이다(검증·기록용). 발언 문장만 바뀐다.
4. **검사 도구**: `scripts/eval-set-run.ts`에 `findEvidenceIdMentions()`를 추가했다. message·reason에 `\bE\d+\b`가 남은 필드를 세고 `--check`와 실행 후 요약에 "발언 속 자료 ID n필드"로 찍는다. v5 after는 0이어야 한다. 기존 v3 기록으로 검사기가 동작함을 확인했다(아래 "검사기 확인").

## 실측 절차 (실제 키가 있는 새 세션에서)

키는 환경변수로만 넣는다(`docs/LIVE_EVAL.md` 3장 방법 B). 두 실행 모두 12케이스 × 4임원 × 3단계 = 144호출이다.

```bash
# 1) before — v4 프롬프트(PR #10 머지 커밋)로. 워크트리를 써서 현재 브랜치를 건드리지 않는다.
git worktree add ../axday-v4 82468c0
(cd ../axday-v4 && npm ci && MODEL_PROVIDER=anthropic npx tsx scripts/eval-set-run.ts --out "$OLDPWD/docs/eval/tuning-v5-before.jsonl")
git worktree remove ../axday-v4

# 2) after — 현재 브랜치(v5)로.
MODEL_PROVIDER=anthropic npx tsx scripts/eval-set-run.ts --out docs/eval/tuning-v5-after.jsonl

# 3) 재집계(모델 호출 없음)
npx tsx scripts/eval-set-run.ts --check docs/eval/tuning-v5-before.jsonl docs/eval/tuning-v5-after.jsonl
```

before 기록의 `promptVersion`은 `v4`, after는 `v5`여야 한다(다르면 잘못된 트리에서 돌린 것).

## 전후 비교 (144행 기준 — 실측 후 채움)

| 항목 | before(v4) | after(v5) | 판정 |
| --- | --- | --- | --- |
| **발언 문장에 `E\d` 패턴이 남은 필드**(T54 완료 기준) | 미측정 | 미측정 · 목표 0 | — |
| (1) 자료 밖 근거 ID(evidenceIds ⊄ E1~E4) | 미측정 | 미측정 · 목표 0 | — |
| (1) 근거 미인용(evidenceIds 빈 배열) | 미측정 | 미측정 · 목표 0 | — |
| (2) CFO 비용·효과 키워드 | 미측정 | 미측정 · 악화 없음 | — |
| (2) CISO 정보·권한 키워드 | 미측정 | 미측정 · 악화 없음 | — |
| (2) CAIO 연결·운영 키워드 | 미측정 | 미측정 · 악화 없음 | — |
| (3) REACTIONS 동료 발언 인용 | 미측정 | 미측정 | — |
| (4) 비존댓말 종결 문장 | 미측정 | 미측정 · 0 유지 | — |
| (6) 라운드당 8초 초과 | 미측정 | 미측정 · 0 | — |
| 검증 실패·호출 실패 | 미측정 | 미측정 · 0 | — |
| 지연 중앙값 / 최대 | 미측정 | 미측정 · 악화 없음 | — |
| 문장 길이 message / reason 최대 | 미측정 | 미측정 · 한도 120·160 | — |

집계 방법은 `docs/eval/tuning-v3.md`와 같다. 자료 이름 인용이 늘어 문장이 길어질 수 있으므로(예: "(E1)" 4자 → "게시판 운영 기록에 따르면" 12자) 문장 길이와 지연 항목을 특히 본다.

## 검사기 확인

`npx tsx scripts/eval-set-run.ts --check docs/eval/tuning-v3-after.jsonl` — v3 기록(ID 인용 지시)에서 "발언 속 자료 ID" 필드 수가 0보다 크게 나와야 검사기가 실제로 ID 언급을 잡는 것이다. 결과는 아래 "실행 기록"에 적는다.

## 실행 기록

- 2026-09-25: v5 코드·검사 도구·이 문서 작성. 실측은 키 없는 세션이라 미실행.
- 2026-09-25: 검사기 확인 — `--check docs/eval/tuning-v3-after.jsonl` 결과 "발언 속 자료 ID 138필드"(144행 중, ID 인용 지시 시절 기록이라 예상대로 다수). 검사기가 ID 언급을 실제로 잡는다.
- 2026-09-25: mock 스모크 `MODEL_PROVIDER=mock npx tsx scripts/eval-set-run.ts --out <scratch>` — 144행, 발언 속 자료 ID 0필드(mock 발언에는 ID가 없음; 프롬프트 반영 여부는 mock으로 알 수 없다).
