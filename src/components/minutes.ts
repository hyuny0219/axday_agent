// 회의록 패널이 그릴 항목을 계산하는 순수 함수(DESIGN_SPEC.md v1.0 7절 "회의록 패널과
// 후속 대기 게이트", T41). App.tsx가 매 렌더마다 세션 상태 전체에서 buildMinutes를 다시
// 계산한다 — 별도 누적 상태를 두지 않는다. 라운드별 임원 응답 상태(roundLog)만 App.tsx가
// SET_ROLE_STATUS(stage 포함) dispatch를 가로채 쌓아 두고 여기 인자로 넘긴다. reducer
// 분기·조건·표결·타이머 규칙은 건드리지 않는다.

import type { ExecMemberId, Reaction, Scenario } from '../content/types';
import type { MemberId, RoleStatus, Session, SessionStage, StatementStage } from '../domain/types';
import { EXEC_MEMBER_ORDER } from '../domain/voting';
import { reactionsFor } from './reactionsFor';

/** 회의록 한 줄. kind는 아바타 강조와 문구 대체 규칙을 정한다:
 * speech=발언 원문, pending=판단 중(점 3개), failed=응답 없음, mine=참가자 발언. */
export interface MinutesEntry {
  id: string;
  speaker: MemberId;
  text: string;
  kind: 'speech' | 'pending' | 'failed' | 'mine';
}

/** App.tsx가 SET_ROLE_STATUS(stage 포함) dispatch만 골라 (stage, roleId) 기준으로
 * upsert해 쌓는 라운드별 임원 응답 기록. 뒤 라운드가 roleStatus를 덮어써도 이전 라운드의
 * 기록은 여기 남는다(v1.0 7절 "roundLog 기준, 뒤 라운드가 roleStatus를 덮어도 남는다"). */
export interface RoundLogEntry {
  stage: StatementStage;
  roleId: ExecMemberId;
  status: RoleStatus;
}

/** roundLog에 같은 (stage, roleId) 항목이 있으면 덮어쓰고, 없으면 뒤에 더한다. 순서는
 * 최초 등장 순서를 유지한다(덮어쓰기는 자리를 바꾸지 않는다). */
export function upsertRoundLogEntry(
  entries: RoundLogEntry[],
  next: RoundLogEntry,
): RoundLogEntry[] {
  const index = entries.findIndex(
    (entry) => entry.stage === next.stage && entry.roleId === next.roleId,
  );
  if (index === -1) {
    return [...entries, next];
  }
  const updated = [...entries];
  updated[index] = next;
  return updated;
}

const STAGE_ORDER: readonly SessionStage[] = [
  'ATTRACT',
  'SELECT',
  'BRIEFING',
  'OPINIONS',
  'DISCUSS',
  'REACTIONS',
  'MOTION',
  'VOTE',
  'RESULT',
];

function stageAtLeast(stage: SessionStage, target: SessionStage): boolean {
  return STAGE_ORDER.indexOf(stage) >= STAGE_ORDER.indexOf(target);
}

interface RoundResult {
  roleId: ExecMemberId;
  kind: 'speech' | 'pending' | 'failed';
  text: string;
}

/** live 라운드(OPINIONS/REACTIONS/FOLLOWUP) 한 건의 임원 4명 결과를 roundLog(상태) +
 * transcript(발언 원문)에서 계산한다. roundLog에 아직 기록이 없으면(라운드 시작 직전)
 * 판단 중으로 본다. */
function liveRoundResults(
  stage: StatementStage,
  session: Session,
  roundLog: RoundLogEntry[],
): RoundResult[] {
  return EXEC_MEMBER_ORDER.map((roleId) => {
    const logged = roundLog.find((entry) => entry.stage === stage && entry.roleId === roleId);
    const status = logged?.status ?? 'pending';
    if (status === 'answered') {
      const statement = session.transcript.statements.find(
        (item) => item.roleId === roleId && item.stage === stage,
      );
      return { roleId, kind: 'speech' as const, text: statement?.text ?? '' };
    }
    if (status === 'failed') {
      return { roleId, kind: 'failed' as const, text: '응답 없음' };
    }
    return { roleId, kind: 'pending' as const, text: '' };
  });
}

function scriptedReactionText(reactions: Reaction[]): string {
  return reactions.length > 0 ? (reactions[0]?.text ?? '기존 의견 유지') : '기존 의견 유지';
}

/**
 * 세션 상태에서 회의록 항목을 시간순으로 계산한다(v1.0 7절 항목 1~8). ATTRACT·SELECT
 * (안건이 아직 없음)에서는 빈 배열을 돌려준다. 각 항목은 그 단계에 도달했을 때만
 * 나타나고, 이후 단계로 넘어가도 사라지지 않는다.
 */
export function buildMinutes(
  session: Session,
  scenario: Scenario,
  roundLog: RoundLogEntry[],
): MinutesEntry[] {
  if (session.stage === 'ATTRACT' || session.stage === 'SELECT') {
    return [];
  }

  const entries: MinutesEntry[] = [];

  // 1. 의장 브리핑
  entries.push({
    id: 'chair-briefing',
    speaker: 'CEO',
    text: scenario.chairBriefing.situation,
    kind: 'speech',
  });

  // 2. 임원 첫 의견 4건
  if (stageAtLeast(session.stage, 'OPINIONS')) {
    if (session.mode === 'live') {
      for (const result of liveRoundResults('OPINIONS', session, roundLog)) {
        entries.push({
          id: `opinion-${result.roleId}`,
          speaker: result.roleId,
          text: result.text,
          kind: result.kind,
        });
      }
    } else {
      for (const opinion of scenario.initialOpinions) {
        entries.push({
          id: `opinion-${opinion.memberId}`,
          speaker: opinion.memberId,
          text: opinion.text,
          kind: 'speech',
        });
      }
    }
  }

  const firstOpinion = session.opinions[0];
  if (firstOpinion) {
    // 3. 내 발언
    entries.push({
      id: 'my-opinion',
      speaker: 'PARTICIPANT',
      text: firstOpinion.originalText,
      kind: 'mine',
    });

    // 4. 임원 반응 4건
    if (session.mode === 'live') {
      for (const result of liveRoundResults('REACTIONS', session, roundLog)) {
        entries.push({
          id: `reaction-${result.roleId}`,
          speaker: result.roleId,
          text: result.text,
          kind: result.kind,
        });
      }
    } else {
      for (const roleId of EXEC_MEMBER_ORDER) {
        const reactions = reactionsFor(scenario, roleId, firstOpinion.confirmedConditionIds);
        entries.push({
          id: `reaction-${roleId}`,
          speaker: roleId,
          text: scriptedReactionText(reactions),
          kind: 'speech',
        });
      }
    }

    // 5. CAIO 질문
    entries.push({
      id: 'caio-question',
      speaker: scenario.followUp.askedBy,
      text: scenario.followUp.question,
      kind: 'speech',
    });
  }

  // 6·7·8: 내 답, 임원 후속(live만), 의장 안건 고정
  if (stageAtLeast(session.stage, 'MOTION')) {
    const secondOpinion = session.opinions[1];
    entries.push({
      id: 'my-followup',
      speaker: 'PARTICIPANT',
      text: secondOpinion ? secondOpinion.originalText : '앞서 전달한 의견을 유지',
      kind: 'mine',
    });

    if (session.mode === 'live' && session.opinions.length >= 2) {
      for (const result of liveRoundResults('FOLLOWUP', session, roundLog)) {
        entries.push({
          id: `followup-${result.roleId}`,
          speaker: result.roleId,
          text: result.text,
          kind: result.kind,
        });
      }
    }

    entries.push({
      id: 'chair-motion',
      speaker: 'CEO',
      text: '이 조건으로 안건을 고정합니다',
      kind: 'speech',
    });
  }

  return entries;
}

/** entries 중 최근 n건만 보이게 하고 나머지는 hidden으로 표시한다(창 고정, sr-only —
 * 화면에는 최근 n건만, 스크린리더에는 전체가 남는다). n이 entries.length 이상이면 아무
 * 것도 숨기지 않는다. */
export function visibleWindow(
  entries: MinutesEntry[],
  n: number,
): Array<MinutesEntry & { hidden: boolean }> {
  const cutoff = entries.length - Math.max(n, 0);
  return entries.map((entry, index) => ({ ...entry, hidden: index < cutoff }));
}
