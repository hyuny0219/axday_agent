# 프롬프트 v15 실측 — "돈 한도" → "금액 한도"(T129)

- 변경: 쉬운 말 규칙(`server/prompts/plainLanguage.ts`)의 바꿔 쓰기 예시 "한도"→"돈 한도"를 "금액 한도"로. 그 외 변경 없음.
- 실측: `scripts/eval-set-run.ts --out docs/eval/tuning-v15-after.jsonl`(live, claude-sonnet-5), 2026-10-13.
- 실행 끝무렵(04:01Z~) Anthropic 크레딧이 소진돼 마지막 3개 케이스(ai-approval/unanswered-1, experience-first/opposition_conditional-1, experience-first/unanswered-1)가 400으로 실패했다. 충전 뒤 `--case`(이번에 추가한 옵션)로 세 케이스만 다시 재 그 40행을 바꿔 넣었다. 아래 수치는 344행 전체(장애 0행) 기준이다.

| 지표 | v14 | v15 |
|---|---|---|
| "돈 한도" 등장 | 55 | 0 |
| "금액 한도" 등장 | 22 | 99 |
| 조건 보완 경로 반대·미정→YES | 12/12 | 12/12 |
| 첫 반응 새 질문(질문자 외) | 1/64 | 0/61 |
| 금지 어휘 | 3 | 7 |
| 비존댓말 종결 | 0 | 1 |

금지 어휘 증가("표본" 4, "확산"·"전면"·"가늠" 각 1)는 이번 변경과 무관한 표본 흔들림으로 본다(v13 3건 → v14 3건 → v15 7건, 모두 한 자릿수).
