// 결과 화면: 결론 → 동등한 5석 카드 → 내 원문·반영 조건 → 남은 과제 → AI가 도운 일
// 순서로 보여준다(docs/SCENARIO_AI_ASSISTANT.md "결과와 AI 효율 체험"). '체험 종료'는
// 운영자 새 체험(OPERATOR_RESET, 확인 절차 포함) 없이 바로 세션을 초기화하고
// ATTRACT로 돌아간다. 'AI가 도운 일'은 항상 자료 자동 정리를 포함하고, 그 밖의 도움은
// session.assistantActions(AssistantPanel이 남긴 레이블)이 있을 때만 보여준다(T12).

import { useMemo } from 'react';
import type { Scenario } from '../../content/types';
import type { Ballot, MemberId, Session } from '../../domain/types';
import { EXEC_MEMBER_ORDER } from '../../domain/voting';
import { describeAdditionalHelp } from '../../domain/assistantLog';
import { MEMBER_LABELS } from '../memberLabels';
import { collectConfirmedConditionIds } from '../opinionConditions';
import '../../styles/screens/result.css';

export interface ResultScreenProps {
  scenario: Scenario;
  session: Session;
  onReset: () => void;
}

const SEAT_ORDER: readonly MemberId[] = [...EXEC_MEMBER_ORDER, 'PARTICIPANT'];

function seatLabel(memberId: MemberId): string {
  if (memberId === 'PARTICIPANT') {
    return '나 · 특별 이사';
  }
  return MEMBER_LABELS[memberId];
}

const VOTE_TEXT: Record<Ballot['vote'], string> = {
  YES: '찬성',
  HOLD: '보류',
  NO: '반대',
  UNCAST: '미표결',
};

export function ResultScreen({ scenario, session, onReset }: ResultScreenProps) {
  const finalMotion = session.finalMotion;

  const additionalHelp = useMemo(
    () => describeAdditionalHelp(session.assistantActions),
    [session.assistantActions],
  );

  const allConfirmedIds = useMemo(() => collectConfirmedConditionIds(session.opinions), [session.opinions]);
  const includedIds = useMemo(
    () => allConfirmedIds.filter((id) => finalMotion?.effectiveConditionIds.includes(id) ?? false),
    [allConfirmedIds, finalMotion],
  );

  if (!finalMotion) {
    return null;
  }

  function conditionLabel(id: string): string {
    return scenario.conditions.find((condition) => condition.id === id)?.label ?? id;
  }

  const conclusion =
    session.outcome === 'PASS'
      ? scenario.resultCopy.pass
      : session.outcome === 'REJECT'
        ? scenario.resultCopy.reject
        : scenario.resultCopy.hold;

  return (
    <section className="screen result-screen">
      <h2 className="result-screen__title" data-testid="result-conclusion">
        {conclusion}
      </h2>
      {session.expiredWithoutMotion && (
        <p className="result-screen__expired-notice" data-testid="expired-without-motion-notice">
          시간 종료로 원안을 집계합니다. 미확정 수정 조건은 반영되지 않았습니다.
        </p>
      )}
      <div className="result-screen__seats">
        {SEAT_ORDER.map((memberId) => {
          const ballot = session.ballots.find((b) => b.memberId === memberId);
          const vote = ballot?.vote ?? 'UNCAST';
          return (
            <article
              key={memberId}
              className={`result-seat result-seat--${vote.toLowerCase()}`}
              data-testid={`result-seat-${memberId}`}
            >
              <h3 className="result-seat__member">{seatLabel(memberId)}</h3>
              <p className="result-seat__vote">{VOTE_TEXT[vote]}</p>
            </article>
          );
        })}
      </div>
      <section className="result-screen__mine" data-testid="result-mine">
        <h3 className="result-screen__section-label">내 의견</h3>
        {session.opinions.map((opinion) => (
          <p key={opinion.id} className="result-screen__quote">
            {opinion.originalText}
          </p>
        ))}
        {allConfirmedIds.length > 0 ? (
          <ul className="result-screen__conditions">
            {allConfirmedIds.map((id) => (
              <li key={id}>
                {conditionLabel(id)}
                {includedIds.includes(id) && (
                  <span className="result-screen__reflected-tag"> 반영</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="result-screen__no-conditions">확정한 수정 조건이 없습니다.</p>
        )}
      </section>
      <section className="result-screen__tasks">
        <h3 className="result-screen__section-label">남은 과제</h3>
        <ul>
          {scenario.remainingTasks.map((task) => (
            <li key={task}>{task}</li>
          ))}
        </ul>
      </section>
      <section className="result-screen__ai-help" data-testid="result-ai-help">
        <h3 className="result-screen__section-label">AI가 도운 일</h3>
        <ul className="result-screen__ai-help-list">
          <li>자료 4장 자동 정리 데모 표시</li>
          {additionalHelp.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {additionalHelp.length === 0 && (
          <p className="result-screen__ai-help-none" data-testid="result-ai-help-none">
            추가 AI 도움은 사용하지 않았습니다.
          </p>
        )}
      </section>
      <button type="button" className="cta" onClick={onReset} data-testid="end-session">
        체험 종료
      </button>
    </section>
  );
}
