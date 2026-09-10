// 결과 화면: 결론 → 동등한 5석 카드 → 내 원문·반영 조건 → 남은 과제 → AI가 도운 일
// 순서로 보여준다(docs/SCENARIO_AI_ASSISTANT.md "결과와 AI 효율 체험"). '체험 종료'는
// 운영자 새 체험(OPERATOR_RESET, 확인 절차 포함) 없이 바로 세션을 초기화하고
// ATTRACT로 돌아간다. 'AI가 도운 일'은 항상 자료 자동 정리를 포함하고, 그 밖의 도움은
// session.assistantActions(AssistantPanel이 남긴 레이블)이 있을 때만 보여준다(T12).
// T31: 그 레이블은 이제 mode·evidenceIds·applied를 담은 JSON(assistantLog.ts)이라, live
// 호출은 "(실제 AI 호출)"을 붙이고 scripted는 붙이지 않는다 — describeAdditionalHelp가
// 그 구분을 전담하므로 이 화면은 여전히 호출만 한다.
// T30: live 모드 임원 좌석에는 판단 근거(ballot.reason, ≤160자)와 남은 우려를 더하고,
// UNCAST 좌석은 사유를 함께 보여준다. 응답 장애로 판단이 제한됐으면(tally().limitedBy
// Unavailable) 공통 안내를 띄운다. scripted 표에는 reason이 없으므로 그대로 조용하다.

import { useMemo } from 'react';
import type { Scenario } from '../../content/types';
import type { Ballot, MemberId, Session } from '../../domain/types';
import { EXEC_MEMBER_ORDER, tally } from '../../domain/voting';
import { describeAdditionalHelp } from '../../domain/assistantLog';
import { MEMBER_LABELS } from '../memberLabels';
import { collectConfirmedConditionIds } from '../opinionConditions';
import { Avatar } from '../parts/Avatar';
import '../../styles/screens/result.css';
import '../../styles/screens/live.css';

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

const MODE_NOTICE_TEXT: Record<Session['mode'], string> = {
  live: '실시간(LIVE) 임원 에이전트 판단입니다.',
  scripted: '사전 구성 시뮬레이션 결과입니다.',
};

export function ResultScreen({ scenario, session, onReset }: ResultScreenProps) {
  const finalMotion = session.finalMotion;

  const additionalHelp = useMemo(
    () => describeAdditionalHelp(session.assistantActions),
    [session.assistantActions],
  );

  const tallyResult = useMemo(() => tally(session.ballots), [session.ballots]);

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
      <p className="result-screen__mode-notice" data-testid="result-mode-notice">
        {MODE_NOTICE_TEXT[session.mode]}
      </p>
      {tallyResult.limitedByUnavailable && (
        <p className="result-screen__limited-notice" data-testid="result-limited-notice">
          일부 임원 미표결로 판단이 제한되었습니다.
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
              <Avatar memberId={memberId} />
              <h3 className="result-seat__member">{seatLabel(memberId)}</h3>
              <p className="result-seat__vote">{VOTE_TEXT[vote]}</p>
              {ballot?.reason && (
                <p className="result-seat__reason" data-testid={`result-seat-reason-${memberId}`}>
                  {ballot.reason}
                </p>
              )}
              {ballot?.remainingConcerns && ballot.remainingConcerns.length > 0 && (
                <p className="result-seat__concerns" data-testid={`result-seat-concerns-${memberId}`}>
                  남은 우려: {ballot.remainingConcerns.join(', ')}
                </p>
              )}
              {vote === 'UNCAST' && ballot?.unavailableReason && (
                <p className="result-seat__unavailable" data-testid={`result-seat-unavailable-${memberId}`}>
                  {ballot.unavailableReason}
                </p>
              )}
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
      {/* 결과 화면은 5석·기록 패널을 모두 담으면 한 뷰포트보다 길어질 수 있어,
          CTA를 sticky 대신 내용 끝에 두고 스크롤로 닿게 한다(sticky는 스크롤
          중간에 앞선 기록 위에 겹쳐 보이는 문제가 있어 여기서는 쓰지 않는다). */}
      <button type="button" className="cta" onClick={onReset} data-testid="end-session">
        체험 종료
      </button>
    </section>
  );
}
