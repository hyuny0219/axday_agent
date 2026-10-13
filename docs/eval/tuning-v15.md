# 프롬프트 v15 실측 — "돈 한도" → "금액 한도"(T129)

- 변경: 쉬운 말 규칙(`server/prompts/plainLanguage.ts`)의 바꿔 쓰기 예시 "한도"→"돈 한도"를 "금액 한도"로. 그 외 변경 없음.
- 실측: `scripts/eval-set-run.ts --out docs/eval/tuning-v15-after.jsonl`(live, claude-sonnet-5), 2026-10-13.
- 주의: 실행 끝무렵(04:01Z~) Anthropic 크레딧이 소진돼 마지막 3개 케이스(ai-approval/unanswered-1, experience-first/opposition_conditional-1, experience-first/unanswered-1)의 36호출이 400으로 실패했다. 아래 수치는 나머지 행 기준이며, 충전 뒤 세 케이스를 다시 재야 한다.

| 지표 | v14 | v15 |
|---|---|---|
| "돈 한도" 등장 | 55 | 0 |
| "금액 한도" 등장 | 22 | 98 |
| 조건 보완 경로 반대·미정→YES | 12/12 | 12/12 |
| 첫 반응 새 질문(질문자 외) | 1/64 | 0/53 |
| 금지 어휘 | 3 | 6 |
| 비존댓말 종결 | 0 | 1 |
