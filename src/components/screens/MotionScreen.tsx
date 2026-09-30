// 최종 안건 화면: 원안 문장, DISCUSS·REACTIONS에서 누적 확정된 조건, 남은 확인
// 사항을 보여준다. '이 안건으로 표결'을 누르면 지금까지 확정한 조건 전체로
// FREEZE_MOTION을 낸다(docs/SCENARIO_AI_ASSISTANT.md "최종 안건 화면").
// T45(조종석 배치): 왼쪽 열은 "이 안건으로 표결" CTA만, 오른쪽 열은 안건 카드·반영
// 조건·남은 과제를 담는다(DESIGN_SPEC.md v1.0 6절 표).
// T65(reviewer fix round): FOLLOWUP 라운드는 실패해도 후속 대기 게이트가 풀리는
// 즉시 CTA가 열려(설계된 대기일 뿐 실패를 막지 않는다) 참가자가 조용히 MOTION을
// 지나칠 수 있었다. opinions가 2건 이상(FOLLOWUP이 실제로 돌았다는 뜻)이고 그 라운드에
// 실패한 역할이 있으면 "응답 없는 임원 다시 요청" 버튼을 오른쪽 열에 보여준다 — 표결
// 진행 자체는 막지 않는다.

import { ExecStanceList } from '../parts/ExecStanceList';
import type { ExecMemberId } from '../../content/types';
import type { RoleStatus, SessionMode, Stance } from '../../domain/types';
import { useMemo, useState } from 'react';
import type { Scenario } from '../../content/types';
import type { Opinion } from '../../domain/types';
import { EXEC_MEMBER_ORDER } from '../../domain/voting';
import { collectConfirmedConditionIds } from '../opinionConditions';
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

  return (
    <>
      <div className="app-body__actions screen motion-screen">
        <button
          type="button"
          className="cta"
          disabled={freezeDisabled}
          onClick={() => onFreeze(confirmedConditionIds)}
          data-testid="freeze-motion"
        >
          이 안건으로 표결
        </button>
        {freezeDisabled && (
          <p className="motion-screen__waiting" data-testid="motion-waiting-followup">
            임원 후속 판단 중…
          </p>
        )}
      </div>
      <div className="app-body__content screen motion-screen__info">
        <h2 className="motion-screen__title">최종 안건</h2>
        <ExecStanceList stances={stances} />
        {onRetryFailedRoles && failedRoleIds.length > 0 && (
          <button
            type="button"
            className="live-round__retry cta cta--secondary"
            data-testid="retry-failed-roles"
            disabled={retryUsed}
            onClick={handleRetry}
          >
            {retryUsed ? '다시 요청함 · 응답 없는 임원은 회의록에 남습니다' : '응답 없는 임원 다시 요청'}
          </button>
        )}
        <article className="motion-screen__card" data-testid="motion-card">
          <p className="motion-screen__original">{scenario.originalMotion.text}</p>
          <h3 className="motion-screen__section-label">확정 조건</h3>
          {confirmedConditionIds.length > 0 ? (
            <ul className="motion-screen__conditions" data-testid="motion-conditions">
              {confirmedConditionIds.map((id) => (
                <li key={id}>{conditionLabel(id)}</li>
              ))}
            </ul>
          ) : (
            <p className="motion-screen__no-conditions">확정한 수정 조건이 없어 원안 그대로 표결합니다.</p>
          )}
          <h3 className="motion-screen__section-label">남은 확인 사항</h3>
          <ul className="motion-screen__tasks">
            {scenario.remainingTasks.map((task) => (
              <li key={task}>{task}</li>
            ))}
          </ul>
        </article>
      </div>
    </>
  );
}
