// 설득 현황판(T96, 2026-10-08 사용자 지시 "내가 의견을 내고 어떤 조건을 붙여야 AI
// 임원을 설득할 수 있는지 표현되고, 내 발언에 따라 임원 입장이 변하는 것이 잘 보이게").
// DISCUSS·REACTIONS(1/2·2/2)·MOTION·VOTE 왼쪽 열 무대 아래에 공통으로 둔다. 임원 4명의
// "첫 의견 → 지금" 입장과, 아직 설득되지 않았으면 "움직일 조건"(domain/voting.ts의
// requiredConditionsFor, scripted voteRules에서 YES로 가는 가장 작은 조건 조합)을 한
// 줄씩 보여준다. 참가자가 반대 입장이면 같은 데이터를 "이 조건이 빠지면 반대로
// 남습니다"로 뒤집어 보여준다 — 반대 참가자의 목표는 임원을 NO에 묶어 두는 것이지
// YES로 보내는 것이 아니다. live 모드는 scripted 규칙표가 실제 결정권이 없으므로(LLM이
// 자유롭게 답한다) 임원의 가장 최근 발언에 실린 suggestedConditionIds를 함께 모아
// "참고"로 표시한다.

import { useState } from 'react';
import type { ExecMemberId, Scenario } from '../../content/types';
import type { ParticipantStance, SessionMode, Stance, Statement } from '../../domain/types';
import { EXEC_MEMBER_ORDER, requiredConditionsFor } from '../../domain/voting';
import { MEMBER_LABELS } from '../memberLabels';
import { SHORT_STANCE_LABEL } from '../moodLabel';
import { latestSuggestedConditionIds } from '../liveTranscript';
import { openingStanceOf } from '../openingStance';
import '../../styles/screens/persuasionBoard.css';

export interface PersuasionBoardProps {
  scenario: Scenario;
  /** 지금까지 확정한 조건(DISCUSS·REACTIONS는 그 시점까지의 누적, MOTION·VOTE는 최종안
   * effectiveConditionIds). stances와 같은 기준 시점이어야 두 열이 어긋나지 않는다. */
  confirmedConditionIds: string[];
  participantStance: ParticipantStance;
  /** 무대 표정 배지와 같은 기준의 "지금" 입장(live/scripted 모두 App.tsx가 이미 골라
   * 내려주는 값을 그대로 쓴다). */
  stances: Record<ExecMemberId, Stance>;
  mode: SessionMode;
  /** live 전용 참고 자료 — 임원별 가장 최근 발언에 실린 제안 조건(있으면). scripted
   * voteRules는 live 결정권이 없으므로, 이 값이 있으면 "움직일 조건"에 함께 보여주고
   * "참고" 표시를 붙인다. */
  liveSuggestedConditionIds?: Partial<Record<ExecMemberId, readonly string[]>>;
  /** live 회의 기록의 발언들(세션 transcript.statements). 첫 의견 입장(첫 OPINIONS 발언의
   * stance)과, liveSuggestedConditionIds를 따로 안 넘겼을 때의 제안 조건(역할별 최신
   * 발언)을 여기서 뽑는다(PR #20 Codex 28차 P2-3·P2-4). scripted는 쓰지 않는다. */
  statements?: readonly Statement[];
}

function conditionLabel(scenario: Scenario, id: string): string {
  return scenario.conditions.find((condition) => condition.id === id)?.label ?? id;
}

function uniqueInOrder(ids: readonly string[]): string[] {
  const result: string[] = [];
  for (const id of ids) {
    if (!result.includes(id)) result.push(id);
  }
  return result;
}

interface Row {
  memberId: ExecMemberId;
  stanceText: string;
  stanceChanged: boolean;
  conditionNote: string;
}

function buildRow(
  scenario: Scenario,
  memberId: ExecMemberId,
  confirmedConditionIds: string[],
  participantStance: ParticipantStance,
  stances: Record<ExecMemberId, Stance>,
  mode: SessionMode,
  liveSuggestedConditionIds?: Partial<Record<ExecMemberId, readonly string[]>>,
  statements: readonly Statement[] = [],
): Row {
  const opening = openingStanceOf(scenario, memberId, mode, statements);
  const current = stances[memberId];
  const stanceChanged = opening !== current;
  const stanceText = stanceChanged
    ? `${SHORT_STANCE_LABEL[opening]} → ${SHORT_STANCE_LABEL[current]}`
    : SHORT_STANCE_LABEL[current];

  // 참가자 목표: AGAINST면 임원을 NO(반대)에 묶어 두는 것, 그 외(FOR·미선택)는 YES(찬성)로
  // 설득하는 것이다(설득 도장·persuasionStamp와 같은 "참가자 표와 같은 쪽"이라는 전제).
  const targetVote: Stance = participantStance === 'AGAINST' ? 'AGAINST' : 'FOR';
  const required = requiredConditionsFor(scenario, memberId, confirmedConditionIds, participantStance ?? null);

  const liveHints = mode === 'live' ? liveSuggestedConditionIds?.[memberId] ?? [] : [];
  const refSuffix = mode === 'live' ? ' · 참고' : '';

  function labelsOf(ids: readonly string[]): string {
    return uniqueInOrder(ids)
      .map((id) => conditionLabel(scenario, id))
      .join('·');
  }

  if (targetVote === 'FOR') {
    if (current === 'FOR') {
      return { memberId, stanceText, stanceChanged, conditionNote: '설득 완료' };
    }
    const ids = uniqueInOrder([...(required.conditionIds ?? []), ...liveHints]);
    if (required.conditionIds === null && ids.length === 0) {
      return { memberId, stanceText, stanceChanged, conditionNote: '조건으로는 설득이 어렵습니다' };
    }
    return {
      memberId,
      stanceText,
      stanceChanged,
      conditionNote: `움직일 조건 · ${labelsOf(ids)}${refSuffix}`,
    };
  }

  // targetVote === 'AGAINST'(참가자가 반대 쪽)
  if (current === 'AGAINST') {
    const ids = uniqueInOrder([...(required.conditionIds ?? []), ...liveHints]);
    if (required.conditionIds === null && ids.length === 0) {
      return { memberId, stanceText, stanceChanged, conditionNote: '조건과 무관하게 반대를 유지합니다' };
    }
    return {
      memberId,
      stanceText,
      stanceChanged,
      conditionNote: `'${labelsOf(ids)}' 조건이 빠지면 반대로 남습니다${refSuffix}`,
    };
  }
  if (current === 'FOR') {
    return { memberId, stanceText, stanceChanged, conditionNote: '이미 찬성 쪽입니다' };
  }
  return { memberId, stanceText, stanceChanged, conditionNote: '아직 의견을 내지 않았습니다' };
}

/** 1280px보다 넓은 화면인지 — 현황판 기본 펼침/접힘 판단(persuasionBoard.css의 1280 분기점과 같다). */
function isWideViewport(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(min-width: 1281px)').matches
    : false;
}

export function PersuasionBoard({
  scenario,
  confirmedConditionIds,
  participantStance,
  stances,
  mode,
  liveSuggestedConditionIds,
  statements,
}: PersuasionBoardProps) {
  // 설득 현황판 접기/펼치기(2026-10-08 팀리드 지시 — 1280×720 DISCUSS 왼쪽 열이 4행
  // 전부를 펼친 채로는 세로로 넘쳐 하단 CTA가 잘렸다). 좁은 화면(≤1280px)에서만 기본
  // 접힘 — 요약 한 줄("설득 N/4 · CFO·CISO 남음")만 보이고, "자세히 보기"를 눌러야
  // 임원별 4행을 펼친다. 1920×1080처럼 공간이 넉넉한 부스 화면은 T96 취지(임원 입장
  // 변화가 한눈에 보이게)대로 기본 펼침. 첫 렌더에서 한 번만 판단한다(테스트 jsdom은
  // matchMedia가 없어 접힘으로 시작한다).
  const [expanded, setExpanded] = useState(() => isWideViewport());
  const targetVote: Stance = participantStance === 'AGAINST' ? 'AGAINST' : 'FOR';
  const notYetTargetMembers = EXEC_MEMBER_ORDER.filter((memberId) => stances[memberId] !== targetVote);
  const persuadedCount = EXEC_MEMBER_ORDER.length - notYetTargetMembers.length;
  const liveHints =
    mode === 'live' ? (liveSuggestedConditionIds ?? latestSuggestedConditionIds(statements ?? [])) : undefined;
  const rows = EXEC_MEMBER_ORDER.map((memberId) =>
    buildRow(scenario, memberId, confirmedConditionIds, participantStance, stances, mode, liveHints, statements),
  );

  return (
    // 2026-10-08 팀리드 지시(2차): 접힌 상태에서도 "설득 현황판" 제목 줄 + 요약 줄
    // 2줄을 쓰면 REACTIONS(다시 답하기)처럼 왼쪽 열이 이미 빠듯한 화면에서 다시
    // 넘친다 — 제목·집계·요약·펼치기를 한 줄로 합친다(제목은 aria-label로만 남긴다).
    <div className="persuasion-board" data-testid="persuasion-board" aria-label="설득 현황판">
      <div className="persuasion-board__head">
        <span className="persuasion-board__count" data-testid="persuasion-board-count">
          설득한 임원 {persuadedCount}/4
        </span>
        {!expanded && (
          <span className="persuasion-board__summary" data-testid="persuasion-board-summary">
            {notYetTargetMembers.length === 0 ? '모두 설득 완료' : `${notYetTargetMembers.join('·')} 남음`}
          </span>
        )}
        <button
          type="button"
          className="persuasion-board__toggle"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          data-testid="persuasion-board-toggle"
        >
          {expanded ? '접기 ▲' : '자세히 보기 ▾'}
        </button>
      </div>
      {expanded && (
        <ul className="persuasion-board__list">
          {rows.map((row) => (
            <li
              key={row.memberId}
              className="persuasion-board__row"
              data-testid={`persuasion-board-row-${row.memberId}`}
            >
              <span className="persuasion-board__member" title={MEMBER_LABELS[row.memberId]}>
                {row.memberId}
              </span>
              <span
                className={`persuasion-board__stance${row.stanceChanged ? ' persuasion-board__stance--changed' : ''}`}
                data-testid={`persuasion-board-stance-${row.memberId}`}
              >
                {row.stanceText}
              </span>
              <span className="persuasion-board__note" data-testid={`persuasion-board-note-${row.memberId}`}>
                {row.conditionNote}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
