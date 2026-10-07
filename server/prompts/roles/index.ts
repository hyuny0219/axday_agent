// 임원 roleId -> 역할 프롬프트 빌더 매핑. round·vote 핸들러가 공통으로 쓴다.

import type { ExecRoleId } from '../../validate';
import type { ScenarioMaterials, ScenarioRoleLens } from '../../scenario-data';
import { buildRolePrompt as buildCeoPrompt } from './ceo';
import { buildRolePrompt as buildCfoPrompt } from './cfo';
import { buildRolePrompt as buildCaioPrompt } from './caio';
import { buildRolePrompt as buildCisoPrompt } from './ciso';

/** round.ts(OPINIONS/REACTIONS/FOLLOWUP)·vote.ts(VOTE)가 공통으로 넘기는 단계 구분.
 * assistant.ts(refine·summarize)는 ROLE_PROMPT_BUILDERS를 쓰지 않으므로 이 타입과 무관하다. */
export type ExecPromptStage = 'OPINIONS' | 'REACTIONS' | 'FOLLOWUP' | 'VOTE';

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
 *
 * T92(v10, 사용자 지적 "반대 의견을 작성해도 AI 임원들 및 프로그램 진행이 찬성 쪽으로
 * 몰고 가는 경향"): v9까지는 "붙은 조건 유무"로만 판단해 참가자의 찬성·반대 자체는
 * 프롬프트에 없었다 — 실측(v9)에서 조건 보완 경로 16/16 YES, 조건 없음 16/16 NO로 네
 * 임원이 참가자 논리와 무관하게 함께 움직였다. v10은 참가자 주장을 판단의 출발점으로
 * 바꾼다: 조건은 "참가자의 요구"일 뿐이라 그 조건이 실제로 우려를 해소하는지는 각자
 * 판단하고, 네 임원이 매번 같은 결론으로 함께 움직이지 않도록 자기 관점(role_lens)에서
 * 독립적으로 답한다.
 */
export const EXEC_DECISION_RULE =
  '참가자의 입장과 그 근거를 먼저 평가하십시오. meeting_record의 참가자 입장이 반대라면,' +
  ' 그 반대 근거가 제공된 자료에 비춰 타당한지를 따져 답하고, 타당하다고 판단되면 반대로' +
  ' 기울어도 됩니다. 안건에 붙은 확정 조건은 참가자의 요구입니다 — 조건이 붙어 있다는' +
  ' 사실만으로 찬성하지 말고, 그 조건이 당신의 우려를 실제로 해소할 때만 찬성 근거로' +
  ' 삼으십시오. 조건이 우려를 해소하지 못하면 조건이 있어도 반대하고, 참가자의 반대 근거가' +
  ' 자료에 비춰 타당하지 않다면 반대 입장이어도 찬성할 수 있습니다 — 참가자의 입장을' +
  ' 그대로 따르거나 무조건 반대로 맞서는 답변 둘 다 금지합니다. 당신의 관점(role_lens)에서' +
  ' 독립적으로 판단하십시오 — 다른 임원도 같은 결론을 낼 것이라고 가정하지 말고, 네 명이' +
  ' 매번 같은 쪽으로 한꺼번에 움직이지 않아도 됩니다. 그 이유를 제공된 근거와 참가자 주장에' +
  ' 대한 당신의 평가로 적으십시오. 무조건 찬성하거나 무조건 반대하는 답변은 금지합니다.' +
  '\n' +
  '발언마다 지금 기울어 있는 쪽을 stance 필드로 적으십시오. 첫 의견부터 방향을 밝히십시오 —' +
  ' 우려가 남아 있어도 지금 표결한다면 어느 쪽인지 정해 찬성(YES) 쪽이면 FOR, 반대(NO) 쪽이면' +
  ' AGAINST로 적습니다. UNDECIDED는 제공된 자료로는 어느 쪽도 말할 수 없을 때만 쓰고, 그때는' +
  ' 무엇이 확인돼야 정할 수 있는지를 발언에 적으십시오.';

const OPENING_LABEL: Record<ScenarioRoleLens['opening'], string> = {
  FOR: '찬성',
  AGAINST: '반대',
  UNDECIDED: '미정',
};

function evidenceTitles(materials: ScenarioMaterials, ids: string[]): string {
  const byId = new Map(materials.evidence.map((item) => [item.id, item.title] as const));
  return ids.map((id) => byId.get(id) ?? id).join(', ');
}

/**
 * 안건별 임원 렌즈(T79). 모든 발언 단계(OPINIONS/REACTIONS/FOLLOWUP)와 VOTE에 붙는다.
 * "무겁게 볼 관점·자료"를 알려줄 뿐 발언 문장이나 최종 표를 정하지 않는다 — 정답표 금지
 * 원칙(AGENT_BOARDROOM_SPEC.md 1·2장)은 그대로 유지하고, 임원은 매 호출 스스로 찬성·반대를
 * 고른다(EXEC_DECISION_RULE).
 */
function buildRoleLensBlock(materials: ScenarioMaterials, lens: ScenarioRoleLens): string {
  return [
    '<role_lens>',
    `당신은 이 안건에서 특히 다음 관점을 무겁게 봅니다: ${lens.lens}`,
    `이 관점과 관련해 다음 자료를 특히 무겁게 고려하십시오: ${evidenceTitles(materials, lens.evidenceIds)}.`,
    '</role_lens>',
  ].join('\n');
}

/**
 * 첫 의견(OPINIONS) 단계에 한해서만 붙는 출발 성향(T79). 반응·후속·표결 단계에는 주지
 * 않는다(카드 지시 "반응·후속·표결 단계에는 출발 성향을 주지 않는다 — 렌즈만"). 출발점일
 * 뿐 결론이 아니라는 문구를 그대로 넣어 정답표로 오인되지 않게 한다.
 */
function buildOpeningStanceBlock(opening: ScenarioRoleLens['opening']): string {
  return [
    '<opening_stance>',
    `당신은 이 안건에 ${OPENING_LABEL[opening]} 쪽으로 기운 채 회의에 들어옵니다. 출발점이지` +
      ' 결론이 아니며 자료·참가자 조건·논의에 따라 바꿀 수 있습니다.',
    '</opening_stance>',
  ].join('\n');
}

function withExecStyle(
  buildRolePrompt: () => string,
  roleId: ExecRoleId,
): (materials: ScenarioMaterials, stage: ExecPromptStage) => string {
  return (materials: ScenarioMaterials, stage: ExecPromptStage) => {
    const parts = [buildRolePrompt(), EXEC_STYLE_RULE, EXEC_DECISION_RULE];
    const lens = materials.roleLenses?.[roleId];
    if (lens) {
      parts.push(buildRoleLensBlock(materials, lens));
      if (stage === 'OPINIONS') {
        parts.push(buildOpeningStanceBlock(lens.opening));
      }
    }
    return parts.join('\n');
  };
}

export const ROLE_PROMPT_BUILDERS: Record<
  ExecRoleId,
  (materials: ScenarioMaterials, stage: ExecPromptStage) => string
> = {
  CEO: withExecStyle(buildCeoPrompt, 'CEO'),
  CFO: withExecStyle(buildCfoPrompt, 'CFO'),
  CAIO: withExecStyle(buildCaioPrompt, 'CAIO'),
  CISO: withExecStyle(buildCisoPrompt, 'CISO'),
};
