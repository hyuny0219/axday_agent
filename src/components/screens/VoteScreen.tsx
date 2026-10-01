// 최종 투표 화면: 안건 카드 아래 찬성/반대 radio(초기 미선택)와 별도 확정
// CTA를 둔다. 확정 버튼은 선택 전 비활성이며, 클릭 즉시 비활성화해 이중 확정을
// 막는다(DESIGN_SPEC.md 4장 "최종 투표 radio"). live 모드에서 참가자가 확정한 뒤에도
// 임원 표가 아직 도착하지 않았으면(execBallotsPending) "임원 판단을 기다리는 중"을
// 보여준다(T30, AGENT_BOARDROOM_SPEC.md 6장). 임원 표 자체는 이 화면에서 절대 보여주지
// 않는다 — RESULT 전 비공개다.
// T45(조종석 배치): 왼쪽 열은 찬성/반대 2열 + 확정 CTA, 오른쪽 열은 안건 카드·
// 조건을 담는다(DESIGN_SPEC.md v1.0 6절 표). T62: 보류를 없애 2열로 줄였다.
// T65: roleStatus에 'failed'가 있으면(응답 실패, 아직 UNCAST로 확정되지 않음) "미표결
// 임원 다시 요청" 버튼을 보여준다. 1회만 쓸 수 있다 — 누르면 orchestrator가 그 역할만
// 다시 부르고, 성공하든 실패하든 결과를 바로 확정한다(runner.ts retryFinalVotes).

import { ExecStanceList } from '../parts/ExecStanceList';
import type { ExecMemberId } from '../../content/types';
import type { RoleStatus, Stance } from '../../domain/types';
import { useState } from 'react';
import type { Scenario } from '../../content/types';
import type { Motion, PendingVote, SessionMode } from '../../domain/types';
import { EXEC_MEMBER_ORDER } from '../../domain/voting';
import '../../styles/screens/vote.css';
import '../../styles/screens/live.css';

export interface VoteScreenProps {
  scenario: Scenario;
  motion: Motion;
  pendingVote: PendingVote | null;
  mode: SessionMode;
  execBallotsPending: boolean;
  /** 무대 표정 배지의 접근 가능한 텍스트(sr-only, PR #11 Codex 13차). */
  stances: Record<ExecMemberId, Stance>;
  /** 실패한 역할을 가려내 "미표결 임원 다시 요청" 버튼을 보여줄 때만 쓴다(T65). */
  roleStatus?: Record<ExecMemberId, RoleStatus>;
  onSelectVote: (vote: PendingVote) => void;
  onConfirmVote: () => void;
  /** 있으면 실패한 역할만 최종표를 다시 요청한다(T65 "미표결 임원 다시 요청", 1회). */
  onRetryFailedRoles?: (roleIds: ExecMemberId[]) => void;
}

const VOTE_ORDER: readonly PendingVote[] = ['YES', 'NO'];

const VOTE_LABELS: Record<PendingVote, string> = {
  YES: '찬성',
  NO: '반대',
};

export function VoteScreen({
  scenario,
  stances,
  motion,
  pendingVote,
  mode,
  execBallotsPending,
  roleStatus,
  onSelectVote,
  onConfirmVote,
  onRetryFailedRoles,
}: VoteScreenProps) {
  // CONFIRM_VOTE는 reducer에서도 재확정을 막지만, 화면 전환 전 빠른 재클릭까지
  // 막기 위해 클릭 즉시 로컬 상태로도 버튼을 비활성화한다.
  const [submitted, setSubmitted] = useState(false);
  // 1회 제한(T65) — server/sessionLimit.ts의 호출 상한(vote: 2)이 최종 방어선이다.
  const [retryUsed, setRetryUsed] = useState(false);

  function conditionLabel(id: string): string {
    return scenario.conditions.find((condition) => condition.id === id)?.label ?? id;
  }

  function handleConfirm() {
    if (pendingVote === null || submitted) {
      return;
    }
    setSubmitted(true);
    onConfirmVote();
  }

  const failedRoleIds = roleStatus
    ? EXEC_MEMBER_ORDER.filter((roleId) => roleStatus[roleId] === 'failed')
    : [];

  function handleRetry() {
    if (failedRoleIds.length === 0 || !onRetryFailedRoles) {
      return;
    }
    setRetryUsed(true);
    onRetryFailedRoles(failedRoleIds);
  }

  return (
    <>
      <div className="app-body__actions screen vote-screen">
        <fieldset className="vote-screen__choices" disabled={submitted}>
          <legend className="vote-screen__section-label">이사님의 최종 표를 선택해 주세요</legend>
          {VOTE_ORDER.map((vote) => (
            <label
              key={vote}
              className={`vote-choice vote-choice--${vote.toLowerCase()}${
                pendingVote === vote ? ' vote-choice--selected' : ''
              }`}
            >
              <input
                type="radio"
                name="final-vote"
                value={vote}
                checked={pendingVote === vote}
                onChange={() => onSelectVote(vote)}
                data-testid={`vote-radio-${vote}`}
              />
              {VOTE_LABELS[vote]}
            </label>
          ))}
        </fieldset>
        {mode === 'live' && submitted && execBallotsPending && (
          <p className="vote-screen__waiting" data-testid="vote-waiting-execs">
            임원 판단을 기다리는 중…
          </p>
        )}
        {mode === 'live' && submitted && onRetryFailedRoles && failedRoleIds.length > 0 && (
          <button
            type="button"
            className="live-round__retry cta cta--secondary"
            data-testid="retry-failed-roles"
            disabled={retryUsed}
            onClick={handleRetry}
          >
            {retryUsed ? '다시 요청함 · 미표결로 확정됩니다' : '미표결 임원 다시 요청'}
          </button>
        )}
        <div className="screen__submit-row">
          <button
            type="button"
            className="cta"
            disabled={pendingVote === null || submitted}
            onClick={handleConfirm}
            data-testid="confirm-vote"
          >
            최종 투표 확정
          </button>
        </div>
      </div>
      <div className="app-body__content screen vote-screen__info">
        <h2 className="vote-screen__title">최종 투표</h2>
        <ExecStanceList stances={stances} />
        <article className="vote-screen__motion-card" data-testid="vote-motion-card">
          <p className="vote-screen__original">{scenario.originalMotion.text}</p>
          {motion.effectiveConditionIds.length > 0 ? (
            <ul className="vote-screen__conditions">
              {motion.effectiveConditionIds.map((id) => (
                <li key={id}>{conditionLabel(id)}</li>
              ))}
            </ul>
          ) : (
            <p className="vote-screen__no-conditions">원안 그대로 표결합니다.</p>
          )}
        </article>
      </div>
    </>
  );
}
