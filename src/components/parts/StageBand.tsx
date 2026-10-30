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
// 우상단에").
// T131: 작은 표정 점·"방향 · 찬성 쪽" 캡션을 큰 찬반 명패(찬성 초록·반대 빨강·고민 중 회색,
// 기울음은 점선 "찬성 쪽?", 봉인 단계는 "?")로 바꾸고 위쪽 집계 한 줄을
// 더했다(얼굴 둘레 빛 고리는 없다 — 발언 중 좌석 바닥 glow만 남았다). 봉인 단계(MOTION·VOTE)는
// 명패 "?"·집계 숨김이다.

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
import { execRevealDelay } from '../resultStamp';
import { firstSentenceClipped } from '../stageText';
import { bubbleLineOf } from '../bubbleText';
import { reactionBubble } from '../reactionsFor';
import { useThinkingHidden } from './thinkingContext';
import { stanceVerdict, tallyParts } from '../stanceDisplay';
import { useChangeFlip } from '../useChangeFlip';
import type { LeaningMap } from '../../domain/stance';
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
  /** T118: 첫 의견 뒤 REACTIONS에서 참가자 쪽으로 기울었지만 답변 전이라 확정되지 않은 임원.
   * 표정은 목표 방향의 "기울음" 변형(점선 테두리)과 라벨 "찬성 쪽"으로 보인다. */
  leaning?: LeaningMap;
  /** RESULT 단계에서만 넘긴다. 있으면 표결 배지를 순차 공개한다. */
  ballots?: Ballot[];
  /** T126: 지난 화면 보기 중이면 명패가 뒤집히지 않는다. */
  readOnly?: boolean;
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

/** T114·T118·T120: 추가 질문에 답한 뒤 표결 전에는 방향을 가린다 — 명패는 "?", 빛·집계 없음. */
const SEALED_STAGES: ReadonlySet<SessionStage> = new Set(['MOTION', 'VOTE']);

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
  /** 조건은 맞았지만 추가 질문의 답을 기다리는 임원이면 true(T110) — pendingBubble을 쓴다. */
  pending = false,
): string | null {
  const matches =
    previousConfirmedIds.length === 0
      ? scenario.reactions.filter((r) => r.memberId === memberId && r.conditionId === 'none')
      : scenario.reactions.filter(
          (r) => r.memberId === memberId && previousConfirmedIds.includes(r.conditionId),
        );
  const first = matches[0];
  if (!first) {
    return null;
  }
  return reactionBubble(matches, pending) ?? bubbleLineOf(first.text);
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
  stance: Stance,
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
        return { bubbleKind: 'speech', bubbleText: bubbleLineOf(statement.text), dimmed: false };
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
      const line = opinion ? (opinion.bubble ?? bubbleLineOf(opinion.text)) : '';
      return { bubbleKind: 'speech', bubbleText: line, dimmed: false };
    }

    const lastOpinion = opinions[opinions.length - 1] ?? null;
    const previousConfirmedIds = lastOpinion?.confirmedConditionIds ?? [];
    // scripted REACTIONS에서 UNDECIDED는 곧 "조건은 맞았고 답을 기다리는 중"이다(T110, stance.ts).
    const reactionText = scriptedReactionFor(scenario, memberId, previousConfirmedIds, stance === 'UNDECIDED');
    if (reactionText) {
      return { bubbleKind: 'speech', bubbleText: reactionText, dimmed: false };
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
    return { bubbleText: lastOpinion ? bubbleLineOf(lastOpinion.originalText) : '', glow: false };
  }
  return { bubbleText: '', glow: false };
}

const VOTE_BADGE_ICON: Record<Ballot['vote'], string> = {
  YES: '✓',
  NO: '✕',
  UNCAST: '–',
};

/** 임원 한 명의 찬반 명패(T131, 지난 T63 표정 점을 대신한다). 확정은 찬성 초록·반대 빨강·
 * 고민 중 회색 바탕에 큰 글자, 기울음(T118)은 점선 테두리 + "찬성 쪽?", 봉인 단계는 "?"다.
 * 입장 글자가 바뀐 순간에만 한 번 뒤집히고(useChangeFlip), 계속 반복하는 움직임은 없다. */
function StageNameplate({
  memberId,
  stance,
  leaning,
  sealed,
  readOnly,
}: {
  memberId: ExecMemberId;
  stance: Stance;
  leaning?: 'FOR' | 'AGAINST';
  sealed: boolean;
  readOnly: boolean;
}) {
  const verdict = stanceVerdict(stance, leaning);
  const text = sealed ? '?' : verdict.text;
  const tone = sealed ? 'undecided' : verdict.tone;
  const flips = useChangeFlip(text, readOnly || sealed);
  return (
    <span
      key={flips}
      className={`stage-band__mood stage-band__mood--${tone}${verdict.leaning && !sealed ? ' stage-band__mood--leaning' : ''}${
        sealed ? ' stage-band__mood--sealed' : ''
      }${flips > 0 ? ' stage-band__mood--flip' : ''}`}
      data-testid={`stage-mood-${memberId}`}
    >
      {text}
    </span>
  );
}

/** RESULT 단계에서만 쓰는 표결 배지. 임원 4명은 봉인('?')으로 시작해 resultStamp.ts의
 * execRevealDelay 시각에 한 장씩 뒤집힌다(T114, 순서 CEO→CFO→CAIO→CISO). 참가자 표는
 * 이미 아는 값이라 가리지 않는다. setTimeout 대신 CSS animation-delay로 구현해 Clock
 * 규칙과 충돌하지 않는다. 봉인 표시는 aria-hidden이고 표 배지의 testid는 그대로다. */
function VoteBadge({ memberId, ballots }: { memberId: MemberId; ballots: Ballot[] }) {
  const execIndex = EXEC_MEMBER_ORDER.indexOf(memberId as ExecMemberId);
  const isExec = execIndex >= 0;
  const delay = isExec ? execRevealDelay(execIndex) : 0;
  const vote = ballots.find((b) => b.memberId === memberId)?.vote ?? 'UNCAST';
  return (
    <span className="stage-band__vote-slot">
      {isExec && (
        <span
          className="stage-band__vote-seal reveal-anim"
          style={{ animationDelay: `${delay}s` }}
          data-testid={`stage-vote-seal-${memberId}`}
          aria-hidden="true"
        >
          ?
        </span>
      )}
      <span
        className={`stage-band__vote-badge reveal-anim stage-band__vote-badge--${vote.toLowerCase()}`}
        style={{ animationDelay: `${delay}s` }}
        data-testid={`stage-vote-badge-${memberId}`}
      >
        {VOTE_BADGE_ICON[vote]}
      </span>
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
  leaning,
  ballots,
  readOnly = false,
  chairLine,
}: StageBandProps) {
  const participant = participantSeatOverlay(stage, opinions);
  // T148: scripted에서 아직 "…" 중인 임원은 말풍선 대신 생각 중 점을 보인다.
  const thinkingHidden = useThinkingHidden(stage);
  const sealed = SEALED_STAGES.has(stage);
  // 집계는 임원이 의견을 낸 뒤(OPINIONS~REACTIONS)에만 보인다 — BRIEFING은 아직 아무도 말하지
  // 않았고, 봉인 단계는 방향을 가리며, RESULT는 표 배지가 대신한다.
  const showTally = stage === 'OPINIONS' || stage === 'DISCUSS' || stage === 'REACTIONS';
  // live는 발언이 하나라도 있는 임원만 센다 — 아직 의견이 없거나 응답이 실패한 임원의 자리표시 UNDECIDED를
  // "고민 중"으로 세지 않는다(PR #21 Codex P2). scripted는 규칙표로 네 명 모두 입장이 정해져 있다.
  const counted =
    mode === 'live' ? new Set(EXEC_MEMBER_ORDER.filter((id) => statements.some((item) => item.roleId === id))) : undefined;
  const parts = showTally ? tallyParts(stances, leaning, counted) : [];

  return (
    <div className="stage-band" aria-hidden="true" data-testid="stage-band">
      <div className={`stage-band__stage${showTally ? ' stage-band__stage--tally' : ''}`} data-testid="stage-band-full">
        <img src={stageRender} alt="" className="stage-band__bg" />
        <div className="stage-band__scanlines" />
        <div className="stage-band__vignette stage-band__vignette--top" />
        <div className="stage-band__vignette stage-band__vignette--bottom" />
        <div className="stage-band__bracket stage-band__bracket--tl" />
        <div className="stage-band__bracket stage-band__bracket--tr" />
        <div className="stage-band__bracket stage-band__bracket--bl" />
        <div className="stage-band__bracket stage-band__bracket--br" />
        <div className="stage-band__readout">
          <span>회의실 A</span>
          <span>녹화중</span>
        </div>
        {/* T87(사용자 — "붉은 상자 안의 글씨는 영어로"): T83에서 한국어로 바꿨던 이
            라벨만 영문으로 되돌렸다. */}
        <div className="stage-band__classified">CLASSIFIED</div>
        {showTally && parts.length > 0 && (
          <div className="stage-band__tally" data-testid="stage-tally">
            {parts.map((part) => (
              <span key={part.key} className={`stage-band__tally-part stage-band__tally-part--${part.key}`}>
                {part.label} <b>{part.count}</b>
              </span>
            ))}
          </div>
        )}
        {EXEC_MEMBER_ORDER.map((memberId) => {
          const baseOverlay = execSeatOverlay(
            memberId,
            stage,
            mode,
            roleStatus,
            statements,
            opinions,
            scenario,
            chairLine,
            stances[memberId],
          );
          const overlay: SeatOverlay =
            mode === 'scripted' && thinkingHidden.includes(memberId)
              ? { bubbleKind: 'pending', bubbleText: '', dimmed: false }
              : baseOverlay;
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
                {stage !== 'RESULT' && (
                  <StageNameplate
                    memberId={memberId}
                    stance={stances[memberId]}
                    leaning={leaning?.[memberId]}
                    sealed={sealed}
                    readOnly={readOnly}
                  />
                )}
                {/* 무대 명패는 약칭만 쓴다(T52) — 전체 직함(MEMBER_LABELS)은 좌석 폭(22%)을
                    넘어 이웃 명패를 덮었다. 전체 직함은 임원 의견 카드 등 본문에서 계속
                    보여준다. memberId 자체가 이미 약칭(CEO/CFO/CAIO/CISO)이다. */}
                <span className={`stage-band__nameplate stage-band__nameplate--${memberId.toLowerCase()}`}>
                  {memberId}
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
              <span className="stage-band__bubble-text">{participant.bubbleText}</span>
            </span>
          )}
          <div className="stage-band__seat-foot">
            {/* 참가자 좌석에는 명패를 두지 않는다(2026-09-28 사용자, T67에서 헤더 명패
                자체를 없앤 뒤에도 유지되는 결정이다 — 임원 4석 사이에 참가자 표기가
                끼면 임원이 다섯으로 읽힌다). 이 좌석은 글로우(DISCUSS)·말풍선
                (REACTIONS)·표 배지(RESULT)만 맡는다. RESULT만 예외: 표결이 끝나
                다섯으로 읽힐 위험이 없고, ✓/✕ 배지만으로는 그게 누구 표인지 알 수
                없어 "나" 명패를 더한다(T85 #24). */}
            {stage === 'RESULT' && ballots && (
              <>
                <span className="stage-band__nameplate stage-band__nameplate--participant">나</span>
                <VoteBadge memberId="PARTICIPANT" ballots={ballots} />
              </>
            )}
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
