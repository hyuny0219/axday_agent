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

function withExecStyle(buildRolePrompt: () => string): () => string {
  return () => [buildRolePrompt(), EXEC_STYLE_RULE].join('\n');
}

export const ROLE_PROMPT_BUILDERS: Record<ExecRoleId, () => string> = {
  CEO: withExecStyle(buildCeoPrompt),
  CFO: withExecStyle(buildCfoPrompt),
  CAIO: withExecStyle(buildCaioPrompt),
  CISO: withExecStyle(buildCisoPrompt),
};
