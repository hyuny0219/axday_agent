// 엔딩 화면(T127) 내용 계산. 성공·실패 판정과 같은 수치는 결과 화면이 이미 계산한 값을 받아 쓴다
// (computePersuasion·buildPersuasionResult). 실패 실마리는 "어느 임원이, 어느 근거 자료"까지만
// 말하고 조건 이름(함정·정답)은 말하지 않는다.

import type { ExecMemberId, Scenario, Vote } from '../content/types';
import type { Session } from '../domain/types';
import { EXEC_MEMBER_ORDER, decideMember, requiredConditionsFor } from '../domain/voting';
import type { PersuasionTally } from './persuasionSummary';

export type EndingSeatKind = 'me' | 'same' | 'other';

export interface EndingSeat {
  id: 'PARTICIPANT' | ExecMemberId;
  label: string;
  kind: EndingSeatKind;
  mark: string;
}

export interface EndingModel {
  success: boolean;
  stampText: '성공' | '실패';
  reason: string;
  seats: EndingSeat[];
  outcomeLine: string;
  epilogueLine: string | null;
  /** 실패일 때만, 쓸 정보가 있을 때만. */
  clue: string | null;
  conditionLabels: string[];
}

const SHORT_LABEL: Record<ExecMemberId, string> = { CEO: 'CEO', CFO: 'CFO', CAIO: 'CAIO', CISO: 'CISO' };

/** 에필로그 첫 문장만. 마침표가 없으면 전체. */
export function firstSentence(text: string | null): string | null {
  if (!text) return null;
  const index = text.indexOf('.');
  return index >= 0 ? text.slice(0, index + 1) : text;
}

function clueFor(
  scenario: Scenario,
  session: Pick<Session, 'mode' | 'followUpAnswered'>,
  votes: Record<ExecMemberId, Vote>,
  participantVote: Vote,
  finalConditionIds: string[],
  participantStance: 'FOR' | 'AGAINST' | null,
): string | null {
  if (session.followUpAnswered === false) {
    return '추가 질문에 답해야 임원의 마음이 확정됩니다. 다음엔 답하러 가 보세요.';
  }
  const others = EXEC_MEMBER_ORDER.filter((memberId) => votes[memberId] !== participantVote);
  if (others.length === 0) return null;
  let memberId: ExecMemberId | undefined;
  if (participantVote === 'NO') {
    // 반대가 목표인 실패: 찬성한 임원 중 조건 하나를 더하면 반대로 돌아설 수 있고, 처음부터 우려를
    // 가진(첫 입장이 찬성이 아닌) 임원만 가리킨다 — 첫 입장이 찬성인 임원의 근거 자료는 찬성 쪽이라
    // 방향이 어긋난다. 규칙표가 없는 live이거나 그런 임원이 없으면 줄을 생략한다.
    if (session.mode !== 'scripted') return null;
    memberId = others.find((candidate) => {
      const opening = scenario.initialOpinions.find((opinion) => opinion.memberId === candidate)?.openingStance;
      if (opening === 'FOR') return false;
      return scenario.conditions.some(
        (condition) =>
          !finalConditionIds.includes(condition.id) &&
          decideMember(scenario.voteRules[candidate], {
            conditionIds: [...finalConditionIds, condition.id],
            executionMode: 'DEFAULT',
            participantStance,
            followUpAnswered: true,
          }) === 'NO',
      );
    });
  } else {
    // scripted에서는 조건으로 움직일 수 있는 임원을 먼저 가리킨다(조건 이름은 말하지 않는다).
    const movable =
      session.mode === 'scripted'
        ? others.find((candidate) => {
            const required = requiredConditionsFor(scenario, candidate, finalConditionIds, participantStance);
            return !required.persuaded && required.conditionIds !== null;
          })
        : undefined;
    memberId = movable ?? others[0];
  }
  if (!memberId) return null;
  const evidenceId = scenario.initialOpinions.find((opinion) => opinion.memberId === memberId)?.evidenceIds[0];
  const evidence = scenario.evidence.find((card) => card.id === evidenceId);
  if (!evidence) return null;
  return `${SHORT_LABEL[memberId]}의 걱정은 '${evidence.title}'를 다시 보면 실마리가 있습니다.`;
}

export function buildEnding(input: {
  scenario: Scenario;
  session: Pick<Session, 'mode' | 'followUpAnswered'>;
  earned: boolean;
  sameVoteSeats: number;
  participantVote: Vote;
  execVotes: Record<ExecMemberId, Vote>;
  persuasionTally: PersuasionTally | null;
  resultStampText: string;
  epilogue: string | null;
  conditionLabels: string[];
  finalConditionIds: string[];
  participantStance: 'FOR' | 'AGAINST' | null;
}): EndingModel {
  const persuadedCount = input.persuasionTally?.persuaded.length ?? 0;
  const seatsText = `같은 표 ${input.sameVoteSeats}석`;
  const reason = input.earned
    ? persuadedCount > 0
      ? `AI 임원 ${persuadedCount}명을 같은 편으로 만들었습니다 · ${seatsText}`
      : `${seatsText}으로 이사님 편이 다수가 됐습니다`
    : `${seatsText} · 3석부터 성공입니다`;
  const seats: EndingSeat[] = [
    { id: 'PARTICIPANT', label: '특별 이사', kind: 'me', mark: '나' },
    ...EXEC_MEMBER_ORDER.map((memberId): EndingSeat => {
      const same = input.execVotes[memberId] === input.participantVote;
      return { id: memberId, label: SHORT_LABEL[memberId], kind: same ? 'same' : 'other', mark: same ? '✓' : '✕' };
    }),
  ];
  return {
    success: input.earned,
    stampText: input.earned ? '성공' : '실패',
    reason,
    seats,
    outcomeLine: `안건은 ${input.resultStampText}됐습니다.`,
    epilogueLine: firstSentence(input.epilogue),
    clue: input.earned
      ? null
      : clueFor(
          input.scenario,
          input.session,
          input.execVotes,
          input.participantVote,
          input.finalConditionIds,
          input.participantStance,
        ),
    conditionLabels: input.earned ? input.conditionLabels : [],
  };
}
