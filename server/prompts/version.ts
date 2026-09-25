// 프롬프트/응답 계약 버전. 역할 프롬프트나 검증 스키마(server/validate.ts)가 바뀌면
// 이 값을 올린다. server/config.ts는 이 상수를 그대로 다시 내보낸다(단일 출처).

// v4(2026-09-23): CFO·CAIO·CISO 판단 기준을 안건 독립 문구로 교체(이전 안건의 조건명이 남아
// 있었다, PR #10 Codex 3차 검토 P2). 실측 전후 비교는 T54와 함께 v5에서 한다.
// v5(2026-09-25, T54): 근거 인용을 자료 ID("(E4)")에서 자료 이름("정보보호 메모에 따르면")으로.
// 공통 가드레일 문구와 <meeting_record> 자료 목록의 표기 순서(이름 먼저, id 뒤)를 바꿨다. 응답
// 스키마의 evidenceIds는 그대로 ID다. 전후 비교: docs/eval/tuning-v5.md.
export const PROMPT_VERSION = 'v5';
