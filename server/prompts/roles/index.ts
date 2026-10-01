// 임원 roleId -> 역할 프롬프트 빌더 매핑. round·vote 핸들러가 공통으로 쓴다.

import type { ExecRoleId } from '../../validate';
import { buildRolePrompt as buildCeoPrompt } from './ceo';
import { buildRolePrompt as buildCfoPrompt } from './cfo';
import { buildRolePrompt as buildCaioPrompt } from './caio';
import { buildRolePrompt as buildCisoPrompt } from './ciso';

/**
 * 임원 프롬프트에만 붙는 보고 문체 규칙(T34 튜닝 v2에서 측정된 결함: CEO 발언이 반말체로
 * 끝남). prompts/common.ts의 공통 가드레일에 두면 prompts/assistant.ts의 refine·summarize에도
 * 붙어, 참가자 본인의 발언을 다듬는 refine이 "참가자에게 보고하는" 문체를 만들 수 있다
 * (PR #10 Codex 검토 P2). 그래서 임원 역할 프롬프트 조합에만 한정한다.
 */
export const EXEC_STYLE_RULE =
  '이 자리의 참가자(특별 이사)는 당신이 보고하는 대상입니다. 모든 문장은 존댓말(-습니다/-합니다' +
  ' 등)로 끝내십시오. "하자", "한다", "해라" 같은 반말체 어미나 "필요", "아님" 같은 명사형' +
  ' 종결도 쓰지 마십시오.';

/**
 * 임원 프롬프트에만 붙는 판단 규칙(T62 표결 두 갈래, T63 stance). 공통 가드레일에 두면
 * refine·summarize(비서실장)에도 전달돼 "찬성·반대 중 하나를 고르라"는 지시가 참가자 원문
 * 정리·회의 요약에까지 번진다(PR #11 Codex 10차 P2). round·vote 핸들러가 모두
 * ROLE_PROMPT_BUILDERS를 쓰므로 여기 붙이면 임원 호출 전부에 들어간다.
 */
export const EXEC_DECISION_RULE =
  '찬성(YES)·반대(NO) 중 하나를 실제 근거로 고르십시오. 안건에 붙은 확정 조건은 실행 전에' +
  ' 반드시 지켜야 하는 약속입니다. 그 조건이 지금 현실에서 이미 갖춰졌는지가 아니라, 조건이' +
  ' 지켜진다는 전제에서 이 안건을 받아들일 수 있는지로 판단하십시오. 조건이 당신의 우려를' +
  ' 해소하면 찬성하고, 조건이 있어도 해소되지 않는 우려가 남으면 반대하며, 그 이유를 제공된' +
  ' 근거와 남은 우려에 따라 적으십시오. 무조건 찬성하거나 무조건 반대하는 답변은 금지합니다.' +
  '\n' +
  '발언마다 지금 기울어 있는 쪽을 stance 필드로 적으십시오. 첫 의견부터 방향을 밝히십시오 —' +
  ' 우려가 남아 있어도 지금 표결한다면 어느 쪽인지 정해 찬성(YES) 쪽이면 FOR, 반대(NO) 쪽이면' +
  ' AGAINST로 적습니다. UNDECIDED는 제공된 자료로는 어느 쪽도 말할 수 없을 때만 쓰고, 그때는' +
  ' 무엇이 확인돼야 정할 수 있는지를 발언에 적으십시오.';

function withExecStyle(buildRolePrompt: () => string): () => string {
  return () => [buildRolePrompt(), EXEC_STYLE_RULE, EXEC_DECISION_RULE].join('\n');
}

export const ROLE_PROMPT_BUILDERS: Record<ExecRoleId, () => string> = {
  CEO: withExecStyle(buildCeoPrompt),
  CFO: withExecStyle(buildCfoPrompt),
  CAIO: withExecStyle(buildCaioPrompt),
  CISO: withExecStyle(buildCisoPrompt),
};
