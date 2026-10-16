# 프롬프트 v19 실측(대표 3케이스) — 반대 근거(T137)

- 변경: 반대 근거(`Condition.side: 'AGAINST'`)를 조건과 따로 싣는다(meeting_record "참가자가 든 반대 근거", 한국어 라벨만), 처음 고민 중이던 CAIO·CISO의 표결 지시 추가, 반대 참가자 REVERSED 첫 반응 문구 수정. 상세는 DESIGN_SPEC "T137".
- 실측: `scripts/eval-set-run.ts --out docs/eval/tuning-v19-after.jsonl --case ai-approval/opposition_conditional-1 --case ai-approval/opposition_trap-1 --case experience-first/opposition_conditional-1`(live, claude-sonnet-5), 2026-10-16. 전수 실측은 하지 않았다(카드 범위 밖).
- 케이스: 반대(반대 근거) — 안건 ① AG_AUDIT+AG_TRUST, 안건 ② AG_WARN+AG_WHY / 반대(함정) — 안건 ① AG_BAN(모두 막읍시다).

| 지표 | 결과 |
|---|---|
| 행 / 실패 | 48행 중 7행 실패(provider_error 5, invalid_response 2 — 반대 근거와 무관한 기존 형식·연결 실패) |
| 조건 ID·자료 ID 문장 잔존 | 0건(자료 ID `E\d` 0건, 반대 근거 ID는 프롬프트에 싣지 않는다) |
| 첫 반응 입장(요약) | 함정 케이스에서 CAIO·CISO가 "전부 막는 건 지나칩니다"라며 입장을 유지, CEO·CFO는 FOR |
| 표 분포 | 반대(반대 근거) 찬성 0 · 반대 7/7, 반대(함정) 찬성 0 · 반대 4/4 |

## 해석

- **규칙표와 live의 차이**: scripted 규칙표는 함정(AG_BAN)에서 네 임원이 모두 찬성이지만 live 최종표는 네 임원 모두 반대였다. 이유는 모두 "원안에 금액 한도·승인 사유 기록·책임질 사람이 하나도 정해지지 않아서"다 — 안건 문장 자체에 조건이 없으면 live 임원은 참가자 입장과 무관하게 반대로 기운다(v10 이후 알려진 live 특성, 참가자 입장 판단보다 원안의 빈틈을 먼저 본다). 반대 참가자의 live 성공이 쉽고 함정이 함정으로 작동하지 않는다는 뜻이라, 필요하면 표결 프롬프트에서 "원안에 조건이 없다는 이유만으로 반대하지 말고 참가자 근거의 타당성을 먼저 평가"하게 하는 후속 조정을 검토한다(이번 카드에서는 하지 않았다).
- 첫 반응은 기대대로다: 반대 근거가 겨눈 임원(CAIO·CISO)은 UNDECIDED로 "하나만 더" 쪽, 지나친 근거는 "지나칩니다" 문장이 나온다.
