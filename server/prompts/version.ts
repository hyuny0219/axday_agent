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
export const PROMPT_VERSION = 'v12';
