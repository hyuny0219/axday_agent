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
// T45(조종석 배치): 왼쪽 열은 게이지 + "체험 종료" CTA만(무대 위 배지·도장은 StageBand가
// 그린다), 오른쪽 열은 결론·5석·기록 3패널을 담는다(DESIGN_SPEC.md v1.0 6절 표). 기록
// 패널 중 'AI가 도운 일' 하나만 내부 스크롤(overflow-y:auto + 아래쪽 페이드)이고, 내
// 의견 인용은 4줄로 클램프한다(result.css).

import { useEffect, useMemo, useState } from 'react';
import type { Scenario } from '../../content/types';
import type { Ballot, MemberId, Session } from '../../domain/types';
import { EXEC_MEMBER_ORDER, countVotesChangedByConditions, tally } from '../../domain/voting';
import { describeAdditionalHelp } from '../../domain/assistantLog';
import { MEMBER_LABELS } from '../memberLabels';
import { collectConfirmedConditionIds } from '../opinionConditions';
import { SEAT_REVEAL_STEP_SECONDS } from '../resultStamp';
import { epilogueText } from '../resultEpilogue';
import { Avatar } from '../parts/Avatar';
// 결론 도장(result-stamp)은 T44에서 무대 열 우하단으로 옮겨 AppShell이 StageBand에
// 넘긴다(components/resultStamp.ts computeResultStamp). 이 화면은 더는 도장을
// 직접 그리지 않는다 — 5석·게이지·기록만 담당한다.
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

// 반대·보류·미표결은 색만으로 구분하지 않고 아이콘을 더한다(DESIGN_SPEC.md 4장
// "반대·보류·미표결은 색+텍스트+아이콘"). 찬성은 색+텍스트만으로도 구분에 문제가
// 없어 아이콘을 더하지 않는다. 장식이므로 스크린리더에는 노출하지 않는다
// (텍스트 라벨이 이미 접근 가능한 이름을 제공한다).
const VOTE_ICON: Partial<Record<Ballot['vote'], string>> = {
  HOLD: '⏸',
  NO: '✕',
  UNCAST: '–',
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

  // scripted에서만 계산한다(조건 없는 안건의 임원 표와 실제 표를 비교). live 표는 임원
  // 에이전트가 실제로 판단한 결과라 "조건 없는 안건" 가정 자체가 성립하지 않는다.
  const votesChangedByConditions = useMemo(() => {
    if (session.mode !== 'scripted' || !finalMotion) {
      return null;
    }
    return countVotesChangedByConditions(scenario, finalMotion);
  }, [session.mode, scenario, finalMotion]);

  // 클릭·키 입력으로 배지·도장 연출을 즉시 건너뛴다(DESIGN_SPEC.md v1.0 3절). 건너뛴
  // 뒤에는 리스너를 더 둘 이유가 없어 정리한다.
  const [skip, setSkip] = useState(false);
  useEffect(() => {
    if (skip) {
      return;
    }
    function handleSkip() {
      setSkip(true);
    }
    window.addEventListener('click', handleSkip);
    window.addEventListener('keydown', handleSkip);
    return () => {
      window.removeEventListener('click', handleSkip);
      window.removeEventListener('keydown', handleSkip);
    };
  }, [skip]);

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

  // 가결은 도장과 같은 기준(반영 조건 유무)으로 pass/passOriginal을 가른다
  // (components/resultEpilogue.ts, PR #8 Codex 2차 검토).
  const epilogue = epilogueText(
    session.outcome,
    includedIds.length > 0,
    scenario.resultCopy.sixMonthsLater,
  );

  return (
    <>
      <div className="app-body__actions screen result-screen__actions">
        {votesChangedByConditions !== null && (
          <p className="result-screen__gauge" data-testid="result-gauge">
            내 조건이 바꾼 표 {votesChangedByConditions}명 / 4명
          </p>
        )}
        {epilogue !== null && (
          <section className="result-epilogue" data-testid="result-epilogue">
            <div className="result-epilogue__header">
              <h3 className="result-epilogue__heading">6개월 뒤</h3>
              <span className="result-epilogue__badge">체험용 가상 전망</span>
            </div>
            <p className="result-epilogue__text">{epilogue}</p>
          </section>
        )}
        <button type="button" className="cta" onClick={onReset} data-testid="end-session">
          체험 종료
        </button>
      </div>
      <div className="app-body__content screen result-screen" data-skip={skip}>
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
        {/* 표결 배지 순차 공개(DESIGN_SPEC.md v1.0 3절). 결론 도장은 T44에서 무대 열
            우하단으로 옮겨 AppShell이 StageBand 안에 렌더한다(같은 STAMP_DELAY_SECONDS를
            쓴다). 5석 카드 텍스트는 처음부터 그대로 있고, 여기서는 CSS animation-delay로
            시각 효과만 늦춘다(setTimeout 없음). 클릭·키 입력이 오면 data-skip='true'가
            붙어 모든 지연·재생 시간을 0에 가깝게 만든다. */}
        <div className="result-screen__seats">
          {SEAT_ORDER.map((memberId, index) => {
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
                <p
                  className="result-seat__vote result-seat__vote--reveal"
                  style={{ animationDelay: `${index * SEAT_REVEAL_STEP_SECONDS}s` }}
                >
                  {VOTE_ICON[vote] && (
                    <span className="result-seat__vote-icon" aria-hidden="true">
                      {VOTE_ICON[vote]}
                    </span>
                  )}
                  {VOTE_TEXT[vote]}
                </p>
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
        {/* 세 기록 패널을 나란히 둔다. 'AI가 도운 일'만 내부 스크롤(화면당 유일한
            스크롤 패널, DESIGN_SPEC.md v1.0 6절)이고, 내 의견 인용은 4줄로 클램프해
            자체적으로 세로 예산을 넘지 않게 한다. */}
        <div className="result-screen__records">
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
            <div className="result-screen__ai-help-scroll">
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
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
