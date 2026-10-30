// 부스 자동 진행(AI 비서실장 에이전트, T143): 화면마다 자동으로 해 보일 동작 목록과, 참가자
// 대신 담을 추천 문구·추가 답변을 고르는 순수 함수. 화면 연결은 T144·T145가 한다. 표결 규칙표는
// 건드리지 않고 decideBoard의 결과만 읽는다 — 함정 조건은 표가 모자라 자연히 고르지 않게 된다.

import type { FollowUpOption, Phrase, Scenario } from '../content/types';
import { filterConditionIdsForStance } from './conditions';
import { freezeMotion } from './motion';
import { decideBoard, participantTargetVote } from './voting';

export type AutoSide = 'FOR' | 'AGAINST';
export type AutoStage = 'BRIEFING' | 'OPINIONS' | 'DISCUSS' | 'REACTIONS' | 'MOTION';

export type AutoActionKind =
  | 'OPEN_EVIDENCE'
  | 'HIGHLIGHT_EXEC'
  | 'ADD_PHRASE'
  | 'OPEN_ASSISTANT'
  | 'APPLY_ASSISTANT'
  | 'ADVANCE_REACTION'
  | 'PICK_FOLLOWUP'
  | 'HIGHLIGHT_CONDITION';

export interface AutoAction {
  kind: AutoActionKind;
  /** 다루는 요소 id(근거 자료·임원·문구·비서실장 번호·추가 답변 순번·조건). 없으면 빈 문자열. */
  targetId: string;
  /** 자막 띠에 타이핑할 한 줄(화면에 보이는 한국어). */
  caption: string;
  durationMs: number;
}

/** 한 동작이 머무는 가장 짧은 시간. 자막이 길면 autoActionMs가 늘린다. */
export const AUTO_ACTION_MS = 1500;
/** 비서실장 ①②③ 번호. */
export const AUTO_ASSISTANT_STEPS = ['1', '2', '3'] as const;

function phraseSideOf(phrase: Phrase): 'FOR' | 'AGAINST' | 'BOTH' {
  return phrase.side ?? 'FOR';
}

function matchesSide(side: 'FOR' | 'AGAINST' | 'BOTH' | undefined, stance: AutoSide): boolean {
  const s = side ?? 'FOR';
  return s === 'BOTH' || s === stance;
}

/** 그 입장 쪽 추천 문구 중 조건이 붙는 문구를 모두(conditionId null 문구는 제외) 순서대로. */
export function autoPhrasePicks(scenario: Scenario, stance: AutoSide): Phrase[] {
  return scenario.phrases.filter(
    (phrase) => phrase.conditionId !== null && matchesSide(phraseSideOf(phrase), stance),
  );
}

function uniq(ids: string[]): string[] {
  return ids.filter((id, index) => ids.indexOf(id) === index);
}

/** 자동 경로의 확정 조건: 담은 문구의 조건 + 고른 추가 답변의 조건(그 입장 쪽만). */
export function autoConfirmedConditionIds(
  scenario: Scenario,
  stance: AutoSide,
  followUp: FollowUpOption | null,
): string[] {
  const ids = autoPhrasePicks(scenario, stance).map((phrase) => phrase.conditionId as string);
  if (followUp?.proposeConditionId) ids.push(followUp.proposeConditionId);
  return filterConditionIdsForStance(scenario, uniq(ids), stance);
}

/** 참가자 입장 쪽 임원 표 수(규칙표로 계산). */
function targetVoteCount(scenario: Scenario, stance: AutoSide, followUp: FollowUpOption | null): number {
  const motion = freezeMotion(scenario, autoConfirmedConditionIds(scenario, stance, followUp), 0);
  const target = participantTargetVote(stance);
  return decideBoard(scenario, motion, stance, true).filter((ballot) => ballot.vote === target).length;
}

/** 추가 답변 후보(그 입장 쪽·넘어가기 제외) 중 임원 표를 가장 많이 얻는 것. 동률은 목록 순. */
export function pickAutoFollowUp(scenario: Scenario, stance: AutoSide): FollowUpOption | null {
  let best: FollowUpOption | null = null;
  let bestCount = -1;
  for (const option of scenario.followUp.options) {
    if (option.keepPrevious || !matchesSide(option.side, stance)) continue;
    const count = targetVoteCount(scenario, stance, option);
    if (count > bestCount) {
      best = option;
      bestCount = count;
    }
  }
  return best;
}

function action(kind: AutoActionKind, targetId: string, caption: string): AutoAction {
  return { kind, targetId, caption, durationMs: autoActionMs(caption) };
}

/** 스테이지별 자동 동작 목록. DISCUSS는 참가자가 입장을 누른 뒤(stance 필요), 나머지는 입장과 무관하다. */
export function autoPlan(stage: AutoStage, scenario: Scenario, stance: AutoSide | null = null): AutoAction[] {
  switch (stage) {
    case 'BRIEFING':
      return scenario.evidence.map((card) => action('OPEN_EVIDENCE', card.id, card.insight));
    case 'OPINIONS':
      return scenario.initialOpinions.map((opinion) =>
        action('HIGHLIGHT_EXEC', opinion.memberId, opinion.bubble ?? opinion.text),
      );
    case 'DISCUSS': {
      if (!stance) return [];
      return [
        ...autoPhrasePicks(scenario, stance).map((phrase) => action('ADD_PHRASE', phrase.id, phrase.text)),
        ...AUTO_ASSISTANT_STEPS.map((step) => action('OPEN_ASSISTANT', step, `비서실장 ${step}번을 열어 봅니다.`)),
        action('APPLY_ASSISTANT', '3', '정리한 결과를 내 발언에 적용합니다.'),
      ];
    }
    case 'REACTIONS': {
      if (!stance) return [];
      const pick = pickAutoFollowUp(scenario, stance);
      return [
        action('ADVANCE_REACTION', '2', '임원 반응을 들었으니 추가 질문으로 넘어갑니다.'),
        ...(pick ? [action('PICK_FOLLOWUP', String(scenario.followUp.options.indexOf(pick)), pick.text)] : []),
      ];
    }
    case 'MOTION': {
      const stanceForMotion = stance ?? 'FOR';
      const pick = pickAutoFollowUp(scenario, stanceForMotion);
      return autoConfirmedConditionIds(scenario, stanceForMotion, pick).map((id) =>
        action(
          'HIGHLIGHT_CONDITION',
          id,
          `${scenario.conditions.find((condition) => condition.id === id)?.label ?? id}이(가) 안건에 반영됩니다.`,
        ),
      );
    }
  }
}

/** 첫 동작 전 잠깐 기다리는 시간(화면이 자리 잡은 뒤 시작). */
export const AUTO_LEAD_MS = 800;
/** 자막 한 글자를 치는 간격. */
export const AUTO_TYPE_MS = 55;
/** 자막을 다 친 뒤 읽을 시간(2026-10-30 사용자 지시 "끝나기 전에 지나가서 더 천천히"). */
export const AUTO_READ_MS = 2000;

/** 한 동작이 머무는 시간: 자막을 다 치고 읽을 시간까지, 짧아도 AUTO_ACTION_MS. */
export function autoActionMs(caption: string): number {
  return Math.max(AUTO_ACTION_MS, caption.length * AUTO_TYPE_MS + AUTO_READ_MS);
}

/** MOTION 자동 동작: 실제로 확정된 조건만 차례로 강조한다(확정 조건이 없으면 안내 한 줄). */
export function motionAutoPlan(scenario: Scenario, confirmedConditionIds: string[]): AutoAction[] {
  if (confirmedConditionIds.length === 0) {
    return [action('HIGHLIGHT_CONDITION', '', '붙은 조건이 없어 처음 안 그대로 표결합니다.')];
  }
  return confirmedConditionIds.map((id) =>
    action(
      'HIGHLIGHT_CONDITION',
      id,
      `${scenario.conditions.find((condition) => condition.id === id)?.label ?? id}이(가) 안건에 반영됩니다.`,
    ),
  );
}

export interface AutoProgress {
  /** 지금 하는 동작 순번. 아직 시작 전이면 -1, 끝났으면 plan.length. */
  index: number;
  /** 모든 동작이 끝나 참가자 차례가 됨(동작이 없으면 처음부터 true). */
  done: boolean;
  /** 지금 동작을 시작한 뒤 흐른 시간. */
  actionElapsedMs: number;
}

/** 시작 뒤 흐른 시간(주입 시계로 잰 값)으로 지금 동작을 정한다. */
export function autoProgress(plan: AutoAction[], elapsedMs: number): AutoProgress {
  if (plan.length === 0) return { index: 0, done: true, actionElapsedMs: 0 };
  let t = elapsedMs - AUTO_LEAD_MS;
  if (t < 0) return { index: -1, done: false, actionElapsedMs: 0 };
  for (const [i, step] of plan.entries()) {
    if (t < step.durationMs) return { index: i, done: false, actionElapsedMs: t };
    t -= step.durationMs;
  }
  return { index: plan.length, done: true, actionElapsedMs: 0 };
}

/** 자막 타이핑: 흐른 시간만큼의 앞부분. */
export function typedCaption(caption: string, actionElapsedMs: number): string {
  const count = Math.max(0, Math.floor(actionElapsedMs / AUTO_TYPE_MS) + 1);
  return caption.slice(0, count);
}
