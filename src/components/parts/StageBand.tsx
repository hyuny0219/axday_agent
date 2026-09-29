// 무대 열(StageBand, T44 좌우 분할): App.tsx의 왼쪽 고정 무대 열 안에서 렌더 배경의
// 무대를 16:9 원본 비율 그대로 보여주고, 세션 상태를 오버레이(명패·글로우·판단 중
// 점·말풍선·표결 배지)로만 그리는 순수 표시 컴포넌트다(docs/design/DESIGN_SPEC.md
// v1.0 1·5절). 장식이므로 컨테이너에 aria-hidden="true"를 둔다 — 읽어야 할 정보(발언
// 전문·표결 결과 등)는 이미 각 화면 본문에 그대로 있고 여기서는 중복해 새 정보를 만들지
// 않는다.
// 화면별 말풍선 문구는 scripted면 시나리오 데이터(initialOpinions·reactions)에서,
// live면 session.transcript.statements에서 가져온다. 말풍선 텍스트 자르기는
// stageText.ts(순수 함수)에 위임한다.
// T44에서 1280px 이하의 56px 좌석 띠·"무대 펼치기" 토글을 없앴다 — 왼쪽 무대 열은
// 폭만 줄어들 뿐(clamp(420px,42vw,860px)) 두 해상도 모두 항상 전체 무대로 보인다.
// T64("기밀 작전실" 게임형 스킨): 프레임에 브래킷·스캔라인·CAM 판독 라벨·CLASSIFIED
// 칩(모두 장식)을 더하고, 결론 도장은 오른쪽 종이 보고서로 옮겨 이 컴포넌트는 더는
// 그리지 않는다(docs/design/mockups/README.md "도장은 결과 화면 오른쪽 종이 보고서
// 우상단에"). 명패 아래 역할·기울기 캡션(예: "방향 · 찬성 쪽")도 이 카드에서 더했다.

import type { ExecMemberId, Scenario } from '../../content/types';
import type {
  Ballot,
  MemberId,
  Opinion,
  RoleStatus,
  SessionMode,
  SessionStage,
  Stance,
  Statement,
} from '../../domain/types';
import { EXEC_MEMBER_ORDER } from '../../domain/voting';
import { firstSentenceClipped } from '../stageText';
import { STANCE_LABEL } from '../moodLabel';
import stageRender from '../../assets/stage-render-01.jpg';
import '../../styles/screens/stage.css';

export interface StageBandProps {
  stage: SessionStage;
  mode: SessionMode;
  roleStatus: Record<ExecMemberId, RoleStatus>;
  statements: Statement[];
  opinions: Opinion[];
  scenario: Scenario;
  /** 임원 4명이 지금 안건에 기울어 있는 쪽(T63, domain/stance.ts). RESULT에서는 쓰지 않는다
   * (표 배지가 대신한다). */
  stances: Record<ExecMemberId, Stance>;
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

/** 역할·기울기 캡션의 관심사 한 단어(T64, Main.html "방향 · 찬성 쪽"/"비용 · 미정" 등).
 * STANCE_LABEL(찬성 쪽/반대 쪽/미정)과 합쳐 명패 아래에 보여준다. */
const ROLE_INTEREST_WORD: Record<ExecMemberId, string> = {
  CEO: '방향',
  CFO: '비용',
  CAIO: '시스템',
  CISO: '보안',
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
  NO: '✕',
  UNCAST: '–',
};

/** 임원 표정 배지(T63) 안의 얼굴선. 이모지를 쓰지 않고(부스 PC OS마다 다르게 그려진다)
 * CSS/inline SVG로만 그린다. 색뿐 아니라 눈·입 모양으로도 세 값을 구분한다(색만으로
 * 구분 금지). 선 색은 배지 배경(stage.css의 stage-band__mood--*)과 대비되도록
 * currentColor를 쓰고, 배지 쪽에서 color를 지정한다. */
function MoodIcon({ stance }: { stance: Stance }) {
  if (stance === 'FOR') {
    return (
      <svg viewBox="0 0 18 18" width="10" height="10" aria-hidden="true" focusable="false">
        <circle cx="4.5" cy="6.5" r="1.1" fill="currentColor" />
        <circle cx="13.5" cy="6.5" r="1.1" fill="currentColor" />
        <path d="M4 10.5 Q9 14 14 10.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (stance === 'AGAINST') {
    return (
      <svg viewBox="0 0 18 18" width="10" height="10" aria-hidden="true" focusable="false">
        <circle cx="4.5" cy="6.5" r="1.1" fill="currentColor" />
        <circle cx="13.5" cy="6.5" r="1.1" fill="currentColor" />
        <path d="M4 12.5 Q9 9 14 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 18 18" width="10" height="10" aria-hidden="true" focusable="false">
      <circle cx="4" cy="9" r="1.3" fill="currentColor" />
      <circle cx="9" cy="9" r="1.3" fill="currentColor" />
      <circle cx="14" cy="9" r="1.3" fill="currentColor" />
    </svg>
  );
}

/** 임원 한 명의 표정 배지(RESULT 제외). key를 stance 값으로 둬 값이 바뀔 때마다 React가
 * 이 span을 새로 마운트하게 해, mount 애니메이션(stage.css stage-band__mood 200ms
 * 스케일)이 그때마다 한 번씩 다시 재생된다(prefers-reduced-motion에서는 base.css 전역
 * 규칙이 지속 시간을 0으로 낮춘다). */
function MoodBadge({ memberId, stance }: { memberId: ExecMemberId; stance: Stance }) {
  return (
    <span
      key={stance}
      className={`stage-band__mood stage-band__mood--${stance.toLowerCase()}`}
      data-testid={`stage-mood-${memberId}`}
    >
      <MoodIcon stance={stance} />
    </span>
  );
}

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
  stances,
  ballots,
  chairLine,
}: StageBandProps) {
  const participant = participantSeatOverlay(stage, opinions);

  return (
    <div className="stage-band" aria-hidden="true" data-testid="stage-band">
      <div className="stage-band__stage" data-testid="stage-band-full">
        <img src={stageRender} alt="" className="stage-band__bg" />
        <div className="stage-band__scanlines" />
        <div className="stage-band__vignette stage-band__vignette--top" />
        <div className="stage-band__vignette stage-band__vignette--bottom" />
        <div className="stage-band__bracket stage-band__bracket--tl" />
        <div className="stage-band__bracket stage-band__bracket--tr" />
        <div className="stage-band__bracket stage-band__bracket--bl" />
        <div className="stage-band__bracket stage-band__bracket--br" />
        <div className="stage-band__readout">
          <span>CAM 01 · 회의실 A</span>
          <span>REC ●</span>
        </div>
        <div className="stage-band__classified">CLASSIFIED</div>
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
                    <>
                      {/* 발화자 라벨(T64, Main.html "의장 · CEO"). CEO는 항상 의장이라
                          접두어를 붙이고, 다른 임원은 직함 코드만 보여준다. */}
                      <span className="stage-band__bubble-label">
                        {memberId === 'CEO' ? '의장 · CEO' : memberId}
                      </span>
                      <span className="stage-band__bubble-text">{overlay.bubbleText}</span>
                    </>
                  )}
                </span>
              )}
              <div className="stage-band__seat-foot">
                {/* 무대 명패는 약칭만 쓴다(T52) — 전체 직함(MEMBER_LABELS)은 좌석 폭(22%)을
                    넘어 이웃 명패를 덮었다. 전체 직함은 임원 의견 카드 등 본문에서 계속
                    보여준다. memberId 자체가 이미 약칭(CEO/CFO/CAIO/CISO)이다. */}
                <span className={`stage-band__nameplate stage-band__nameplate--${memberId.toLowerCase()}`}>
                  {memberId}
                </span>
                {stage === 'RESULT' && ballots ? (
                  <VoteBadge memberId={memberId} ballots={ballots} />
                ) : (
                  <MoodBadge memberId={memberId} stance={stances[memberId]} />
                )}
                {/* 역할·기울기 캡션(T64, Main.html "방향 · 찬성 쪽"). RESULT는 표 배지가
                    이미 결과를 보여주므로 캡션을 겹쳐 보여주지 않는다. */}
                {stage !== 'RESULT' && (
                  <span className="stage-band__caption">
                    {ROLE_INTEREST_WORD[memberId]} · {STANCE_LABEL[stances[memberId]]}
                  </span>
                )}
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
              <span className="stage-band__bubble-text">{participant.bubbleText}</span>
            </span>
          )}
          <div className="stage-band__seat-foot">
            {/* 참가자 좌석에는 명패를 두지 않는다(2026-09-28 사용자). 헤더 pill
                (Nameplate.tsx)이 "나 · 특별 이사"를 항상 보여주고, 임원 4석 사이에
                참가자 표기가 끼면 임원이 다섯으로 읽힌다. 이 좌석은 글로우(DISCUSS)·
                말풍선(REACTIONS)·표 배지(RESULT)만 맡는다. */}
            {stage === 'RESULT' && ballots && <VoteBadge memberId="PARTICIPANT" ballots={ballots} />}
            <span
              className={`stage-band__silhouette stage-band__silhouette--participant${
                participant.glow ? ' stage-band__silhouette--glow' : ''
              }`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
