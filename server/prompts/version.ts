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
export const PROMPT_VERSION = 'v9';
