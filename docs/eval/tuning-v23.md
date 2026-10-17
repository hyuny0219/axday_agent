# 프롬프트 v23 실측(같은 4케이스) — 반대 경로 표결 방향 교정(T138)

- 변경: 반대 참가자일 때 live 표가 규칙표 방향과 다르면 방향 재확인 문구를 붙여 **한 번 더 요청**하고, 그래도 다르면(또는 재요청이 실패해도 첫 응답이 틀렸으면) 서버가 규칙표 표·이유로 바꾼다(`source: 'rules'`, `rulesCause: 'direction'`, 로그 note `vote_direction_clamped`). 결과 화면 임원 행에는 작은 pill "기준표로 정했습니다"(늦은 응답의 "응답이 늦어 기준표로 정했습니다"와 구분)가 붙는다. 찬성 참가자·방향이 맞는 표는 그대로다. 단위 테스트는 `tests/server/voteDirectionClamp.test.ts`.
- 실측: `scripts/eval-set-run.ts --out docs/eval/tuning-v23-after.jsonl --case ai-approval/opposition_conditional-1 --case ai-approval/opposition_ceo-1 --case experience-first/opposition_conditional-1 --case ai-approval/condition_supplement-1`(live, claude-sonnet-5), 2026-10-17, 한 번.
- 결과(분류·기대는 v22와 같은 방법으로 계산):
  - OPINIONS 16/16이 처음 입장(CEO 찬성·CFO 고민 중·CAIO 고민 중·CISO 반대)과 일치.
  - 첫 반응: 응답이 온 14개가 모두 규칙표 분류 기대와 일치(응답 실패 2개는 provider_error).
  - 최종표: 16개가 모두 규칙표와 같다. 이번 실행에서는 재요청·교정(`vote_direction_clamped`)이 한 번도 일어나지 않았다(v22에서 어긋났던 CAIO도 규칙표대로 찬성) — 교정은 표가 어긋날 때를 위한 안전장치이며 동작은 단위 테스트로 확인했다.
