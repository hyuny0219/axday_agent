// 무대 열(StageBand, T44 좌우 분할): App.tsx의 왼쪽 고정 무대 열 안에서 렌더 배경의
// 무대를 16:9 원본 비율 그대로 보여주고, 세션 상태를 오버레이(명패·글로우·판단 중
// 점·말풍선·표결 배지·결론 도장)로만 그리는 순수 표시 컴포넌트다
// (docs/design/DESIGN_SPEC.md v1.0 1·5절). 장식이므로 컨테이너에 aria-hidden="true"를
// 둔다 — 읽어야 할 정보(발언 전문·표결 결과 등)는 이미 각 화면 본문에 그대로 있고
// 여기서는 중복해 새 정보를 만들지 않는다.
// 화면별 말풍선 문구는 scripted면 시나리오 데이터(initialOpinions·reactions)에서,
// live면 session.transcript.statements에서 가져온다. 말풍선 텍스트 자르기는
// stageText.ts(순수 함수)에 위임한다.
// T44에서 1280px 이하의 56px 좌석 띠·"무대 펼치기" 토글을 없앴다 — 왼쪽 무대 열은
// 폭만 줄어들 뿐(clamp(420px,42vw,860px)) 두 해상도 모두 항상 전체 무대로 보인다.

import type { ExecMemberId, Scenario } from '../../content/types';
import type { Ballot, MemberId, Opinion, RoleStatus, SessionMode, SessionStage, Statement } from '../../domain/types';
import { EXEC_MEMBER_ORDER } from '../../domain/voting';
import { MEMBER_LABELS } from '../memberLabels';
import { firstSentenceClipped } from '../stageText';
import type { ResultStamp } from '../resultStamp';
import { STAMP_DELAY_SECONDS } from '../resultStamp';
import { useResultStampSkip } from '../useResultStampSkip';
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
  /** RESULT 단계에서만 넘긴다. 있으면 무대 우하단에 결론 도장을 겹쳐 찍는다(v1.0 5절). */
  resultStamp?: ResultStamp | null;
}

/** 배경 이미지 기준 좌석 가로 위치(DESIGN_SPEC.md v1.0 1절). */
const SEAT_LEFT_PERCENT: Record<ExecMemberId, number> = {
  CEO: 14.5,
  CFO: 39.5,
  CAIO: 63,
  CISO: 87.5,
};

type BubbleKind = 'speech' | 'pending' | 'none';

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
      if (status === 'failed') {
        // 응답 실패는 본문 카드(LiveStatementCards "응답 지연·확인 필요")가 전담한다.
        // 무대(aria-hidden)에서 판단 중으로 보이게 두면 상태가 어긋난다(PR #6 Codex 검토).
        return { bubbleKind: 'none', bubbleText: '', dimmed: true };
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

  // VOTE: 말풍선 없음. 임원 판단 대기 상태는 본문(vote-waiting-execs)이 접근 가능하게
  // 알리고, 무대는 장식으로만 남긴다(PR #6 Codex 검토: aria-hidden 층에만 있는 상태 금지).
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

export function StageBand({
  stage,
  mode,
  roleStatus,
  statements,
  opinions,
  scenario,
  ballots,
  chairLine,
  resultStamp,
}: StageBandProps) {
  const participant = participantSeatOverlay(stage, opinions);
  const stampSkip = useResultStampSkip(stage === 'RESULT' && Boolean(resultStamp));

  return (
    <div className="stage-band" aria-hidden="true" data-testid="stage-band">
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
                  ) : (
                    overlay.bubbleText
                  )}
                </span>
              )}
              <div className="stage-band__seat-foot">
                <span className={`stage-band__nameplate stage-band__nameplate--${memberId.toLowerCase()}`}>
                  {MEMBER_LABELS[memberId]}
                </span>
                {stage === 'RESULT' && ballots && <VoteBadge memberId={memberId} ballots={ballots} />}
                <span
                  className={`stage-band__silhouette stage-band__silhouette--${memberId.toLowerCase()}${
                    overlay.dimmed ? ' stage-band__silhouette--dimmed' : ''
                  }${overlay.bubbleKind === 'speech' ? ' stage-band__silhouette--glow' : ''}`}
                />
              </div>
            </div>
          );
        })}
        <div
          className="stage-band__seat stage-band__seat--participant"
          data-testid="stage-seat-PARTICIPANT"
        >
          {participant.bubbleText && (
            <span
              className="stage-band__bubble stage-band__bubble--speech stage-band__bubble--participant"
              data-testid="stage-bubble-PARTICIPANT"
            >
              {participant.bubbleText}
            </span>
          )}
          <div className="stage-band__seat-foot">
            <span className="stage-band__nameplate stage-band__nameplate--participant">나 · 특별 이사</span>
            {stage === 'RESULT' && ballots && <VoteBadge memberId="PARTICIPANT" ballots={ballots} />}
            <span
              className={`stage-band__silhouette stage-band__silhouette--participant${
                participant.glow ? ' stage-band__silhouette--glow' : ''
              }`}
            />
          </div>
        </div>
        {resultStamp && (
          <div
            className={`stage-band__stamp result-stamp result-stamp--${(resultStamp.outcome ?? 'hold').toLowerCase()}`}
            data-testid="result-stamp"
            style={{
              animationDelay: stampSkip ? '0.01ms' : `${STAMP_DELAY_SECONDS}s`,
              animationDuration: stampSkip ? '0.01ms' : undefined,
            }}
          >
            {resultStamp.text}
          </div>
        )}
      </div>
    </div>
  );
}
