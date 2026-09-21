// "이사회 한 장 요약" 패널이 쓰는 순수 함수(v1.0 9절, T48). 집계·내가 붙인 조건·
// 임원별 판단 이유와 바뀐 표·내 표의 결정력·내 의견 원문을 한 화면에서 읽을 수 있게
// 세션 상태 하나로 계산한다. scripted는 explainBoard(표결 규칙 데이터)에서 이유·바뀐
// 표를 읽고, live는 session.ballots의 reason(없으면 unavailableReason, 그것도 없으면
// "판단 근거 없음")을 읽으며 changed는 항상 false다(live 표는 임원 에이전트가 실제로
// 판단한 결과라 "조건 없는 안건" 가정 자체가 성립하지 않는다 — ResultScreen의 게이지와
// 같은 이유).

import type { ExecMemberId, Scenario, Vote } from '../content/types';
import type { Session } from '../domain/types';
import { EXEC_MEMBER_ORDER, explainBoard, participantDecisive, tally, type TallyResult } from '../domain/voting';
import { collectConfirmedConditionIds } from './opinionConditions';

const NO_REASON_TEXT = '판단 근거 없음';

export interface ResultSummaryExecRow {
  memberId: ExecMemberId;
  vote: Vote;
  reason: string;
  /** scripted에서만 true일 수 있다(조건 없는 안건의 표와 실제 표가 다를 때). */
  changed: boolean;
}

export interface ResultSummaryParticipant {
  vote: Vote;
  /** 참가자 표를 다른 어느 값으로 바꿔도 결론이 달라지면 true(participantDecisive). */
  decisive: boolean;
}

export interface ResultSummary {
  tally: TallyResult;
  /** 참가자가 확정하고 최종 안건에 반영된 조건의 라벨(순서 유지). 비어 있으면 "조건 없이
   * 원안 그대로 상정"을 화면이 표시한다. */
  conditionLabels: string[];
  execRows: ResultSummaryExecRow[];
  participant: ResultSummaryParticipant;
  /** 내 의견 원문(제출 순서, DISCUSS + REACTIONS 후속 보완 포함). */
  quote: string[];
}

/** 결과 화면 "이사회 한 장 요약" 패널이 쓰는 값 하나로 묶는다. session.finalMotion이
 * 없으면(RESULT 전) 던진다 — 호출부(ResultScreen)는 이미 finalMotion 가드 뒤에서만
 * 부른다. */
export function buildResultSummary(scenario: Scenario, session: Session): ResultSummary {
  const finalMotion = session.finalMotion;
  if (!finalMotion) {
    throw new Error('최종 안건이 확정되지 않아 이사회 한 장 요약을 만들 수 없습니다.');
  }

  const tallyResult = tally(session.ballots);

  const allConfirmedIds = collectConfirmedConditionIds(session.opinions);
  const includedIds = allConfirmedIds.filter((id) =>
    finalMotion.effectiveConditionIds.includes(id),
  );
  const conditionLabels = includedIds.map(
    (id) => scenario.conditions.find((condition) => condition.id === id)?.label ?? id,
  );

  const execRows: ResultSummaryExecRow[] =
    session.mode === 'scripted'
      ? explainBoard(scenario, finalMotion).map((row) => ({
          memberId: row.memberId,
          vote: row.vote,
          reason: row.reason ?? NO_REASON_TEXT,
          changed: row.changed,
        }))
      : EXEC_MEMBER_ORDER.map((memberId) => {
          const ballot = session.ballots.find((b) => b.memberId === memberId);
          return {
            memberId,
            vote: ballot?.vote ?? 'UNCAST',
            reason: ballot?.reason ?? ballot?.unavailableReason ?? NO_REASON_TEXT,
            changed: false,
          };
        });

  const participantBallot = session.ballots.find((b) => b.memberId === 'PARTICIPANT');

  return {
    tally: tallyResult,
    conditionLabels,
    execRows,
    participant: {
      vote: participantBallot?.vote ?? 'UNCAST',
      decisive: participantDecisive(session.ballots),
    },
    quote: session.opinions.map((opinion) => opinion.originalText),
  };
}
