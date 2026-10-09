// 결과 화면 "이사님의 조건이 임원 표를 몇 명 바꿨는지" 요약과, 부결된 임원의 "한 끗
// 차이" 안내(T96, 2026-10-08 사용자 지시 "내 의견과 조건으로 임원을 설득하는 것임을
// 참가자가 느끼게").
//
// Codex 27차 검토 P2-2: 처음에는 "첫 의견 때의 입장(openingStance)"과 최종 표를
// 비교했는데, CAIO처럼 첫 의견이 'UNDECIDED'(미정)인 임원은 조건을 하나도 안 붙여도
// voteRules의 always 분기로 표결 시점에는 반드시 YES/NO 중 하나가 되므로 "조건이
// 바꾼 표"로 잘못 셌다. resultSummary.ts의 execRows.changed(T43 게이지)가 이미 쓰는
// "같은 최종안에서 조건만 뺀 표(baseline)와 비교"(domain/voting.ts의
// countVotesChangedByConditions, decideMember(...baselineCtx) 패턴)를 그대로 재사용해
// 실제로 조건 때문에 결과가 달라진 임원만 센다. live는 이 "조건 없는 안건" 가정 자체가
// 성립하지 않아(LLM이 실제로 판단한 결과이지 규칙표가 아니다, resultSummary.ts의
// execRows.changed와 같은 전제) 0으로 둔다.

import type { ExecMemberId, Scenario, Vote } from '../content/types';
import type { Motion, Session, Stance, Statement } from '../domain/types';
import { EXEC_MEMBER_ORDER, countVotesChangedByConditions, membersChangedByConditionsToward, requiredConditionsFor } from '../domain/voting';
import { buildConditionRecommendation } from './conditionRecommendation';
import { openingStanceOf } from './openingStance';
import { findPhraseForCondition } from './recommendMatch';

/** 임원 4명 중 지금 최종안(조건 포함)과 조건 없는 baseline의 표가 다른 사람 수(T96).
 * scripted만 계산하고(live는 규칙표로 "조건 없었다면"을 가정할 수 없어 0) */
export function countVotesChangedByFinalConditions(
  scenario: Scenario,
  session: Pick<Session, 'mode' | 'finalMotion'> & Partial<Pick<Session, 'opinions' | 'followUpAnswered'>>,
): number {
  if (session.mode !== 'scripted' || !session.finalMotion) {
    return 0;
  }
  const lastStance = session.opinions?.[session.opinions.length - 1]?.stance ?? null;
  return countVotesChangedByConditions(scenario, session.finalMotion, lastStance, session.followUpAnswered ?? true);
}

/** 부결(NO)한 임원이 조건 1~2개만 더 있었으면 찬성이었을지(T96, "한 끗 차이"). scripted
 * voteRules 기준 계산이라 호출부가 session.mode === 'scripted'일 때만 쓴다. */
export function oneStepAwayNote(
  scenario: Scenario,
  memberId: ExecMemberId,
  finalConditionIds: string[],
  participantStance: 'FOR' | 'AGAINST' | null,
  /** 추가 질문에 답했는지(T110). false면 "조건 + 답변"을 함께 안내한다. 생략하면 답한 것으로 본다. */
  followUpAnswered = true,
): string | null {
  // 반대 참가자에게 "찬성이었을 텐데"는 목표와 반대 방향이라 보여주지 않는다.
  if (participantStance === 'AGAINST') {
    return null;
  }
  const required = requiredConditionsFor(scenario, memberId, finalConditionIds, participantStance);
  if (required.persuaded) {
    // 조건은 이미 맞는데 NO였다면 답변 게이트 때문이다(T110).
    return followUpAnswered ? null : '조건은 맞았으니 추가 질문에 답했다면 찬성';
  }
  if (required.conditionIds === null) {
    return null;
  }
  const ids = required.conditionIds;
  if (ids.length < 1 || ids.length > 2) {
    return null;
  }
  const labels = ids.map((id) => scenario.conditions.find((condition) => condition.id === id)?.label ?? id);
  const tail = followUpAnswered ? '' : '와 추가 질문 답변이';
  if (labels.length === 1) {
    return followUpAnswered ? `'${labels[0]}' 하나만 더 있었으면 찬성` : `'${labels[0]}'${tail} 있었으면 찬성`;
  }
  return followUpAnswered ? `'${labels.join('·')}'만 더 있었으면 찬성` : `'${labels.join('·')}'${tail} 있었으면 찬성`;
}

/** 임원 표를 하나도 바꾸지 못했을 때(countVotesChangedFromOpening === 0) "다음엔 이런
 * 조건을 붙여 보세요"에 쓸 조건 라벨 하나. 아직 설득되지 않은 임원 중 가장 먼저 찾은
 * (EXEC_MEMBER_ORDER 순서) 필요 조건의 첫 항목이다. 전원 설득 불가(조건으로는 안 됨)면
 * null. */
export function nextTrySuggestionLabel(
  scenario: Scenario,
  finalConditionIds: string[],
  participantStance: 'FOR' | 'AGAINST' | null,
  /** 최종 표로 본 임원 입장(반대 참가자 추천 계산에 쓴다). 없으면 모두 찬성으로 본다. */
  finalStances?: Record<ExecMemberId, Stance>,
): string | null {
  if (participantStance === 'AGAINST') {
    // 반대 목표: 임원을 NO로 돌리는 조건 중 이 입장에서 실제로 적용할 문구가 있는 것만.
    const stances =
      finalStances ?? { CEO: 'FOR', CFO: 'FOR', CAIO: 'FOR', CISO: 'FOR' };
    const recommendation = buildConditionRecommendation(
      scenario,
      finalConditionIds,
      'AGAINST',
      'scripted',
      stances as Record<ExecMemberId, Stance>,
    );
    const row = recommendation.rows.find(
      (candidate) => findPhraseForCondition(scenario, candidate.conditionId, 'AGAINST') !== undefined,
    );
    return row?.label ?? null;
  }
  for (const memberId of EXEC_MEMBER_ORDER) {
    const required = requiredConditionsFor(scenario, memberId, finalConditionIds, participantStance);
    const firstId = required.conditionIds?.[0];
    if (!required.persuaded && firstId) {
      return scenario.conditions.find((condition) => condition.id === firstId)?.label ?? firstId;
    }
  }
  return null;
}

/** "설득한 임원 N/M" 한 곳 계산(T101) — 설득 현황판·결과 제목·설득 도장이 같은 세션에서
 * 서로 모순되지 않도록 세 곳이 모두 이 함수 하나를 쓴다.
 *
 * - alreadySame: 처음부터(첫 의견 때) 참가자와 같은 편이고 지금도 그 편인 임원. 설득할
 *   필요가 없었으므로 "설득한 임원"의 분모(total)에서 뺀다.
 * - persuaded: 처음엔 같은 편이 아니었는데 지금 참가자 편이 된 임원.
 * - remaining: 나머지(아직 못 움직였거나, 처음엔 같은 편이었다가 돌아선 임원).
 * 불변식: total === 4 - alreadySame.length, 같은 편 좌석 수(참가자 포함) ===
 * 1 + alreadySame.length + persuaded.length(UNCAST 임원이 없을 때). */
export interface PersuasionTally {
  target: 'FOR' | 'AGAINST';
  alreadySame: ExecMemberId[];
  persuaded: ExecMemberId[];
  remaining: ExecMemberId[];
  total: number;
}

export function computePersuasionTally(
  scenario: Scenario,
  mode: Session['mode'],
  statements: readonly Statement[],
  target: 'FOR' | 'AGAINST',
  currentStances: Record<ExecMemberId, Stance>,
): PersuasionTally {
  const alreadySame: ExecMemberId[] = [];
  const persuaded: ExecMemberId[] = [];
  const remaining: ExecMemberId[] = [];
  for (const memberId of EXEC_MEMBER_ORDER) {
    const current = currentStances[memberId];
    if (current !== target) {
      remaining.push(memberId);
    } else if (openingStanceOf(scenario, memberId, mode, statements) === target) {
      alreadySame.push(memberId);
    } else {
      persuaded.push(memberId);
    }
  }
  return { target, alreadySame, persuaded, remaining, total: EXEC_MEMBER_ORDER.length - alreadySame.length };
}

/** 위 계산의 "N/M" 표시. M이 0(모두 처음부터 같은 편)이면 숫자 대신 말로 한다. */
export function persuadedCountLabel(tally: PersuasionTally): string {
  return tally.total === 0 ? '모두 처음부터 같은 편' : `설득한 임원 ${tally.persuaded.length}/${tally.total}`;
}

export interface PersuasionResult {
  tally: PersuasionTally;
  /** 결과 화면 제목 줄. 숫자는 tally.persuaded(첫 의견 대비 지금 표)와 같다. */
  headline: string;
}

/** 결과 화면의 "설득" 계산을 한 곳에서 한다(T101 검토). 현황판·도장과 같은
 * computePersuasionTally로 센 M을 제목 문구에도 그대로 쓴다. 참가자 편은 최종 표(없으면
 * 의견 입장, 그것도 없으면 찬성)로 정한다. live는 조건 때문이라는 인과를 말하지 않는다. */
export function buildPersuasionResult(
  scenario: Scenario,
  session: Pick<Session, 'mode' | 'transcript'> & Partial<Pick<Session, 'followUpAnswered'>>,
  finalStances: Record<ExecMemberId, Stance>,
  input: {
    participantVote: Vote | null;
    participantStance: 'FOR' | 'AGAINST' | null;
    conditionCount: number;
    finalConditionIds: string[];
    /** scripted에서 조건이 실제로 바꾼 표를 세는 데 쓴다(없으면 조건 문구를 쓰지 않는다). */
    finalMotion?: Motion | null;
  },
): PersuasionResult {
  const target: 'FOR' | 'AGAINST' =
    input.participantVote === 'NO'
      ? 'AGAINST'
      : input.participantVote === 'YES'
        ? 'FOR'
        : (input.participantStance ?? 'FOR');
  const tally = computePersuasionTally(scenario, session.mode, session.transcript.statements, target, finalStances);
  const persuadedCount = tally.persuaded.length;
  // PR #20 Codex 35차 P2-2·3 → 46차 P2: 조건 문구는 조건을 뺀 기준 표에서 참가자 목표 방향으로
  // 실제로 넘어온 임원이 있고, 그 임원이 지금 설득된 임원(tally.persuaded)에도 들어 있을 때만
  // 쓴다 — 방향을 따지지 않으면 참가자 반대편으로 돌아간 변화(예: 참가자 반대 + LIMIT+REVIEW로
  // CFO가 찬성이 된 경우)까지 조건 성과로 잘못 귀속된다. 다음 조건 추천도 같은 목표 방향을 쓴다.
  const targetVote: Vote = target === 'FOR' ? 'YES' : 'NO';
  const answered = session.followUpAnswered ?? true;
  const changedByConditions =
    session.mode === 'scripted' && input.finalMotion
      ? membersChangedByConditionsToward(scenario, input.finalMotion, targetVote, input.participantStance, answered).filter(
          (memberId) => tally.persuaded.includes(memberId),
        ).length
      : 0;
  // T110: 답하지 않아 아무도 못 움직였는데, 답했다면 조건 때문에 움직였을 임원이 있으면 그 이유를 말한다.
  const wouldMoveIfAnswered =
    session.mode === 'scripted' && !answered && input.finalMotion
      ? membersChangedByConditionsToward(scenario, input.finalMotion, targetVote, input.participantStance, true).length
      : 0;
  let headline: string;
  if (persuadedCount > 0) {
    headline =
      changedByConditions > 0
        ? `이사님의 발언과 조건 ${input.conditionCount}개로 임원 ${persuadedCount}명이 이사님 편이 됐습니다`
        : `이사님의 발언으로 임원 ${persuadedCount}명이 이사님 편이 됐습니다`;
  } else if (wouldMoveIfAnswered > 0) {
    headline = '조건은 맞았지만 추가 질문에 답하지 않아 임원의 마음을 바꾸지 못했습니다 — 다음엔 답하러 가 보세요';
  } else {
    const suggestion =
      session.mode === 'scripted'
        ? nextTrySuggestionLabel(scenario, input.finalConditionIds, target, finalStances)
        : null;
    headline = suggestion
      ? `이번엔 임원의 입장을 바꾸지 못했습니다 — 다음엔 '${suggestion}' 조건을 붙여 보세요`
      : '이번엔 임원의 입장을 바꾸지 못했습니다';
  }
  return { tally, headline };
}
