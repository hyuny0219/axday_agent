// 최종 투표 화면: 안건 카드 아래 찬성/반대 radio(초기 미선택)와 별도 확정
// CTA를 둔다. 확정 버튼은 선택 전 비활성이며, 클릭 즉시 비활성화해 이중 확정을
// 막는다(DESIGN_SPEC.md 4장 "최종 투표 radio"). 임원 표 자체는 이 화면에서 절대
// 보여주지 않는다 — RESULT 전 비공개다.
// T76(docs/design/mockups/S6_Vote.html 시안 그대로): 왼쪽 열은 무대(StageBand,
// App.tsx가 그린다) 아래 "BALLOTS · 임원 표" HUD 패널(임원 4명 모두 항상 봉인된 "?"
// 배지 — 임원 표는 이 화면에서 절대 공개하지 않는다는 기존 규칙을 그대로 지킨다)과
// 그 아래 안내 한 줄(live에서 임원 응답이 아직 도착하지 않았을 때만, 실패한 역할이
// 있으면 그 자리가 "미표결 임원 다시 요청" 버튼으로 바뀐다) → TRANSCRIPT(App.tsx의
// MinutesPanel)이다. 오른쪽 종이 한 장에 STEP 05·2/2 + 제목 + CONFIDENTIAL 도장,
// MOTION 한 줄 상자, 찬성/반대 큰 원형 도장 라디오 2칸, 바닥 CTA를 담는다. CTA·라디오는
// 시안처럼 오른쪽 종이 안에 둔다(원래 "CTA는 항상 왼쪽 열" 원칙의 예외 — 이 화면은
// 왼쪽 열에 입력 상자가 전혀 없고 판단 요소 자체가 오른쪽 종이 한 장이다).
// PR #12 Codex 5차 검토(P1): MOTION 상자 문장 아래에 반영 조건을(있을 때만) 눈에
// 보이는 pill로 더했다 — motion.text는 원안 그대로라 반영 조건이 화면에 안 보이면
// 임원 표가 조건에 따라 갈려도(domain/voting.ts) 투표자가 그 이유를 볼 수 없었다.
// 같은 정보를 숨겨 두던 옛 sr-only 문단은 더 이상 필요 없어 뺐다.

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
  /** 무대 표정 배지의 접근 가능한 텍스트(T63). */
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

/** 원형 도장 라디오 아래 타자기 캡션(시안 "APPROVE · 선택됨"/"REJECT"). */
const VOTE_STAMP_LABELS: Record<PendingVote, string> = {
  YES: 'APPROVE',
  NO: 'REJECT',
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
  const showRetry = mode === 'live' && Boolean(onRetryFailedRoles) && failedRoleIds.length > 0;
  // BALLOTS 패널 안내 한 줄은 live에서 임원 표가 아직 다 도착하지 않았을 때만 보여준다
  // (참가자가 자기 표를 확정했는지와는 무관하다 — FREEZE_MOTION 즉시 live에서는
  // execBallotsPending이 true로 시작한다, domain/session.ts). 실패한 역할이 있으면 이
  // 줄 자리를 재요청 버튼이 대신한다(시안 "실패 시 버튼이 이 줄 자리에").
  const showWaiting = mode === 'live' && execBallotsPending && !showRetry;

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
        <ExecStanceList stances={stances} />
        <div className="vote-screen__ballots" data-testid="vote-ballots">
          <div className="vote-screen__ballots-head">
            <span>BALLOTS · 임원 표</span>
            <span className="vote-screen__ballots-privacy">참가자 확정 전 비공개</span>
          </div>
          <div className="vote-screen__ballots-grid">
            {EXEC_MEMBER_ORDER.map((memberId) => (
              <div
                key={memberId}
                className={`vote-screen__ballot vote-screen__ballot--${memberId.toLowerCase()}`}
              >
                <span className="vote-screen__ballot-code">{memberId}</span>
                {/* 임원 표는 이 화면에서 절대 보여주지 않는다 — 항상 봉인 배지다
                    (RESULT 전 비공개, 기존 규칙 그대로). */}
                <span className="vote-screen__ballot-seal" aria-hidden="true">
                  ?
                </span>
                <span className="vote-screen__ballot-seal-label">봉인</span>
              </div>
            ))}
          </div>
          {showWaiting && (
            <p className="vote-screen__ballots-info" data-testid="vote-waiting-execs">
              임원 판단을 기다리는 중… 최초 8초, 응답이 없으면 1회 다시 요청할 수 있습니다.
            </p>
          )}
          {showRetry && (
            <button
              type="button"
              className="vote-screen__ballots-retry cta cta--secondary"
              data-testid="retry-failed-roles"
              disabled={retryUsed}
              onClick={handleRetry}
            >
              {retryUsed ? '다시 요청함 · 미표결로 확정됩니다' : '미표결 임원 다시 요청'}
            </button>
          )}
        </div>
      </div>
      <div className="app-body__content screen vote-screen__info">
        <div className="vote-screen__paper">
          <span className="vote-screen__stamp" aria-hidden="true">
            CONFIDENTIAL
          </span>
          <div className="vote-screen__head">
            <span className="vote-screen__step">STEP 05 · 2/2</span>
            {/* 시안 원본은 <h1>이지만, 다른 조종석 화면과 같은 <h2> 위계를 쓴다(T72와
                같은 이유) — 글자 크기·굵기는 시안 값 그대로다. */}
            <h2 className="vote-screen__title">최종 투표 · 특별 이사 1표</h2>
          </div>
          <div className="vote-screen__motion-card" data-testid="vote-motion-card">
            <span className="vote-screen__motion-label">MOTION</span>
            {/* 시안은 원안 문장만 한 줄로 보여준다 — motion.text는 domain/motion.ts
                freezeMotion이 고정한 실제 안건 문구다(scenario.originalMotion.text와
                항상 같은 값이지만, "지금 표결 중인 바로 그 안건"을 가리키는 쪽은
                motion이다). */}
            <span className="vote-screen__motion-text">{motion.text}</span>
            {/* PR #12 Codex 5차 검토(P1): 시안의 MOTION 한 줄 상자는 반영 조건을
                문장에 녹여 쓰지만(문안 생성 규칙 변경 금지, motion.text는 항상 원안
                그대로다), 반영 조건 자체가 화면에 안 보이면 투표자가 원안만 보고
                판단하게 된다 — 조건에 따라 표가 갈릴 수 있으므로(domain/voting.ts)
                sr-only로는 부족하다. MOTION 상자 자체는 새 패널 없이 그대로 두고,
                문장 아래 줄에 MotionScreen의 CONDITIONS 칩과 같은 모양(초록 테두리
                pill)으로 실제로 보이게 둔다 — 조건이 없으면(원안 그대로) 아무것도
                더하지 않는다. 이 줄이 이미 눈에 보이는 실제 텍스트라 스크린리더도
                그대로 읽으므로, 옛 sr-only 문단은 완전히 대체돼 뺐다. */}
            {motion.effectiveConditionIds.length > 0 && (
              <div className="vote-screen__motion-conditions" data-testid="vote-motion-conditions">
                <span className="vote-screen__motion-conditions-label">반영 조건</span>
                <ul className="vote-screen__motion-conditions-list">
                  {motion.effectiveConditionIds.map((id) => (
                    <li key={id}>
                      {scenario.conditions.find((condition) => condition.id === id)?.label ?? id}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <fieldset className="vote-screen__choices" disabled={submitted}>
            <legend className="vote-screen__sr-only">이사님의 최종 표를 선택해 주세요</legend>
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
                {/* 원형 도장의 "찬성"/"반대"는 이 라디오의 실제 접근 가능한 이름이다(선택
                    상태는 input의 checked가 이미 따로 전달한다). 아래 영문 타자기
                    캡션(APPROVE/REJECT · 선택됨)은 시안의 장식용 2차 표기라
                    aria-hidden으로 중복 낭독을 막는다. */}
                <span className="vote-choice__circle">{VOTE_LABELS[vote]}</span>
                <span className="vote-choice__caption" aria-hidden="true">
                  {VOTE_STAMP_LABELS[vote]}
                  {pendingVote === vote ? ' · 선택됨' : ''}
                </span>
              </label>
            ))}
          </fieldset>
          <div className="vote-screen__cta-row">
            <button
              type="button"
              className="cta"
              disabled={pendingVote === null || submitted}
              onClick={handleConfirm}
              data-testid="confirm-vote"
            >
              최종 투표 확정 ▶
            </button>
            <p className="vote-screen__cta-note">
              확정 버튼으로만 표가 성립합니다. 확정 후 임원 표가 공개되고 결과로 넘어갑니다.
              <br />
              5석 중 찬성 3표 이상이면 가결, 그 외는 부결.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
