// 프롬프트/응답 계약 버전. 역할 프롬프트나 검증 스키마(server/validate.ts)가 바뀌면
// 이 값을 올린다. server/config.ts는 이 상수를 그대로 다시 내보낸다(단일 출처).

// v4(2026-09-23): CFO·CAIO·CISO 판단 기준을 안건 독립 문구로 교체(이전 안건의 조건명이 남아
// 있었다, PR #10 Codex 3차 검토 P2).
// v5(2026-09-28, T54): 화면에서 E1~E4 표기를 없앤 T52에 맞춰, 가드레일의 인용 지시를
// "자료 ID를 인용"에서 "자료 이름을 인용"으로 바꿨다. evidenceIds 필드는 그대로 ID로
// 채우게 한다(검증·기록용). 전후 비교는 docs/eval/tuning-v5.md.
// v6(2026-09-29, T62): 표결에서 보류를 없애고 찬성·반대 두 가지로 줄였다(VOTE_VALUES,
// 응답 스키마). 가드레일의 "찬성·보류·반대 세 가지를 모두 고려" 지시를 "확정 조건은 실행 전에
// 지켜야 할 약속이므로, 조건이 지금 갖춰졌는지가 아니라 조건이 지켜진다는 전제에서 받아들일 수
// 있는지로 판단해 찬성·반대 중 하나를 고르라"로 바꿨다(1차 문구 "조건이 부족하면 반대"는
// 48/48 반대가 나와 폐기). 전후 비교는 docs/eval/tuning-v6.md.
// v7(2026-09-29, T63): 발언(토론) 응답 스키마에 stance(FOR/AGAINST/UNDECIDED) 필수 필드를
// 더해 무대 표정·"설득 도장"이 쓰는 값을 임원이 직접 밝히게 했다(응답 스키마가 바뀌므로 버전을
// 올린다). 표결 판단·stance 지시는 공통 가드레일이 아니라 임원 전용 EXEC_DECISION_RULE
// (prompts/roles/index.ts)에 둔다 — 비서실장 refine·summarize에 새지 않게(PR #11 Codex 10차).
// stance는 "첫 의견부터 방향을 밝히라"로 한 번 더 손봤다(after3). 최종 문구로 144행 전수
// 재측정해 실패 0·stance 누락 0을 확보했다(첫 실행은 크레딧 소진으로 중단, 두 번째는 실패 5행이
// 있어 세 번째 기록을 최종으로 삼는다). 전후 비교는 docs/eval/tuning-v7.md.
// v8(2026-10-02, T79): 2026-10-02 안건 교체(T78, ai-approval·experience-first) 이후 안건별
// 임원 렌즈(<role_lens>, 모든 발언·표결 단계)와 첫 의견 전용 출발 성향(<opening_stance>,
// OPINIONS 단계만)을 임원 프롬프트에 추가했다(server/scenario-data.ts의 roleLenses,
// prompts/roles/index.ts). 발언 문장·최종 표는 여전히 모델이 정하고(정답표 금지 유지),
// 비서실장 refine·summarize에는 EXEC_DECISION_RULE과 같은 위치에 둬 새지 않는다. 응답
// 스키마는 바뀌지 않았지만 시스템 프롬프트 본문이 바뀌므로 버전을 올린다. 전후 비교는
// docs/eval/tuning-v8.md.
// v9(2026-10-07, T82): v8 실측(docs/eval/tuning-v8-after.jsonl 192행 중 87행, 39~45%)에서
// 발언·판단 근거 문장에 조건 ID(LOG, OWNER, SCOPE 등)가 그대로 새는 것을 발견했다 — 프롬프트가
// meeting_record의 "허용 조건 목록"에 ID와 한국어 라벨을 나란히 줬기 때문이다. 조건 목록을
// 한국어 라벨만 보이는 블록과 응답 스키마 필드 전용 ID 대응표로 나누고(prompts/common.ts의
// formatConditionLabels·formatConditionIdMap), 공통 가드레일에 "조건도 한국어 이름으로,
// 영문 약어·코드 금지('AI'·임원 역할 이름·숫자·단위만 예외)"를 더했다. 응답 스키마 자체는
// 바뀌지 않았지만(evidenceIds·suggestedConditionIds는 여전히 ID), validate.ts의
// findStrayLatinRun()이 message·reason·draftText에 남은 조건 ID·영문을 응답 단계에서 한 번
// 더 거절한다(invalid_response). 전후 비교는 docs/eval/tuning-v9.md.
// v10(2026-10-07, T92): 사용자 지적 "반대 의견을 작성해도 AI 임원들 및 프로그램 진행이
// 찬성 쪽으로 몰고 가는 경향". v9 실측에서 임원 4명이 "붙은 조건 유무"로만 판단해
// 참가자의 찬성·반대 자체가 프롬프트에 없었다 — 조건 보완 경로 16/16 YES, 조건 없음
// 16/16 NO로 네 임원이 참가자 논리와 무관하게 함께 움직였다. meeting_record에 참가자
// 입장(FOR/AGAINST/null, buildMeetingRecordBlock)을 추가하고, 반대 입장일 때는 붙은
// 조건이 "참가자의 요구"라는 설명을 더했다. EXEC_DECISION_RULE을 참가자 주장 중심으로
// 바꿔 조건 유무가 아니라 참가자 반대 근거의 타당성으로 판단하게 하고, 네 임원이 매번
// 같은 쪽으로 함께 움직이지 않도록 role_lens 기준 독립 판단을 명시했다. REACTIONS 단계
// 지시에 참가자 발언의 핵심 주장 한 가지에 직접 답하라는 요구를 더했다. 요청 스키마에
// participantStance(round·vote 모두 선택 필드, 생략 시 null과 같음)를 추가했다 — 기존
// 요청은 필드가 없으므로 동작이 그대로다. 응답 스키마는 바뀌지 않았다. 전후 비교는
// docs/eval/tuning-v10.md.
// v11(2026-10-07, T93): 사용자 지적 "AI 임원들이 의견을 내는 것을 초중학생이 봐도 이해할 수
// 있는 수준으로 말하게 하자. 지금은 한참 들여다보고 생각해야 하는 게 있다." v10 실측
// (docs/eval/tuning-v10-after.jsonl)에서 "리스크", "재구성", "비용 리스크가 통제되지
// 않습니다" 같은 한자어·업무 용어가 발언·판단 이유에 그대로 쓰이는 사례를 확인했다.
// server/prompts/plainLanguage.ts에 쉬운 말 규칙(PLAIN_LANGUAGE_RULE: 문장 25자 안팎·발언당
// 2~3문장·금지 어휘 대체)과 금지 어휘 목록(FORBIDDEN_WORDS, 20개 안팎)·가독성 측정
// 함수(문장당 글자 수·발언당 문장 수)를 새로 두고, roles/index.ts의 withExecStyle에서
// EXEC_STYLE_RULE 다음에 붙였다(임원 전용, 비서실장 refine·summarize에는 붙이지 않음 —
// EXEC_STYLE_RULE과 같은 이유). 응답 스키마는 바뀌지 않았지만 시스템 프롬프트 본문이
// 바뀌므로 버전을 올린다. eval-set-run.ts --check에 가독성 지표를 추가해(서버 검증에서
// 거절하지는 않음) 전후를 비교한다. scripted 임원 발언(initialOpinions·reactions·
// oppositionReactions·voteRules reason·followUp.question)도 같은 기준으로 다시 썼다 —
// 자료 카드·조건 라벨·추천 문구(P1~P6·N1~N4)·후속 추천 답변은 범위 밖(참가자 몫이거나
// 키워드 규칙과 묶여 있음). 전후 비교는 docs/eval/tuning-v11.md.
// v12(2026-10-09, T110): 사용자 지시 "처음 추천문구를 선택해서 의견전달했을 때 전부
// 설득당하면 재의견을 내지 않아도 성공하기 때문에, 난이도 조절을 해줘." 설득을 두 단계로
// 나눴다 — REACTIONS(첫 반응) 지시에 "조건이 충분해도 stance는 UNDECIDED(고민 중)까지만,
// 참가자 쪽 확정은 추가 질문에 답한 뒤"를(prompts/common.ts의 REACTIONS_FIRST_PASS_RULE,
// 위 stance 지침보다 우선), FOLLOWUP 지시에 "답을 받았으니 확정해도 된다"를, VOTE 지시에
// "추가 질문 답변: 없음이면 고민 중이던 임원은 처음 입장대로 표결(찬성 참가자면 반대표)"을
// 더했다(VOTE_UNANSWERED_RULE, followUpAnswered가 false일 때만 붙는다). 요청 스키마에
// followUpAnswered(round·vote 모두 선택 필드, 생략 시 기존 동작)를 추가했다. 응답 스키마는
// 바뀌지 않았다. 전후 비교는 docs/eval/tuning-v12.md(mock 기준 요약, live 실측은 승인 후).
// v13(2026-10-09, T114): 사용자 지시 "답하기 후 AI 임원들의 찬반 방향을 몰라야 결과가
// 더 극적". 추가 질문에 답한 뒤(MOTION·VOTE)에는 화면이 임원 방향을 봉인하고 결과에서
// 한 장씩 공개하므로, FOLLOWUP 지시에 "답변에 대한 평가·소회만 말하고 최종 찬반·표결
// 방향을 문장으로 밝히지 말 것"(common.ts의 FOLLOWUP_NO_VERDICT_RULE)을 더했다. 응답
// 스키마(stance 포함)는 그대로 — 화면에서만 가린다. 이 규칙 외 변경 없음.
// 전후 비교 계획은 docs/eval/tuning-v13.md(live 실측은 사용자 승인 뒤).
// v14(2026-10-11, T122): v13 live 실측에서 조건 보완 경로가 찬성으로 넘어온 비율이 3/12(v11
// 10/12)였다. live 임원이 첫 반응에서 각자 다른 새 질문을 던지는데 화면은 시나리오의 추가 질문
// 하나만 보여 줘 참가자가 답해도 "내 질문에 답이 없다"며 반대가 유지됐기 때문이다. REACTIONS에
// "남은 우려는 화면의 추가 질문 하나로만, 질문자가 아닌 임원은 그 답을 기다린다고만"(common.ts의
// buildReactionsQuestionRule)을, FOLLOWUP·VOTE에 참가자의 답변 문장과 "그 답이 그 질문에 답했는지로
// 판단"(ANSWER_JUDGMENT_RULE)을 더했다. round·vote 요청에 followUpQuestion·followUpAnswerText
// (선택 필드)를 추가했다. v13의 FOLLOWUP 방향 단어 금지·서버 교정은 그대로. 비교는 docs/eval/tuning-v14.md.
// v15(2026-10-13): 사용자 지시 "임원들의 말 중에 '돈 한도'라고 되어 있는데 '금액 한도'라고
// 나와야해." 쉬운 말 규칙(plainLanguage.ts PLAIN_LANGUAGE_RULE)의 바꿔 쓰기 예시를 "한도"→"금액
// 한도"로 고쳤다(v11부터 "돈 한도"). scripted 발언·조건 문구도 같은 말로 맞췄다. 이 예시 외 변경 없음.
// v16(2026-10-15, T132): 사용자 지적 "반응에 답하기 첫화면에서 카드는 전부 고민중". v13~v15 live 첫 반응이
// 거의 전원 UNDECIDED였다(T110의 "UNDECIDED까지만" 규칙을 같은 편 임원도 따랐다). REACTIONS 첫 반응
// 지시를 임원별로 나눴다(prompts/firstReaction.ts): 처음부터 참가자와 같은 편이면 입장 유지, 이번 조건으로
// 넘어올 수 있는 임원만 기존 "UNDECIDED까지만", 우려가 안 풀린 임원은 처음 입장 유지. 판정은 규칙표(decideMember)로
// 하고 요청에 confirmedConditionIds·priorStances(선택 필드)가 없으면 v15 공통 규칙으로 폴백한다. 응답 스키마·표결 규칙은 그대로.
// 비교는 docs/eval/tuning-v16.md.
// v17(2026-10-16, T132 보강, PR #21 Codex P2): 첫 반응 REVERSED 지시를 참가자 방향으로 나눴다 — 찬성 참가자의
// 조건(함정 조건 등)은 임원의 우려를 키워 AGAINST, 반대 참가자의 조건(예: 승인 사유 기록)은 우려를 풀어 FOR.
// 그 외 지시는 v16 그대로다.
// v18(2026-10-16, T136): 표결 형식 검사 실패(invalid_response, 10월 10~16일 live 73건 중 4건)를 줄이려고 VOTE
// 단계 지시에 형식 규칙을 모아 분명히 했다 — reason은 한국어 160자 이내(공백 포함, 길면 줄여 쓰기)·자료 ID/조건 ID/영문
// 약어 금지(역할 이름·AI만 예외, 걸리면 응답 전체가 거절됨), motionId·motionHash는 meeting_record 값을 한 글자도
// 바꾸지 말고 그대로 복사. 판단 기준·응답 스키마·표결 규칙은 그대로다.
// v19(2026-10-16, T137): 반대 입장 대칭 설계. 반대 근거(Condition.side 'AGAINST', 8개)를 조건과 따로 싣는다 —
// meeting_record의 허용 조건 목록·ID 대응표에서 빼고, 반대 참가자가 확정한 근거는 "참가자가 든 반대 근거"(한국어
// 라벨만, ID 노출 금지)로 안건을 수정하지 않는다는 설명과 함께 싣는다(common.ts participantObjections). CAIO·CISO가
// 처음 입장 고민 중으로 바뀌어(roleLenses.opening) 표결 지시에 VOTE_UNDECIDED_START_RULE("설득되지 않았다면 참가자
// 입장의 반대편에 표")를 더했고, 첫 반응 REVERSED(반대 참가자) 지시를 "지나치거나 우려를 풀어 주는 내용"으로 바꿨다.
// 응답 스키마·검증은 그대로다(조건 ID enum만 반대 근거 ID가 늘었다).
// v20(2026-10-16, T137 보강): v19 live 실측에서 반대 참가자 경로의 최종표가 규칙표와 무관하게 "원안에 조건이
// 없다"며 전원 반대였다. 반대 참가자일 때 VOTE 지시에 임원별 표 방향(prompts/voteDirection.ts, 규칙표 decideMember로
// 계산한 방향 지시만 싣고 규칙표 값·조건별 매핑은 싣지 않는다)과 "참가자가 내건 조건은 안건을 바꾸지 않는다"를 더했다.
// 찬성 참가자·응답 스키마는 그대로다.
// v21(2026-10-16, T137 Codex P2): v20 방향 지시가 조건 없는 순수 반대에서도 "참가자가 낸 조건이 우려를 키운다/약하다"고
// 말해 임원이 없는 조건을 지어냈다. 조건이 표를 바꿨는지(조건 있을 때와 없을 때의 규칙표 표 비교)로 네 가지 문구
// (조건 때문에 반대·처음 우려 그대로 반대·약한 조건이라 찬성·조건이 없어 찬성)로 나눴다. 그 밖은 v20 그대로다.
// v22(2026-10-17, T138): 반대 경로 live 재현에서 OPINIONS의 CISO가 "반대"(처음 입장은 고민 중)로, 첫 반응에서
// CEO가 자기를 겨눈 조건 없이 "찬성→반대"로 나왔다. OPINIONS에 처음 입장을 stance 필드로 단정하는 지시(roles/index.ts
// buildOpeningStanceBlock)를, 첫 반응 MAY_CROSS·KEEP 지시를 단정형으로 바꿨다(MAY_CROSS는 UNDECIDED, KEEP은 처음 입장
// 그대로, prompts/firstReaction.ts). 모델이 어겨도 문장이 방향을 밝히지 않았다면 서버가 stance만 규칙표 분류대로 교정한다
// (round.ts clampStance, 로그 note stance_clamped). 반대 쪽 함정 조건 8개 중 2개(AG_BAN·AG_NUMBERS)를 없앴다.
export const PROMPT_VERSION = 'v22';
