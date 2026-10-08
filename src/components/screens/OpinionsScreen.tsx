// 임원 의견 화면(T72, docs/design/mockups/S2_Opinions.html 시안대로). 오른쪽 종이
// 서류철 한 장에 "STEP 02" 칩 + "임원 네 명의 첫 의견" 제목 + CONFIDENTIAL 도장 +
// 안내 한 줄 + 타자기 집계("찬성 n · 반대 n · 미정 n", 실제 stance로 계산)를 두고,
// 그 아래 임원 발언 카드 2×2(머리줄 = 타자기 역할 코드 + 직함 굵게 + 찬성/반대/미정 +
// "발언" 칩, 본문, "근거 · <자료명>" pill)를 그린다. scripted(.opinion-card)·live
// (LiveStatementCards의 variant='grid')가 같은 시안 카드 모양을 쓴다(T65 이전
// "근거 보기" 토글은 시안에 없어 없앴다 — 전문은 항상 보인다, T52 자료 ID 비표기
// 규칙은 유지). 라운드는 App.tsx가 이 단계에 들어올 때 자동으로 시작하므로 이 화면은
// 상태만 그린다.

import { useEffect, useState } from 'react';
import type { ExecMemberId, Scenario } from '../../content/types';
import type { RoleStatus, Stance, Statement } from '../../domain/types';
import { EXEC_MEMBER_ORDER } from '../../domain/voting';
import { MEMBER_LABELS } from '../memberLabels';
import { STANCE_LABEL } from '../moodLabel';
import { useMatchMedia } from '../useMatchMedia';
import { GuideHint } from '../parts/GuideHint';
import { LiveStatementCards } from '../parts/LiveStatementCards';
import '../../styles/screens/opinions.css';

export interface OpinionsScreenProps {
  scenario: Scenario;
  mode: 'live' | 'scripted';
  roleStatus: Record<ExecMemberId, RoleStatus>;
  statements: Statement[];
  /** 무대 표정 배지의 접근 가능한 대응 텍스트(T63)이자, 카드 역할색 띠·타자기 집계의
   * 근거가 되는 실제 stance다. */
  stances: Record<ExecMemberId, Stance>;
  onNext: () => void;
  /** 실패한 역할만 골라 OPINIONS 라운드를 다시 부른다(T65 "다시 요청"). live에서만 쓴다. */
  onRetryFailedRoles?: (roleIds: ExecMemberId[]) => void;
}

/** 카드 역할색 띠·상태 칩 색에 쓰는 소문자 modifier(opinions.css·live.css가 읽는다). */
const STANCE_MODIFIER: Record<Stance, 'for' | 'against' | 'undecided'> = {
  FOR: 'for',
  AGAINST: 'against',
  UNDECIDED: 'undecided',
};

/** 오른쪽 종이 머리의 타자기 집계("찬성 1 · 반대 3 · 미정 0", 시안 그대로). 실제
 * stance를 합산하므로 임원마다 다른 값이 될 수 있다. */
function stanceSummaryLine(stances: Record<ExecMemberId, Stance>): string {
  const tally = { FOR: 0, AGAINST: 0, UNDECIDED: 0 };
  for (const roleId of EXEC_MEMBER_ORDER) {
    tally[stances[roleId]] += 1;
  }
  return `찬성 ${tally.FOR} · 반대 ${tally.AGAINST} · 고민 중 ${tally.UNDECIDED}`;
}

/** 자료 ID(E1~E4) 대신 자료명만 쓴다(T52). 시안은 "근거 · <자료명>" pill 하나만
 * 보여주므로(evidenceIds가 여럿이면 가장 마지막 것), 그 값을 돌려준다. */
function lastEvidenceLabel(scenario: Scenario, evidenceIds: string[]): string | null {
  const lastId = evidenceIds[evidenceIds.length - 1];
  if (!lastId) {
    return null;
  }
  const card = scenario.evidence.find((item) => item.id === lastId);
  return card ? card.title : lastId;
}

export function OpinionsScreen({
  scenario,
  mode,
  roleStatus,
  statements,
  stances,
  onNext,
  onRetryFailedRoles,
}: OpinionsScreenProps) {
  // 라운드당 1회(T65) — 세션 호출 상한(server/sessionLimit.ts)이 최종 방어선이지만, 화면도
  // 한 번 누르면 버튼을 잠가 재요청 의도를 분명히 한다.
  const [retryUsed, setRetryUsed] = useState(false);

  // scripted 카드 순차 노출(T95, 2026-10-08 사용자 — "필수로 보고 넘어가도록"): 네 카드가
  // 0.8초 간격으로 차례로 나타나고, 다 나올 때까지 CTA를 잠근다. prefers-reduced-motion이면
  // 즉시 다 보여준다(live는 roleStatus 기반 allExecsSettled 잠금을 그대로 쓰므로 영향 없음).
  const reducedMotion = useMatchMedia('(prefers-reduced-motion: reduce)');
  const totalCards = scenario.initialOpinions.length;
  const [revealedCount, setRevealedCount] = useState(mode === 'live' || reducedMotion ? totalCards : 0);
  useEffect(() => {
    if (mode === 'live' || reducedMotion) {
      setRevealedCount(totalCards);
      return;
    }
    setRevealedCount(0);
    const timers = Array.from({ length: totalCards }, (_, index) =>
      setTimeout(() => setRevealedCount((count) => Math.max(count, index + 1)), (index + 1) * 800),
    );
    return () => timers.forEach(clearTimeout);
    // scenario가 바뀔 때만 다시 돈다(mode·reducedMotion도 바뀌면 처음부터).
  }, [scenario.id, mode, reducedMotion, totalCards]);
  const allCardsRevealed = mode === 'live' || revealedCount >= totalCards;

  function handleRetry() {
    const failedRoleIds = EXEC_MEMBER_ORDER.filter((roleId) => roleStatus[roleId] === 'failed');
    if (failedRoleIds.length === 0 || !onRetryFailedRoles) {
      return;
    }
    setRetryUsed(true);
    onRetryFailedRoles(failedRoleIds);
  }

  // live에서 임원이 아직 판단 중일 때도 CTA가 열려 있던 문제(T84, Opus UX 검토 #21).
  // scripted는 initialOpinions가 항상 즉시 다 있으므로 영향받지 않는다(always
  // unlocked). live는 4명 전원이 answered·failed로 settle될 때까지 잠근다 — 라운드
  // 타임아웃 상한·1회 재요청은 기존 roleStatus·onRetryFailedRoles 규칙(T65) 그대로다.
  const allExecsSettled = EXEC_MEMBER_ORDER.every(
    (roleId) => roleStatus[roleId] === 'answered' || roleStatus[roleId] === 'failed',
  );
  const locked = mode === 'live' ? !allExecsSettled : !allCardsRevealed;

  const actions = (
    <div className="app-body__actions screen opinions-screen">
      <button
        type="button"
        className="cta"
        onClick={onNext}
        disabled={locked}
        data-testid="opinions-next"
        data-guide={!locked ? 'next' : undefined}
      >
        {locked ? '임원 의견을 듣는 중…' : '내 의견 쓰러 가기 ▶'}
      </button>
    </div>
  );

  // 오른쪽 종이 머리(시안 공통부): STEP 칩 + 제목 + CONFIDENTIAL 도장 + 안내 한 줄 +
  // 타자기 집계. live·scripted 모두 같은 머리를 쓰고 카드 그리드만 달라진다.
  const paperHead = (
    <>
      {/* T87(사용자 — "붉은 상자 안의 글씨는 영어로"): T83에서 한국어로 바꿨던 이
          도장만 영문으로 되돌렸다. */}
      <span className="opinions-screen__stamp" aria-hidden="true">
        CONFIDENTIAL
      </span>
      <div className="opinions-screen__head">
        <span className="opinions-screen__step">2단계</span>
        {/* 시안 원본은 <h1>이지만, 이 화면은 ATTRACT의 페이지 <h1>("BOARDROOM 2026")
            아래 중첩되는 화면 제목이라 다른 조종석 화면(BRIEFING·MOTION·VOTE 등)과
            같은 <h2> 위계를 쓴다 — 글자 크기·굵기는 시안 값 그대로다. */}
        <h2 className="opinions-screen__title">임원 의견 듣기</h2>
      </div>
      <div className="opinions-screen__meta">
        <span>같은 자료를 읽고 각자의 관점에서 말합니다.</span>
        <span className="opinions-screen__tally">{stanceSummaryLine(stances)}</span>
      </div>
      {locked ? (
        <GuideHint text="임원 네 명의 의견을 읽어 보세요" testId="opinions-guide-hint" />
      ) : null}
    </>
  );

  if (mode === 'live') {
    return (
      <>
        {actions}
        <div className="app-body__content screen opinions-screen__info">
          <div className="opinions-screen__paper">
            {paperHead}
            <LiveStatementCards
              scenario={scenario}
              stage="OPINIONS"
              roleStatus={roleStatus}
              statements={statements}
              stances={stances}
              onRetryFailedRoles={onRetryFailedRoles ? handleRetry : undefined}
              retryDisabled={retryUsed}
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {actions}
      <div className="app-body__content screen opinions-screen__info">
        <div className="opinions-screen__paper">
          {paperHead}
          <div className="opinions-screen__cards">
            {scenario.initialOpinions.slice(0, revealedCount).map((opinion) => {
              const stance = stances[opinion.memberId];
              const evidenceLabel = lastEvidenceLabel(scenario, opinion.evidenceIds);
              return (
                <article
                  key={opinion.memberId}
                  className={`opinion-card opinion-card--${STANCE_MODIFIER[stance]}`}
                >
                  <div className="opinion-card__head">
                    <span className="opinion-card__code" aria-hidden="true">
                      {opinion.memberId}
                    </span>
                    <h3 className="opinion-card__member">{MEMBER_LABELS[opinion.memberId]}</h3>
                    <span
                      className="opinion-card__mood"
                      data-testid={`exec-mood-label-${opinion.memberId}`}
                    >
                      {STANCE_LABEL[stance]}
                    </span>
                  </div>
                  <p className="opinion-card__text">{opinion.text}</p>
                  {evidenceLabel && <span className="opinion-card__evidence">근거 · {evidenceLabel}</span>}
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
