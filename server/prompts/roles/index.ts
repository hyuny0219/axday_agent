// 임원 roleId -> 역할 프롬프트 빌더 매핑. round·vote 핸들러가 공통으로 쓴다.

import type { ExecRoleId } from '../../validate';
import { buildRolePrompt as buildCeoPrompt } from './ceo';
import { buildRolePrompt as buildCfoPrompt } from './cfo';
import { buildRolePrompt as buildCaioPrompt } from './caio';
import { buildRolePrompt as buildCisoPrompt } from './ciso';

export const ROLE_PROMPT_BUILDERS: Record<ExecRoleId, () => string> = {
  CEO: buildCeoPrompt,
  CFO: buildCfoPrompt,
  CAIO: buildCaioPrompt,
  CISO: buildCisoPrompt,
};
