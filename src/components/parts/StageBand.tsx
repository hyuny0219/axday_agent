// 무대 띠(StageBand, T43): SELECT 이후 모든 화면(BRIEFING~RESULT) 상단에 렌더 배경의
// 무대를 두고, 세션 상태를 오버레이(명패·글로우·판단 중 점·말풍선·표결 배지)로만
// 그리는 순수 표시 컴포넌트다(docs/design/DESIGN_SPEC.md v1.0 1·3절). 장식이므로
// 컨테이너에 aria-hidden="true"를 둔다 — 읽어야 할 정보(발언 전문·표결 결과 등)는
// 이미 각 화면 본문에 그대로 있고 여기서는 중복해 새 정보를 만들지 않는다.
// 화면별 말풍선 문구는 scripted면 시나리오 데이터(initialOpinions·reactions)에서,
// live면 session.transcript.statements에서 가져온다. 말풍선 텍스트 자르기는
// stageText.ts(순수 함수)에 위임한다.
// 1280px 이하에서는 56px 좌석 띠로 접히고 "무대 펼치기" 버튼으로 잠시 펼쳐 볼 수
// 있다(순수 로컬 useState, dispatch 없음 — 펼침 자체는 세션 액션이 아니다. 버튼
// 클릭은 App.tsx의 기존 window click 활동 감지에는 자연히 걸리지만, 이 컴포넌트가
// 별도로 활동을 기록하거나 stopPropagation으로 그 감지를 막지는 않는다).

import { useState } from 'react';
import type { ExecMemberId, Scenario } from '../../content/types';
import type { Ballot, MemberId, Opinion, RoleStatus, SessionMode, SessionStage, Statement } from '../../domain/types';
import { EXEC_MEMBER_ORDER } from '../../domain/voting';
import { MEMBER_LABELS } from '../memberLabels';
import { firstSentenceClipped } from '../stageText';
import stageRender from '../../assets/stage-render-01.jpg';
import '../../styles/screens/stage.css';

export interface StageBandProps {
  stage: SessionStage;
  mode: SessionMode;
  roleStatus: Record<ExecMemberId, RoleStatus>;
  statements: Statement[];
  opinions: Opinion[];
  scenario: Scenario;
  /** RESULT 단계에서만 넘긴다. 있으면 표결 배지를 순차 공개한다. */
  ballots?: Ballot[];
  /** BRIEFING·MOTION 단계에서 의장(CEO) 말풍선에 쓸 원문. 다른 단계에서는 무시한다. */
  chairLine?: string;
}

/** 배경 이미지 기준 좌석 가로 위치(DESIGN_SPEC.md v1.0 1절). */
const SEAT_LEFT_PERCENT: Record<ExecMemberId, number> = {
  CEO: 14.5,
  CFO: 39.5,
  CAIO: 63,
  CISO: 87.5,
};

type BubbleKind = 'speech' | 'pending' | 'waiting' | 'none';

interface SeatOverlay {
  bubbleKind: BubbleKind;
  bubbleText: string;
  dimmed: boolean;
}

const NONE_OVERLAY: SeatOverlay = { bubbleKind: 'none', bubbleText: '', dimmed: false };

/** DISCUSS/REACTIONS에서 이전에 확정된 조건에 반응한 임원 발언을 찾는다
 * (ReactionsScreen.reactionsFor와 같은 규칙). 반응이 없으면 "기존 의견 유지"다. */
function scriptedReactionFor(
  scenario: Scenario,
  memberId: ExecMemberId,
  previousConfirmedIds: string[],
): string | null {
  const matches =
    previousConfirmedIds.length === 0
      ? scenario.reactions.filter((r) => r.memberId === memberId && r.conditionId === 'none')
      : scenario.reactions.filter(
          (r) => r.memberId === memberId && previousConfirmedIds.includes(r.conditionId),
        );
  return matches.length > 0 ? (matches[0]?.text ?? null) : null;
}

/** 임원 한 명의 이번 단계 말풍선 상태를 계산한다(DESIGN_SPEC.md v1.0 1절 "화면별 상태"). */
function execSeatOverlay(
  memberId: ExecMemberId,
  stage: SessionStage,
  mode: SessionMode,
  roleStatus: Record<ExecMemberId, RoleStatus>,
  statements: Statement[],
  opinions: Opinion[],
  scenario: Scenario,
  chairLine: string | undefined,
): SeatOverlay {
  if (stage === 'BRIEFING' || stage === 'MOTION') {
    if (memberId === 'CEO' && chairLine) {
      return { bubbleKind: 'speech', bubbleText: firstSentenceClipped(chairLine), dimmed: false };
    }
    return NONE_OVERLAY;
  }

  if (stage === 'OPINIONS' || stage === 'REACTIONS') {
    const statementStage = stage === 'OPINIONS' ? 'OPINIONS' : 'REACTIONS';
    if (mode === 'live') {
      const status = roleStatus[memberId];
      const statement = statements.find(
        (item) => item.roleId === memberId && item.stage === statementStage,
      );
      if (status === 'answered' && statement) {
        return { bubbleKind: 'speech', bubbleText: firstSentenceClipped(statement.text), dimmed: false };
      }
      return { bubbleKind: 'pending', bubbleText: '', dimmed: false };
    }

    if (stage === 'OPINIONS') {
      const opinion = scenario.initialOpinions.find((item) => item.memberId === memberId);
      return { bubbleKind: 'speech', bubbleText: firstSentenceClipped(opinion?.text ?? ''), dimmed: false };
    }

    const lastOpinion = opinions[opinions.length - 1] ?? null;
    const previousConfirmedIds = lastOpinion?.confirmedConditionIds ?? [];
    const reactionText = scriptedReactionFor(scenario, memberId, previousConfirmedIds);
    if (reactionText) {
      return { bubbleKind: 'speech', bubbleText: firstSentenceClipped(reactionText), dimmed: false };
    }
    return { bubbleKind: 'none', bubbleText: '', dimmed: true };
  }

  if (stage === 'VOTE') {
    return { bubbleKind: mode === 'live' ? 'pending' : 'waiting', bubbleText: '', dimmed: false };
  }

  return NONE_OVERLAY;
}

interface ParticipantOverlay {
  bubbleText: string;
  glow: boolean;
}

function participantSeatOverlay(stage: SessionStage, opinions: Opinion[]): ParticipantOverlay {
  if (stage === 'DISCUSS') {
    return { bubbleText: '', glow: true };
  }
  if (stage === 'REACTIONS') {
    const lastOpinion = opinions[opinions.length - 1] ?? null;
    return { bubbleText: lastOpinion ? firstSentenceClipped(lastOpinion.originalText) : '', glow: false };
  }
  return { bubbleText: '', glow: false };
}

const VOTE_BADGE_ICON: Record<Ballot['vote'], string> = {
  YES: '✓',
  HOLD: '॥',
  NO: '✕',
  UNCAST: '–',
};

const RESULT_SEAT_ORDER: readonly MemberId[] = [...EXEC_MEMBER_ORDER, 'PARTICIPANT'];

/** RESULT 단계에서만 쓰는 표결 배지. memberId의 등장 순서(CEO→CFO→CAIO→CISO→나)
 * 인덱스만큼 0.2초씩 늦춰 CSS animation-delay로 순차 공개한다(4장 규칙 — setTimeout
 * 대신 CSS로 구현해 Clock 규칙과 충돌하지 않는다). */
function VoteBadge({ memberId, ballots }: { memberId: MemberId; ballots: Ballot[] }) {
  const index = RESULT_SEAT_ORDER.indexOf(memberId);
  const vote = ballots.find((b) => b.memberId === memberId)?.vote ?? 'UNCAST';
  return (
    <span
      className={`stage-band__vote-badge stage-band__vote-badge--${vote.toLowerCase()}`}
      style={{ animationDelay: `${Math.max(index, 0) * 0.2}s` }}
      data-testid={`stage-vote-badge-${memberId}`}
    >
      {VOTE_BADGE_ICON[vote]}
    </span>
  );
}

const STATUS_STRIP_TEXT: Record<BubbleKind, string> = {
  speech: '발언',
  pending: '판단 중',
  waiting: '대기',
  none: '',
};

export function StageBand({
  stage,
  mode,
  roleStatus,
  statements,
  opinions,
  scenario,
  ballots,
  chairLine,
}: StageBandProps) {
  const [expanded, setExpanded] = useState(false);
  const participant = participantSeatOverlay(stage, opinions);

  return (
    <div
      className="stage-band"
      aria-hidden="true"
      data-testid="stage-band"
      data-expanded={expanded}
    >
      <div className="stage-band__stage" data-testid="stage-band-full">
        <img src={stageRender} alt="" className="stage-band__bg" />
        <div className="stage-band__vignette stage-band__vignette--top" />
        <div className="stage-band__vignette stage-band__vignette--bottom" />
        {EXEC_MEMBER_ORDER.map((memberId) => {
          const overlay = execSeatOverlay(
            memberId,
            stage,
            mode,
            roleStatus,
            statements,
            opinions,
            scenario,
            chairLine,
          );
          return (
            <div
              key={memberId}
              className="stage-band__seat"
              style={{ left: `${SEAT_LEFT_PERCENT[memberId]}%` }}
              data-testid={`stage-seat-${memberId}`}
            >
              <span className={`stage-band__nameplate stage-band__nameplate--${memberId.toLowerCase()}`}>
                {MEMBER_LABELS[memberId]}
              </span>
              {overlay.bubbleKind !== 'none' && (
                <span
                  className={`stage-band__bubble stage-band__bubble--${overlay.bubbleKind}`}
                  data-testid={`stage-bubble-${memberId}`}
                >
                  {overlay.bubbleKind === 'pending' ? (
                    <span className="stage-band__dots">
                      <span />
                      <span />
                      <span />
                    </span>
                  ) : overlay.bubbleKind === 'waiting' ? (
                    '대기'
                  ) : (
                    overlay.bubbleText
                  )}
                </span>
              )}
              {stage === 'RESULT' && ballots && <VoteBadge memberId={memberId} ballots={ballots} />}
              <span
                className={`stage-band__silhouette stage-band__silhouette--${memberId.toLowerCase()}${
                  overlay.dimmed ? ' stage-band__silhouette--dimmed' : ''
                }${overlay.bubbleKind === 'speech' ? ' stage-band__silhouette--glow' : ''}`}
              />
            </div>
          );
        })}
        <div className="stage-band__seat stage-band__seat--participant" data-testid="stage-seat-PARTICIPANT">
          <span className="stage-band__nameplate stage-band__nameplate--participant">나 · 특별 이사</span>
          {participant.bubbleText && (
            <span className="stage-band__bubble stage-band__bubble--speech" data-testid="stage-bubble-PARTICIPANT">
              {participant.bubbleText}
            </span>
          )}
          {stage === 'RESULT' && ballots && <VoteBadge memberId="PARTICIPANT" ballots={ballots} />}
          <span
            className={`stage-band__silhouette stage-band__silhouette--participant${
              participant.glow ? ' stage-band__silhouette--glow' : ''
            }`}
          />
        </div>
      </div>

      <div className="stage-band__strip" data-testid="stage-band-strip">
        {EXEC_MEMBER_ORDER.map((memberId) => {
          const overlay = execSeatOverlay(
            memberId,
            stage,
            mode,
            roleStatus,
            statements,
            opinions,
            scenario,
            chairLine,
          );
          return (
            <span key={memberId} className="stage-band__strip-seat">
              <span className={`stage-band__strip-avatar stage-band__strip-avatar--${memberId.toLowerCase()}`}>
                {memberId}
              </span>
              <span className="stage-band__strip-status">{STATUS_STRIP_TEXT[overlay.bubbleKind]}</span>
            </span>
          );
        })}
        <span className="stage-band__strip-seat">
          <span className="stage-band__strip-avatar stage-band__strip-avatar--participant">나</span>
          <span className="stage-band__strip-status">{participant.bubbleText ? '발언' : ''}</span>
        </span>
        <button
          type="button"
          className="stage-band__expand"
          data-testid="stage-expand"
          aria-pressed={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? '무대 접기' : '무대 펼치기'}
        </button>
      </div>
    </div>
  );
}
