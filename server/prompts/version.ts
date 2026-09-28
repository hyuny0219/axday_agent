// 프롬프트/응답 계약 버전. 역할 프롬프트나 검증 스키마(server/validate.ts)가 바뀌면
// 이 값을 올린다. server/config.ts는 이 상수를 그대로 다시 내보낸다(단일 출처).

// v4(2026-09-23): CFO·CAIO·CISO 판단 기준을 안건 독립 문구로 교체(이전 안건의 조건명이 남아
// 있었다, PR #10 Codex 3차 검토 P2).
// v5(2026-09-28, T54): 화면에서 E1~E4 표기를 없앤 T52에 맞춰, 가드레일의 인용 지시를
// "자료 ID를 인용"에서 "자료 이름을 인용"으로 바꿨다. evidenceIds 필드는 그대로 ID로
// 채우게 한다(검증·기록용). 전후 비교는 docs/eval/tuning-v5.md.
export const PROMPT_VERSION = 'v5';
