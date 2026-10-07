// 최종 안건 화면: 원안 문장, DISCUSS·REACTIONS에서 누적 확정된 조건을 보여준다.
// '이 안건으로 표결'을 누르면 지금까지 확정한 조건 전체로 FREEZE_MOTION을 낸다
// (docs/SCENARIO_AI_ASSISTANT.md "최종 안건 화면").
// T75(docs/design/mockups/S5_Motion.html 시안 그대로): 왼쪽 열은 무대(StageBand,
// App.tsx가 그린다) 아래 TRANSCRIPT 패널(App.tsx의 MinutesPanel, 남는 높이를 채운다)
// 뿐이다 — 이 화면의 app-body__actions에는 입력 상자가 없다(ExecStanceList sr-only만
// 둔다). 오른쪽 종이 한 장에 STEP 05·1/2 + 제목 + DRAFT 도장, "MOTION ON THE TABLE"
// 상자(원안 문구, domain/motion.ts의 문안 생성 규칙은 바꾸지 않는다 — 항상
// scenario.originalMotion.text 그대로다), CONDITIONS·NOT INCLUDED 2열, CHAIR 점선
// 안내, 바닥 CTA를 담는다. CTA는 시안처럼 오른쪽 종이 바닥에 둔다(원래 "CTA는 항상
// 왼쪽 열" 원칙의 예외 — 이 카드는 왼쪽 열에 입력 상자가 전혀 없다고 명시한다).
// live의 FOLLOWUP 실패 "다시 요청" 버튼은 TRANSCRIPT 패널 내부(App.tsx의 공용
// MinutesPanel)를 건드릴 수 없어, 그 바로 위 왼쪽 열(app-body__actions) 끝에 작은
// 보조 버튼으로 둔다(오케스트레이터 지시 — MinutesPanel 내부는 건드리지 않는다).

import { ExecStanceList } from '../parts/ExecStanceList';
import type { ExecMemberId } from '../../content/types';
import type { RoleStatus, SessionMode, Stance } from '../../domain/types';
import { useMemo, useState } from 'react';
import type { Scenario } from '../../content/types';
import type { Opinion } from '../../domain/types';
import { EXEC_MEMBER_ORDER } from '../../domain/voting';
import { collectConfirmedConditionIds, collectParticipantStance } from '../opinionConditions';
import { buildMotionDisplay } from '../motionDisplay';
import '../../styles/screens/motion.css';
import '../../styles/screens/live.css';

export interface MotionScreenProps {
  scenario: Scenario;
  opinions: Opinion[];
  /** live에서 후속 답을 제출한 뒤 runRound('FOLLOWUP')이 settle되기 전이면 true(T46,
   * DESIGN_SPEC.md v1.0 7절 "후속 대기 게이트"). scripted와 '의견 유지'(후속 라운드
   * 없음) 경로는 항상 undefined/false로 넘어와 CTA가 그대로 활성이다. */
  freezeDisabled?: boolean;
  /** 무대 표정 배지의 접근 가능한 텍스트(sr-only, PR #11 Codex 13차). */
  stances: Record<ExecMemberId, Stance>;
  /** live/scripted(T65). scripted·FOLLOWUP 미실행 시에는 재요청 버튼을 그리지 않는다. */
  mode?: SessionMode;
  /** FOLLOWUP 라운드가 남긴 역할 상태(T65) — opinions가 2건 이상일 때만 FOLLOWUP 결과로
   * 본다(그 전이면 REACTIONS의 상태가 그대로 남아 있을 뿐이다). */
  roleStatus?: Record<ExecMemberId, RoleStatus>;
  /** 있으면 실패한 역할만 FOLLOWUP을 다시 부른다(T65 "응답 없는 임원 다시 요청", 1회). */
  onRetryFailedRoles?: (roleIds: ExecMemberId[]) => void;
  onFreeze: (confirmedConditionIds: string[]) => void;
}

export function MotionScreen({
  scenario,
  stances,
  opinions,
  freezeDisabled = false,
  mode,
  roleStatus,
  onRetryFailedRoles,
  onFreeze,
}: MotionScreenProps) {
  const confirmedConditionIds = useMemo(() => collectConfirmedConditionIds(opinions), [opinions]);
  const participantStance = useMemo(() => collectParticipantStance(opinions), [opinions]);
  // 라운드당 1회(T65) — 세션 호출 상한(server/sessionLimit.ts)이 최종 방어선이다. 세션
  // 전체에서 라운드 재요청은 1회뿐이라(OPINIONS·REACTIONS·FOLLOWUP 중 먼저 쓴 곳에서
  // 소진), 이미 다른 단계에서 재요청을 썼으면 이 버튼을 눌러도 서버가 call_limit으로
  // 거절해 실패로 남는다(자동 재시도는 없다).
  const [retryUsed, setRetryUsed] = useState(false);

  // FOLLOWUP은 opinions가 2건이 될 때만 돈다(App.tsx의 트리거 조건과 같다, T46). 그 전에는
  // roleStatus가 REACTIONS 결과를 그대로 들고 있을 뿐이라 재요청 대상으로 보지 않는다.
  const followUpRan = mode === 'live' && opinions.length >= 2;
  const failedRoleIds = followUpRan && roleStatus
    ? EXEC_MEMBER_ORDER.filter((roleId) => roleStatus[roleId] === 'failed')
    : [];

  function handleRetry() {
    if (failedRoleIds.length === 0 || !onRetryFailedRoles) {
      return;
    }
    setRetryUsed(true);
    onRetryFailedRoles(failedRoleIds);
  }

  function conditionLabel(id: string): string {
    return scenario.conditions.find((condition) => condition.id === id)?.label ?? id;
  }

  // "MOTION ON THE TABLE · 원안/수정안"(시안): 확정 조건이 하나도 없으면 원안, 하나라도
  // 있으면 수정안이다 — domain/motion.ts freezeMotion의 kind 판정(baseConditionIds는
  // 모든 시나리오에서 항상 [])과 같은 결과를 내는 표시용 계산일 뿐, 문안 생성 규칙 자체는
  // 건드리지 않는다(문구는 항상 scenario.originalMotion.text 그대로).
  const motionKindLabel = confirmedConditionIds.length === 0 ? '원안' : '수정안';

  // 표결 안건 문장(T84, Opus UX 검토 #3+my#2): scenario.originalMotion.text를 그대로
  // 보여주면 조건을 붙여도 "…절차는 미정이다."로 끝나 모순돼 보인다. 표시만 동적으로
  // 구성한다(motion.text 자체·freezeMotion에 넘기는 값은 바뀌지 않는다).
  const motionDisplay = buildMotionDisplay(scenario, confirmedConditionIds, participantStance);

  // "NOT INCLUDED · 빠진 것"(시안): 이번에 확정되지 않은 조건들을 그대로 나열한다 — 새
  // 사실을 만들지 않고 scenario.conditions·확정 목록만으로 계산한다.
  const notIncludedLabels = scenario.conditions
    .filter((condition) => !confirmedConditionIds.includes(condition.id))
    .map((condition) => condition.label);

  return (
    <>
      <div className="app-body__actions screen motion-screen">
        <ExecStanceList stances={stances} />
        {onRetryFailedRoles && failedRoleIds.length > 0 && (
          <button
            type="button"
            className="motion-screen__retry cta cta--secondary"
            data-testid="retry-failed-roles"
            disabled={retryUsed}
            onClick={handleRetry}
          >
            {retryUsed ? '다시 물어봤습니다 · 답이 없어도 그대로 진행됩니다' : '다시 물어보기'}
          </button>
        )}
      </div>
      <div className="app-body__content screen motion-screen__info">
        <div className="motion-screen__paper">
          {/* T87(사용자 — "붉은 상자 안의 글씨는 영어로"): T83에서 한국어로 바꿨던 이
              도장만 영문으로 되돌렸다. */}
          <span className="motion-screen__stamp" aria-hidden="true">
            DRAFT
          </span>
          <div className="motion-screen__head">
            <span className="motion-screen__step">5단계 · 1/2</span>
            {/* 시안 원본은 <h1>이지만, 다른 조종석 화면과 같은 <h2> 위계를 쓴다(T72와
                같은 이유) — 글자 크기·굵기는 시안 값 그대로다. */}
            <h2 className="motion-screen__title">지금 표결할 안건</h2>
          </div>
          <div className="motion-screen__motion-box" data-testid="motion-card">
            <span className="motion-screen__box-label">표결 안건 · {motionKindLabel}</span>
            <p className="motion-screen__motion-text">{motionDisplay.sentence}</p>
            {motionDisplay.undecidedLabels.length > 0 && (
              <p className="motion-screen__not-included-text" data-testid="motion-undecided">
                아직 정하지 않은 것 · {motionDisplay.undecidedLabels.join(' · ')}
              </p>
            )}
          </div>
          <div className="motion-screen__cols">
            <div className="motion-screen__cols-box">
              <span className="motion-screen__box-label">
                {participantStance === 'AGAINST' && confirmedConditionIds.length > 0
                  ? `이사님이 요구한 조건 ${confirmedConditionIds.length}`
                  : `반영된 조건 ${confirmedConditionIds.length}`}
              </span>
              {confirmedConditionIds.length > 0 ? (
                <ul className="motion-screen__conditions" data-testid="motion-conditions">
                  {confirmedConditionIds.map((id) => (
                    <li key={id}>{conditionLabel(id)}</li>
                  ))}
                </ul>
              ) : (
                <p className="motion-screen__no-conditions">
                  확정한 수정 조건이 없어 원안 그대로 표결합니다.
                </p>
              )}
            </div>
            <div className="motion-screen__cols-box">
              <span className="motion-screen__box-label">빠진 것</span>
              <p className="motion-screen__not-included-text">
                {notIncludedLabels.length > 0 ? (
                  <>{notIncludedLabels.join(', ')}. 조건이 실제로 효과가 있는지는 운영하면서 확인합니다.</>
                ) : (
                  '제안하신 조건이 모두 들어갔습니다.'
                )}
              </p>
            </div>
          </div>
          <div className="motion-screen__chair-box">
            <span className="motion-screen__box-label">의장</span>
            {/* T94(2026-10-08 사용자 지시): "문안"을 이미 화면 전체가 쓰는 "안건"으로
                바꿔 쉬운 말 톤을 맞춘다(의미는 그대로). */}
            <p className="motion-screen__chair-text">
              이 안건을 고정하고 표결로 넘어갑니다. 고정한 뒤에는 조건을 바꿀 수 없습니다. 임원 네
              명은 같은 안건을 보고 각자 표를 정합니다.
            </p>
          </div>
          <div className="motion-screen__cta-row">
            <button
              type="button"
              className="cta"
              disabled={freezeDisabled}
              onClick={() => onFreeze(confirmedConditionIds)}
              data-testid="freeze-motion"
            >
              이 안건으로 표결 ▶
            </button>
            <span className="motion-screen__cta-hint">조건 확정</span>
          </div>
          {freezeDisabled && (
            <p className="motion-screen__waiting" data-testid="motion-waiting-followup">
              임원 후속 판단 중…
            </p>
          )}
        </div>
      </div>
    </>
  );
}
