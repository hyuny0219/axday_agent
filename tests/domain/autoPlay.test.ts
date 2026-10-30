// 부스 자동 진행(T143): 계획·추가 답변 고르기, 그리고 두 안건 × 찬반 결과표 고정.
import { describe, expect, it } from 'vitest';
import { scenarios } from '../../src/content/scenarios';
import {
  autoConfirmedConditionIds,
  autoPhrasePicks,
  autoPlan,
  assistantExplainPlan,
  autoProgress,
  motionAutoPlan,
  pickAutoFollowUp,
  typedCaption,
  AUTO_READ_MS,
  AUTO_TYPE_MS,
  AUTO_LEAD_MS,
  type AutoSide,
} from '../../src/domain/autoPlay';
import { freezeMotion } from '../../src/domain/motion';
import { createInitialSession, reduce } from '../../src/domain/session';
import { decideBoard, participantTargetVote, tally } from '../../src/domain/voting';

const sides: AutoSide[] = ['FOR', 'AGAINST'];

describe('autoPhrasePicks', () => {
  it('조건이 붙는 문구만, 그 입장 쪽에서만 담는다', () => {
    for (const sc of scenarios) {
      for (const side of sides) {
        const picks = autoPhrasePicks(sc, side);
        expect(picks.length).toBeGreaterThan(0);
        for (const p of picks) {
          expect(p.conditionId).not.toBeNull();
          expect(['BOTH', side]).toContain(p.side ?? 'FOR');
        }
      }
    }
  });
});

describe('pickAutoFollowUp', () => {
  it('넘어가기·반대편 답변은 고르지 않고, 함정 조건(FULL_AUTO)은 고르지 않는다', () => {
    for (const sc of scenarios) {
      for (const side of sides) {
        const pick = pickAutoFollowUp(sc, side);
        expect(pick).not.toBeNull();
        expect(pick?.keepPrevious).toBeFalsy();
        expect((pick?.side ?? 'FOR') === 'BOTH' || (pick?.side ?? 'FOR') === side).toBe(true);
        expect(pick?.proposeConditionId).not.toBe('FULL_AUTO');
      }
    }
  });
  it('같은 입력이면 같은 답변이다(결정적)', () => {
    for (const sc of scenarios) expect(pickAutoFollowUp(sc, 'FOR')).toBe(pickAutoFollowUp(sc, 'FOR'));
  });
});

describe('autoPlan', () => {
  it('스테이지별 동작이 있고 입장이 필요한 단계는 입장이 없으면 비어 있다', () => {
    for (const sc of scenarios) {
      expect(autoPlan('BRIEFING', sc)).toHaveLength(sc.evidence.length);
      expect(autoPlan('OPINIONS', sc)).toHaveLength(sc.initialOpinions.length);
      expect(autoPlan('DISCUSS', sc)).toEqual([]);
      expect(autoPlan('DISCUSS', sc, 'FOR').some((a) => a.kind === 'OPEN_ASSISTANT')).toBe(true);
      expect(autoPlan('REACTIONS', sc, 'AGAINST').map((a) => a.kind)).toEqual(['PICK_FOLLOWUP']);
      expect(autoPlan('MOTION', sc, 'FOR').length).toBeGreaterThan(0);
      for (const a of autoPlan('BRIEFING', sc)) expect(a.durationMs).toBeGreaterThanOrEqual(1000);
    }
  });
});

describe('비서실장 자동 진행(T147)', () => {
  it('DISCUSS는 팝업 열기만 자동이고 ①②·적용 동작은 목록에 없다', () => {
    for (const sc of scenarios) {
      const kinds = autoPlan('DISCUSS', sc, 'FOR').map((a) => a.kind);
      expect(kinds.filter((kind) => kind === 'OPEN_ASSISTANT')).toHaveLength(1);
      expect(kinds.every((kind) => kind === 'ADD_PHRASE' || kind === 'OPEN_ASSISTANT')).toBe(true);
    }
  });

  it('① 조건 추천 · ② 내 발언 정리 설명 자막은 동작 하나씩이고 한눈에 보기는 없다', () => {
    for (const feature of ['compare', 'refine'] as const) {
      const plan = assistantExplainPlan(feature);
      expect(plan).toHaveLength(1);
      expect(plan[0]).toMatchObject({ kind: 'EXPLAIN_ASSISTANT', targetId: feature });
      expect(plan[0]?.caption).not.toContain('한눈에');
    }
  });
});

describe('결과표 고정 — 자동 경로 + 자기 입장 표결이면 같은 표 3석 이상', () => {
  for (const sc of scenarios) {
    for (const side of sides) {
      it(`${sc.id} · ${side}`, () => {
        const pick = pickAutoFollowUp(sc, side);
        const ids = autoConfirmedConditionIds(sc, side, pick);
        // 실제 세션 reducer 경로로 한 번 더 확인한다.
        let s = createInitialSession(0, 'auto');
        s = reduce(s, { type: 'START' }, 1);
        s = { ...s, stage: 'REACTIONS', scenarioId: sc.id, followUpUsed: false };
        s = reduce(
          s,
          { type: 'SUBMIT_FOLLOWUP', originalText: '자동', selectedPhraseIds: [], confirmedConditionIds: ids, stance: side },
          2,
        );
        s = reduce(s, { type: 'FREEZE_MOTION', scenario: sc, confirmedConditionIds: ids }, 3);
        const motion = freezeMotion(sc, ids, 3);
        const target = participantTargetVote(side);
        const ballots = [
          ...decideBoard(sc, motion, side, true),
          { memberId: 'PARTICIPANT' as const, motionId: motion.id, motionHash: motion.hash, source: 'scripted' as const, vote: target, confirmedAt: 0 },
        ];
        const counts = tally(ballots).counts;
        expect(counts[target]).toBeGreaterThanOrEqual(3);
        expect(s.followUpAnswered).toBe(true);
      });
    }
  }
});

describe('autoProgress', () => {
  const plan = autoPlan('BRIEFING', scenarios[0]!);
  it('시작 전·동작 중·끝남을 시계 값으로 정한다', () => {
    expect(autoProgress(plan, 0).index).toBe(-1);
    expect(autoProgress(plan, AUTO_LEAD_MS).index).toBe(0);
    expect(autoProgress(plan, AUTO_LEAD_MS + plan[0]!.durationMs + 10)).toMatchObject({ index: 1, actionElapsedMs: 10, done: false });
    const total = AUTO_LEAD_MS + plan.reduce((sum, a) => sum + a.durationMs, 0);
    expect(autoProgress(plan, total).done).toBe(true);
  });
  it('동작이 없으면 처음부터 참가자 차례', () => {
    expect(autoProgress([], 0).done).toBe(true);
  });
  it('자막을 다 친 뒤 읽을 시간이 남는다', () => {
    for (const sc of scenarios) {
      for (const stage of ['BRIEFING', 'OPINIONS'] as const) {
        for (const a of autoPlan(stage, sc)) {
          expect(a.durationMs).toBeGreaterThanOrEqual(a.caption.length * AUTO_TYPE_MS + AUTO_READ_MS);
        }
      }
    }
  });
});

describe('typedCaption·motionAutoPlan', () => {
  it('자막은 시간에 따라 늘어난다', () => {
    expect(typedCaption('안녕하세요', 0)).toBe('안');
    expect(typedCaption('안녕하세요', 10000)).toBe('안녕하세요');
  });
  it('확정된 조건만 강조하고, 없으면 안내 한 줄', () => {
    const sc = scenarios[0]!;
    const id = sc.conditions[0]!.id;
    expect(motionAutoPlan(sc, [id]).map((a) => a.targetId)).toEqual([id]);
    expect(motionAutoPlan(sc, [])).toHaveLength(1);
  });
});

describe('자막은 완결된 문장(T148)', () => {
  it('OPINIONS 자막은 말풍선 구절과 다르고 임원 직함으로 시작하는 문장이다', () => {
    for (const sc of scenarios) {
      for (const [index, a] of autoPlan('OPINIONS', sc).entries()) {
        const opinion = sc.initialOpinions[index]!;
        expect(a.caption).not.toBe(opinion.bubble);
        expect(a.caption.startsWith(opinion.memberId)).toBe(true);
        expect(a.caption.endsWith('.')).toBe(true);
      }
    }
  });

  it('DISCUSS 문구 자막은 조건 라벨로 무엇을 하는지 먼저 말한다', () => {
    for (const sc of scenarios) {
      for (const side of sides) {
        for (const a of autoPlan('DISCUSS', sc, side)) {
          if (a.kind !== 'ADD_PHRASE') continue;
          const phrase = sc.phrases.find((item) => item.id === a.targetId)!;
          const label = sc.conditions.find((item) => item.id === phrase.conditionId)!.label;
          expect(a.caption.startsWith(`'${label}' 조건이 붙는 문구를 담습니다: `)).toBe(true);
        }
      }
    }
  });

  it('비서실장·답변·MOTION 자막은 모두 마침표로 끝난다', () => {
    for (const sc of scenarios) {
      for (const side of sides) {
        const captions = [
          ...autoPlan('DISCUSS', sc, side),
          ...autoPlan('REACTIONS', sc, side),
          ...autoPlan('MOTION', sc, side),
          ...assistantExplainPlan('compare'),
          ...assistantExplainPlan('refine'),
          ...motionAutoPlan(sc, []),
        ].map((a) => a.caption);
        for (const caption of captions) expect(caption.endsWith('.')).toBe(true);
      }
    }
  });
});
