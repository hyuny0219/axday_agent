// 최종 투표 화면: 안건 카드 아래 찬성/보류/반대 radio(초기 미선택)와 별도 확정
// CTA를 둔다. 확정 버튼은 선택 전 비활성이며, 클릭 즉시 비활성화해 이중 확정을
// 막는다(DESIGN_SPEC.md 4장 "최종 투표 radio"). live 모드에서 참가자가 확정한 뒤에도
// 임원 표가 아직 도착하지 않았으면(execBallotsPending) "임원 판단을 기다리는 중"을
// 보여준다(T30, AGENT_BOARDROOM_SPEC.md 6장 "8초 또는 deadline을 넘지 않는다"). 임원
// 표 자체는 이 화면에서 절대 보여주지 않는다 — RESULT 전 비공개다.

import { useState } from 'react';
import type { Scenario } from '../../content/types';
import type { Motion, PendingVote, SessionMode } from '../../domain/types';
import '../../styles/screens/vote.css';
import '../../styles/screens/live.css';

export interface VoteScreenProps {
  scenario: Scenario;
  motion: Motion;
  pendingVote: PendingVote | null;
  mode: SessionMode;
  execBallotsPending: boolean;
  onSelectVote: (vote: PendingVote) => void;
  onConfirmVote: () => void;
}

const VOTE_ORDER: readonly PendingVote[] = ['YES', 'HOLD', 'NO'];

const VOTE_LABELS: Record<PendingVote, string> = {
  YES: '찬성',
  HOLD: '보류',
  NO: '반대',
};

export function VoteScreen({
  scenario,
  motion,
  pendingVote,
  mode,
  execBallotsPending,
  onSelectVote,
  onConfirmVote,
}: VoteScreenProps) {
  // CONFIRM_VOTE는 reducer에서도 재확정을 막지만, 화면 전환 전 빠른 재클릭까지
  // 막기 위해 클릭 즉시 로컬 상태로도 버튼을 비활성화한다.
  const [submitted, setSubmitted] = useState(false);

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

  return (
    <section className="screen vote-screen">
      <h2 className="vote-screen__title">최종 투표</h2>
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
      <div className="screen__sticky-footer">
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
    </section>
  );
}
