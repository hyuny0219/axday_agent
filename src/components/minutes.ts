// 회의록 패널이 그릴 항목을 계산하는 순수 함수(DESIGN_SPEC.md v1.0 7절 "회의록 패널과
// 후속 대기 게이트", T41). App.tsx가 매 렌더마다 세션 상태 전체에서 buildMinutes를 다시
// 계산한다 — 별도 누적 상태를 두지 않는다. 라운드별 임원 응답 상태(roundLog)만 App.tsx가
// SET_ROLE_STATUS(stage 포함) dispatch를 가로채 쌓아 두고 여기 인자로 넘긴다. reducer
// 분기·조건·표결·타이머 규칙은 건드리지 않는다.

import type { ExecMemberId, Reaction, Scenario } from '../content/types';
import type { MemberId, RoleStatus, Session, SessionStage, StatementStage } from '../domain/types';
import { EXEC_MEMBER_ORDER } from '../domain/voting';
import { reactionsFor, oppositionReactionText, resolveFollowUpPrompt } from './reactionsFor';
import { chairMotionLine } from './chairMotionLine';
import { collectConfirmedConditionIds, collectParticipantStance } from './opinionConditions';

/** 시간 표기를 알 수 없을 때 보여주는 자리표시(T77, 시안 TRANSCRIPT "[--:--]"). */
export const TIME_UNKNOWN = '--:--';

/** 세션 시작(startedAt) 기준 경과 시간을 "mm:ss"로 포맷한다(T77). 시작 시각이나 발생
 * 시각 중 하나라도 없으면(scripted 각본 항목·아직 응답하지 않은 live 역할) `TIME_UNKNOWN`을
 * 돌려준다 — 실측되지 않은 시간을 지어내지 않는다. */
export function formatElapsed(startedAt: number | null, occurredAt: number | undefined): string {
  if (startedAt === null || occurredAt === undefined) {
    return TIME_UNKNOWN;
  }
  const elapsedSeconds = Math.max(0, Math.floor((occurredAt - startedAt) / 1000));
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** 회의록 한 줄. kind는 문구 대체 규칙을 정한다:
 * speech=발언 원문, pending=판단 중(대기 중 표시), failed=응답 없음, mine=참가자 발언.
 * timeLabel은 "[mm:ss]" 안에 그대로 넣을 문자열(T77, 세션 시작 기준 경과 또는 TIME_UNKNOWN). */
export interface MinutesEntry {
  id: string;
  speaker: MemberId;
  text: string;
  kind: 'speech' | 'pending' | 'failed' | 'mine';
  timeLabel: string;
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
  /** 응답 발언의 도착 시각(statement.createdAt). speech가 아니면 없다(T77 타임스탬프 계산용). */
  createdAt?: number;
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
      return { roleId, kind: 'speech' as const, text: statement?.text ?? '', createdAt: statement?.createdAt };
    }
    if (status === 'failed') {
      return { roleId, kind: 'failed' as const, text: '이번에는 답을 받지 못했습니다' };
    }
    return { roleId, kind: 'pending' as const, text: '' };
  });
}

const NO_REACTION_TEXT = '앞서 말씀드린 입장 그대로입니다.';

/** T92: 순수 반대(조건 없음) 전용 문구가 있으면 그 문구가 "none" 기본 반응(모든 입장에
 * 같이 쓰이던 "말씀은 기록했습니다")보다 우선한다. 조건이 있으면(조건 기반 반응) 그대로
 * 조건 반응이 우선이다 — opposition은 그 경우 undefined(reactionsFor.ts). */
function scriptedReactionText(
  reactions: Reaction[],
  opposition: string | undefined,
): string {
  if (opposition !== undefined) {
    return opposition;
  }
  return reactions.length > 0 ? reactions[0]?.text ?? NO_REACTION_TEXT : NO_REACTION_TEXT;
}

/** 참가자 발언 행에 입장을 덧붙인다(T92, "참가자 행에 이사님 입장이 보이게"). 입장을
 * 고르지 않았으면 원문 그대로. */
function withStanceLabel(text: string, stance: 'FOR' | 'AGAINST' | null | undefined): string {
  if (!stance) return text;
  return `${text} (이사님 입장: ${stance === 'FOR' ? '찬성' : '반대'})`;
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
  const { startedAt } = session;

  // 1. 의장 브리핑(세션이 시작되며 바로 나오는 각본 문구라 세션 시작 시각 자체를
  // 경과 시간으로 쓴다 — SELECT_SCENARIO가 BRIEFING 진입과 같은 트랜지션에서
  // startedAt을 찍는다, domain/session.ts. 시안 Main.html도 "[00:00] CEO"다).
  entries.push({
    id: 'chair-briefing',
    speaker: 'CEO',
    text: scenario.chairBriefing.situation,
    kind: 'speech',
    timeLabel: formatElapsed(startedAt, startedAt ?? undefined),
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
          timeLabel: formatElapsed(startedAt, result.createdAt),
        });
      }
    } else {
      for (const opinion of scenario.initialOpinions) {
        entries.push({
          id: `opinion-${opinion.memberId}`,
          speaker: opinion.memberId,
          text: opinion.text,
          kind: 'speech',
          timeLabel: TIME_UNKNOWN,
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
      text: withStanceLabel(firstOpinion.originalText, firstOpinion.stance),
      kind: 'mine',
      timeLabel: formatElapsed(startedAt, firstOpinion.createdAt),
    });

    // 4. 임원 반응 4건
    if (session.mode === 'live') {
      for (const result of liveRoundResults('REACTIONS', session, roundLog)) {
        entries.push({
          id: `reaction-${result.roleId}`,
          speaker: result.roleId,
          text: result.text,
          kind: result.kind,
          timeLabel: formatElapsed(startedAt, result.createdAt),
        });
      }
    } else {
      for (const roleId of EXEC_MEMBER_ORDER) {
        const reactions = reactionsFor(scenario, roleId, firstOpinion.confirmedConditionIds);
        const opposition = oppositionReactionText(
          scenario,
          roleId,
          firstOpinion.stance ?? null,
          firstOpinion.confirmedConditionIds,
        );
        entries.push({
          id: `reaction-${roleId}`,
          speaker: roleId,
          text: scriptedReactionText(reactions, opposition),
          kind: 'speech',
          timeLabel: TIME_UNKNOWN,
        });
      }
    }

    // 5. 후속 질문(각본 문구, 도착 시각 없음). T93: 참가자 입장별로 묻는 임원·질문이
    // 다를 수 있다(resolveFollowUpPrompt).
    const followUpPrompt = resolveFollowUpPrompt(scenario, firstOpinion.stance ?? null);
    entries.push({
      id: 'caio-question',
      speaker: followUpPrompt.askedBy,
      text: followUpPrompt.question,
      kind: 'speech',
      timeLabel: TIME_UNKNOWN,
    });
  }

  // 6·7·8: 내 답, 임원 후속(live만), 의장 안건 고정
  if (stageAtLeast(session.stage, 'MOTION')) {
    const secondOpinion = session.opinions[1];
    entries.push({
      id: 'my-followup',
      speaker: 'PARTICIPANT',
      text: secondOpinion
        ? withStanceLabel(secondOpinion.originalText, secondOpinion.stance)
        : '(답하지 않고 넘어갔습니다)',
      kind: 'mine',
      timeLabel: formatElapsed(startedAt, secondOpinion?.createdAt),
    });

    if (session.mode === 'live' && session.opinions.length >= 2) {
      for (const result of liveRoundResults('FOLLOWUP', session, roundLog)) {
        entries.push({
          id: `followup-${result.roleId}`,
          speaker: result.roleId,
          text: result.text,
          kind: result.kind,
          timeLabel: formatElapsed(startedAt, result.createdAt),
        });
      }
    }

    entries.push({
      id: 'chair-motion',
      speaker: 'CEO',
      // 무대 의장 말풍선과 같은 문장(PR #20 Codex 3차 검토 P2).
      text: chairMotionLine(
        scenario,
        collectConfirmedConditionIds(session.opinions),
        collectParticipantStance(session.opinions),
      ),
      kind: 'speech',
      timeLabel: TIME_UNKNOWN,
    });
  }

  return entries;
}
