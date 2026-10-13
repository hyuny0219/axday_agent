// T115: 설득 현황판의 임원별 비고("움직일 조건"·"설득 완료"·"답변 뒤 찬성/반대")가 임원의 실제
// 입장과 참가자 목표 방향에 맞는지 전수 확인한다(scripted, 안건 2개 × 입장 2 × 확정 조건 부분집합 × 답변 전·후).
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PersuasionBoard } from '../../src/components/parts/PersuasionBoard';
import { openingStanceOf } from '../../src/components/openingStance';
import { aiApprovalScenario, experienceFirstScenario } from '../../src/content/scenarios';
import type { Scenario } from '../../src/content/types';
import { membersAwaitingAnswer, scriptedStances } from '../../src/domain/stance';
import type { Opinion } from '../../src/domain/types';
import { EXEC_MEMBER_ORDER, decideMember } from '../../src/domain/voting';

afterEach(() => cleanup());

function subsets<T>(items: readonly T[]): T[][] {
  const result: T[][] = [[]];
  for (const item of items) for (const existing of [...result]) result.push([...existing, item]);
  return result;
}

const scenarios: Scenario[] = [aiApprovalScenario, experienceFirstScenario];
const sawKeepAgainst = { value: false };

describe('T115 설득 현황판 비고 방향(scripted 전수)', () => {
  for (const scenario of scenarios) {
    for (const side of ['FOR', 'AGAINST'] as const) {
      for (const answered of [true, false]) {
        it(`${scenario.id} · ${side} · 답변 ${answered ? '뒤' : '전'}`, () => {
          const target = side === 'AGAINST' ? 'NO' : 'YES';
          const targetStance = side === 'AGAINST' ? 'AGAINST' : 'FOR';
          for (const confirmed of subsets(scenario.conditions.map((c) => c.id))) {
            const session = {
              stage: 'REACTIONS' as const,
              opinions: [{ id: 'op-1', originalText: '', selectedPhraseIds: [], confirmedConditionIds: confirmed, stance: side, createdAt: 0 } satisfies Opinion],
              followUpUsed: false,
              followUpAnswered: answered,
            };
            const stances = scriptedStances(scenario, session);
            const awaiting = answered ? [] : membersAwaitingAnswer(scenario, session);
            const where = `${scenario.id}/${side}/answered=${answered}/[${confirmed.join(',')}]`;
            render(
              <PersuasionBoard
                scenario={scenario}
                confirmedConditionIds={confirmed}
                participantStance={side}
                stances={stances}
                mode="scripted"
                awaitingAnswerIds={awaiting}
              />,
            );
            fireEvent.click(screen.getByTestId('persuasion-board-toggle'));
            for (const m of EXEC_MEMBER_ORDER) {
              const note = screen.getByTestId(`persuasion-board-note-${m}`).textContent ?? '';
              const opening = openingStanceOf(scenario, m);
              const voteWith = (ids: string[]) =>
                decideMember(scenario.voteRules[m], { conditionIds: ids, executionMode: 'DEFAULT', participantStance: side });
              const ctx = `${where} ${m} stance=${stances[m]} note="${note}"`;
              if (opening === targetStance && stances[m] === targetStance) {
                expect(note, ctx).toBe('처음부터 같은 편');
                continue;
              }
              if (awaiting.includes(m)) {
                expect(note, ctx).toBe(side === 'FOR' ? '조건은 충분 · 답변 뒤 찬성' : '조건은 충분 · 답변 뒤 반대');
                continue;
              }
              if (note.startsWith('움직일 조건 · ')) {
                // 움직일 조건은 찬성 목표에서만, 아직 목표 쪽이 아닌 임원에게만 나오고 적용하면 목표 표가 된다.
                expect(side, ctx).toBe('FOR');
                expect(stances[m], ctx).not.toBe(targetStance);
                const labels = note.replace('움직일 조건 · ', '');
                const ids = scenario.conditions.filter((c) => labels.includes(c.label)).map((c) => c.id);
                expect(voteWith([...confirmed, ...ids]), ctx).toBe(target);
              }
              if (note === '설득 완료') {
                expect(side, ctx).toBe('FOR');
                expect(stances[m], ctx).toBe('FOR');
              }
              if (note === '이미 찬성 쪽입니다') {
                expect(side, ctx).toBe('AGAINST');
                expect(stances[m], ctx).toBe('FOR');
              }
              if (note.includes('반대로 남습니다') || note.includes('반대를 유지')) {
                expect(side, ctx).toBe('AGAINST');
                expect(stances[m], ctx).toBe('AGAINST');
              }
              if (note.includes('반대로 남습니다')) {
                expect(note, ctx).toMatch(/조건을 넣지 않아야 반대로 남습니다$/);
                sawKeepAgainst.value = true;
              }
              // 찬성 목표에서 반대 방향 안내가, 반대 목표에서 찬성 방향 안내가 나오면 안 된다.
              if (side === 'FOR') expect(note, ctx).not.toMatch(/반대로 남|반대를 유지|이미 찬성/);
              if (side === 'AGAINST') expect(note, ctx).not.toMatch(/움직일 조건|설득 완료/);
            }
            cleanup();
          }
        });
      }
    }
  }
});

describe('T115 반대 목표 문구', () => {
  it('"조건을 넣지 않아야 반대로 남습니다" 문구가 실제로 나온다', () => {
    expect(sawKeepAgainst.value).toBe(true);
  });
});

describe('T115 live 현황판 비고 — 빈 조건·방향 확인', () => {
  const live = { CEO: 'FOR', CFO: 'AGAINST', CAIO: 'AGAINST', CISO: 'AGAINST' } as const;
  it('live 찬성 목표에서 규칙표상 이미 YES(조건 충족)인데 발언 입장이 반대여도 빈 "움직일 조건"을 적지 않는다', () => {
    render(
      <PersuasionBoard
        scenario={aiApprovalScenario}
        confirmedConditionIds={['LOG']}
        participantStance="FOR"
        stances={{ ...live }}
        mode="live"
        statements={[]}
      />,
    );
    fireEvent.click(screen.getByTestId('persuasion-board-toggle'));
    const note = screen.getByTestId('persuasion-board-note-CAIO').textContent ?? '';
    expect(note).toBe('조건으로는 설득이 어렵습니다');
  });
  it('live 찬성 목표에서 임원이 앞서 제안했어도 참가자가 이미 확정한 조건은 "움직일 조건"에 다시 나오지 않는다', () => {
    render(
      <PersuasionBoard
        scenario={aiApprovalScenario}
        confirmedConditionIds={['LOG']}
        participantStance="FOR"
        stances={{ ...live }}
        mode="live"
        liveSuggestedConditionIds={{ CAIO: ['LOG'], CISO: ['LOG', 'OWNER'] }}
      />,
    );
    fireEvent.click(screen.getByTestId('persuasion-board-toggle'));
    expect(screen.getByTestId('persuasion-board-note-CISO').textContent).not.toContain('승인 사유');
    expect(screen.getByTestId('persuasion-board-note-CISO').textContent).toContain('움직일 조건');
  });
  it('live 반대 목표에서 규칙표상 이미 YES인 임원이 반대여도 빈 따옴표 조건을 적지 않는다', () => {
    render(
      <PersuasionBoard
        scenario={aiApprovalScenario}
        confirmedConditionIds={['LOG']}
        participantStance="AGAINST"
        stances={{ ...live }}
        mode="live"
        statements={[]}
      />,
    );
    fireEvent.click(screen.getByTestId('persuasion-board-toggle'));
    const note = screen.getByTestId('persuasion-board-note-CAIO').textContent ?? '';
    expect(note).toBe('조건과 무관하게 반대를 유지합니다');
  });
});

describe('T115 live 현황판 전수(발언 입장 × 제안 조건 × 확정 조건)', () => {
  const kinds = ['FOR', 'AGAINST', 'UNDECIDED'] as const;
  for (const scenario of scenarios) {
    for (const side of ['FOR', 'AGAINST'] as const) {
      it(`${scenario.id} · ${side}: 확정 조건 재제안·빈 조건 이름·방향 어긋남이 없다`, () => {
        const ids = scenario.conditions.map((c) => c.id);
        const confirmedSets = [[], ids, ids.slice(0, 1), ids.slice(-1)];
        const labelOf = (id: string) => scenario.conditions.find((c) => c.id === id)!.label;
        for (const confirmed of confirmedSets) {
          for (const hints of [undefined, confirmed, ids]) {
            for (const a of kinds) for (const b of kinds) for (const c of kinds) for (const d of kinds) {
              const stances = { CEO: a, CFO: b, CAIO: c, CISO: d };
              const suggested = hints ? { CEO: hints, CFO: hints, CAIO: hints, CISO: hints } : undefined;
              render(
                <PersuasionBoard
                  scenario={scenario}
                  confirmedConditionIds={confirmed}
                  participantStance={side}
                  stances={stances}
                  mode="live"
                  liveSuggestedConditionIds={suggested}
                  statements={[]}
                />,
              );
              fireEvent.click(screen.getByTestId('persuasion-board-toggle'));
              for (const m of EXEC_MEMBER_ORDER) {
                const note = screen.getByTestId(`persuasion-board-note-${m}`).textContent ?? '';
                const ctx = `${scenario.id}/${side}/[${confirmed}]/${a}${b}${c}${d}/${m}: ${note}`;
                expect(note, ctx).not.toMatch(/·\s*$|''|undefined/);
                if (note.startsWith('움직일 조건')) {
                  expect(side, ctx).toBe('FOR');
                  expect(stances[m], ctx).not.toBe('FOR');
                  for (const id of confirmed) expect(note.replace('움직일 조건 · ', ''), ctx).not.toContain(labelOf(id));
                }
                if (side === 'FOR') expect(note, ctx).not.toMatch(/반대로 남|반대를 유지|이미 찬성/);
                if (side === 'AGAINST') expect(note, ctx).not.toMatch(/움직일 조건|설득 완료/);
              }
              cleanup();
            }
          }
        }
      });
    }
  }
});
