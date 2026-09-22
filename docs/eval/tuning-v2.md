# 임원 에이전트 고도화 1차 — 튜닝 라운드 v2 (T34)

- 대상: `server/prompts/common.ts`(공통 가드레일), `server/prompts/version.ts`(v1 → v2)
- 평가 세트: `scripts/eval-set.json`(안건② 네 경로 × 참가자 발언 변형 3개 = 12케이스, `scripts/eval-set-run.ts`로 실행)
- provider: anthropic · modelId: claude-sonnet-5
- before 기록: `docs/eval/tuning-v2-before.jsonl`(promptVersion=v1, 144행)
- after 기록: `docs/eval/tuning-v2-after.jsonl`(promptVersion=v2, 144행)
- 전제 확인: `docs/eval/live-2026-09-22.md`(`--runs 3`, 144회, 검증·호출 실패 0%)로 실제 키 3회 실측 기록 있음을 확인한 뒤 시작함(카드 전제 충족).

> **2026-09-22 정정 (PR #10 Codex 검토 P2).** 이 문서의 최초 판본은 (4) 항목을 "하자/한다/해라"
> 같은 명시 문자열로만 세어 before를 3건, after를 0건으로 적었다. `scripts/eval-set-run.ts`의
> `findStyleViolations()`(문장 종결 단위, 말미 근거 괄호 제외)로 다시 세면 before 187건 ·
> after 1건이다. 개선 방향과 크기는 오히려 더 컸지만(187 → 1) 판정 근거가 틀렸으므로 위 표를
> 정정했다. 잔여 1건과 비서실장 프롬프트 상속 문제는 v3 라운드에서 다뤘다 —
> `docs/eval/tuning-v3.md`. 재집계 방법:
> `npx tsx scripts/eval-set-run.ts --check docs/eval/tuning-v2-before.jsonl --check docs/eval/tuning-v2-after.jsonl`

## 무엇을 봤는가(12케이스 세부)

기존 T32 하네스(`scripts/live-eval.ts`, `npm run eval:live`)는 네 경로에 참가자 발언을 경로당 1개(표준·주입 문장 포함)만 썼다. 이번 라운드는 각 경로에 발언 변형을 2개 더 추가해(반론형: 다른 임원을 지목해 반박, 구어체: 격식 없는 짧은 요청) 표준 문장 하나로는 드러나지 않는 문제를 찾았다. 이 파일은 `npm run eval:live`의 공개 동작(48/144 호출)을 바꾸지 않는다 — 완전히 별도 산출물이다.

## 전후 비교

| 항목 | before(v1) | after(v2) | 판정 |
| --- | --- | --- | --- |
| (1) 자료 밖 사실(자료 ID·발언 ID 숫자 제외 비정상 수치) | 0건 / 144행 | 0건 / 144행 | 유지 — 완료 기준 충족 |
| (2) 역할 일관성 — CFO가 비용·효과 키워드 언급 | 24/24 | 24/24 | 유지 — 악화 없음 |
| (2) 역할 일관성 — CISO가 정보·권한 키워드 언급 | 24/24 | 24/24 | 유지 — 악화 없음 |
| (3) 동료 인용·반론 자연스러움(REACTIONS에 referencedStatementIds 실제 채움, 반론형 변형에 실제로 응수) | 있음(예: conflict-3 CEO가 "CISO·CFO 우려에 동의") | 있음(예: condition_supplement-2 CFO가 "조건 단순화엔 공감하나…"로 참가자 반론에 직접 응수) | 유지 |
| (4) 120·160자 한국어 문장 품질 — 비존댓말 종결 문장 | **187건**(144행 중 104행) | **1건**(`negation-2` CAIO REACTIONS) | 개선 |
| (5) 표 분포 — 같은 조건에서 무조건 찬성·반대만 내는 역할 | 없음(각 역할 NO 9·YES 3로 경로에 따라 갈림) | 없음(CEO·CFO·CAIO는 NO 9·YES 3로 동일. CISO는 NO 9·YES 2·**HOLD 1**로 바뀜 — `condition_supplement-1`에서 YES→HOLD, 근거는 ACCESS 선행 확인 필요라는 동일 우려의 표현 차이) | 유지 — 무조건 찬성·반대 역할은 여전히 없음. 단 CISO 개별 투표 1건이 v1과 달라졌으므로 아래 참고 |
| (6) 라운드당 8초 초과 | 0건 / 96행 | 0건 / 96행 | 유지 — 완료 기준 충족 |
| 부수 확인 — 검증 실패·호출 실패 | 0건 | 0건 | 유지 |
| 부수 확인 — 근거 미인용(evidenceIds 빈 배열) | 0건 | 0건 | 유지 |

## 무엇을 고쳤는가

`buildCommonGuardrails()`(`server/prompts/common.ts`)에 한 줄을 추가했다: 참가자(특별 이사)를 보고 대상으로 명시하고, 모든 문장을 존댓말로 끝내며 "하자/한다/해라" 같은 반말체 어미를 쓰지 말라고 지시했다. CEO 역할 프롬프트(`server/prompts/roles/ceo.ts`)는 "회의 진행 발언"이라는 표현이 모델을 리더 특유의 구호체("~하자")로 이끄는 경향이 있었는데, 개별 역할 프롬프트가 아니라 공통 가드레일에서 막아 다른 세 역할의 기존 존댓말 사용을 방해하지 않도록 했다. 시나리오 규칙표(voteRules 등)는 건드리지 않았다.

## 라운드 판정과 다음 단계

참고 — 개별 투표 변화: `condition_supplement-1`에서 CISO 투표가 v1(YES)에서 v2(HOLD)로 바뀌었다(before/after jsonl 확인). 근거 문구는 두 버전 모두 "권한·공유 범위 설계 미완료(E4)"로 동일하지만, v2는 ACCESS 확인 절차가 먼저 완료되어야 한다는 결론을 명시하며 HOLD로 표현했다. (5)의 완료 기준인 "무조건 찬성·반대 역할 없음"은 여전히 충족하지만, 이는 존댓말 지시 추가만으로는 설명되지 않는 부수 변화이므로 v3에서 재확인이 필요하면 참고할 것.

완료 기준: "전후 비교표에서 (1)(6)이 0건이고 (2)(5)가 악화되지 않음" — 충족. (4)에서 측정된 결함이 이번 라운드로 크게 줄었고(187 → 1, 잔여 1건은 v3에서 해소) 다른 항목은 전부 유지되었다. 이 시점에는 추가 결함이 측정되지 않아 라운드를 멈췄으나, 이후 Codex 교차 검토가 위 정정 사유와 비서실장 프롬프트 상속 문제를 지적해 v3 라운드를 진행했다(`docs/eval/tuning-v3.md`). `docs/LIVE_EVAL.md`의 `npm run eval:live -- --runs 3`를 다시 돌리면(v2 기준) 이번 라운드의 개선이 기존 4경로·1변형 기록에도 반영되는지 재확인할 수 있다(이 카드 범위 밖, 후속 실측 시 자연히 v2로 찍힌다).
