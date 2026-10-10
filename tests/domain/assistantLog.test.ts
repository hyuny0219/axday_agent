// assistantLog.ts: encode/decode 왕복, describeAdditionalHelp의 mode·applied 구분
// (T31, T12 nit "evidenceIds·mode 기록이 아직 세션에 연결되지 않음" 해소).

import { describe, expect, it } from 'vitest';
import {
  assistantFeaturesUsed,
  decodeAssistantLogEntry,
  describeAdditionalHelp,
  encodeAssistantLogEntry,
  hasAdditionalHelp,
} from '../../src/domain/assistantLog';

describe('encodeAssistantLogEntry / decodeAssistantLogEntry', () => {
  it('인코딩한 문자열을 그대로 되돌린다(왕복)', () => {
    const label = encodeAssistantLogEntry(
      { type: 'DRAFT_REFINE', mode: 'live', evidenceIds: ['E1', 'E2'], applied: true },
      1_700_000_000_000,
    );
    expect(decodeAssistantLogEntry(label)).toEqual({
      type: 'DRAFT_REFINE',
      mode: 'live',
      evidenceIds: ['E1', 'E2'],
      applied: true,
      requestedAt: 1_700_000_000_000,
    });
  });

  it('applied를 생략하면 false로 채운다', () => {
    const label = encodeAssistantLogEntry(
      { type: 'OPINION_SUMMARY', mode: 'scripted', evidenceIds: [] },
      0,
    );
    expect(decodeAssistantLogEntry(label)?.applied).toBe(false);
  });

  it('JSON이 아닌 평문 레이블(과거 세션의 SUMMARY_SHOWN 등)은 null을 돌려준다', () => {
    expect(decodeAssistantLogEntry('SUMMARY_SHOWN')).toBeNull();
    expect(decodeAssistantLogEntry('')).toBeNull();
  });

  it('type·mode가 알려지지 않은 값이면 null을 돌려준다', () => {
    expect(
      decodeAssistantLogEntry(JSON.stringify({ type: 'UNKNOWN', mode: 'live', evidenceIds: [] })),
    ).toBeNull();
    expect(
      decodeAssistantLogEntry(
        JSON.stringify({ type: 'OPINION_SUMMARY', mode: 'weird', evidenceIds: [] }),
      ),
    ).toBeNull();
  });
});

describe('describeAdditionalHelp', () => {
  it('scripted 결과는 "실제 AI 사용"을 언급하지 않는다', () => {
    const labels = [
      encodeAssistantLogEntry({ type: 'OPINION_SUMMARY', mode: 'scripted', evidenceIds: [] }, 0),
    ];
    const lines = describeAdditionalHelp(labels);
    expect(lines).toEqual(['의견 한눈에 보기를 확인했습니다.']);
    expect(lines.join(' ')).not.toContain('실제 AI');
  });

  it('live 결과는 실제 호출임을 덧붙인다', () => {
    const labels = [
      encodeAssistantLogEntry({ type: 'CONDITION_COMPARE', mode: 'live', evidenceIds: ['E1'] }, 0),
    ];
    expect(describeAdditionalHelp(labels)).toEqual([
      '조건 비교하기를 확인했습니다. (실제 AI 호출)',
    ]);
  });

  it('DRAFT_REFINE은 applied:true일 때만 한 줄을 만든다(미적용 요청은 조용히 무시)', () => {
    const requestedOnly = [
      encodeAssistantLogEntry(
        { type: 'DRAFT_REFINE', mode: 'live', evidenceIds: [], applied: false },
        0,
      ),
    ];
    expect(describeAdditionalHelp(requestedOnly)).toEqual([]);
    expect(hasAdditionalHelp(requestedOnly)).toBe(false);

    const applied = [
      encodeAssistantLogEntry(
        { type: 'DRAFT_REFINE', mode: 'live', evidenceIds: [], applied: false },
        0,
      ),
      encodeAssistantLogEntry(
        { type: 'DRAFT_REFINE', mode: 'live', evidenceIds: [], applied: true },
        100,
      ),
    ];
    expect(describeAdditionalHelp(applied)).toEqual([
      '내 발언 정리를 내 발언에 적용했습니다. (실제 AI 호출)',
    ]);
  });

  it('같은 유형이 여러 번 있어도 한 줄만 보여준다', () => {
    const labels = [
      encodeAssistantLogEntry({ type: 'OPINION_SUMMARY', mode: 'scripted', evidenceIds: [] }, 0),
      encodeAssistantLogEntry({ type: 'OPINION_SUMMARY', mode: 'scripted', evidenceIds: [] }, 10),
    ];
    expect(describeAdditionalHelp(labels)).toHaveLength(1);
  });

  it('과거 세션의 SUMMARY_SHOWN(평문)은 도움 목록에 나타나지 않는다', () => {
    expect(describeAdditionalHelp(['SUMMARY_SHOWN'])).toEqual([]);
    expect(hasAdditionalHelp(['SUMMARY_SHOWN'])).toBe(false);
  });
});

// T97: DISCUSS에서 비서실장 세 기능을 한 번씩 써 봤는지 판정한다.
describe('assistantFeaturesUsed (T97)', () => {
  const log = (
    type: Parameters<typeof encodeAssistantLogEntry>[0]['type'],
    extra: { applied?: boolean; failed?: boolean } = {},
  ) => encodeAssistantLogEntry({ type, mode: 'scripted', evidenceIds: [], ...extra }, 0);

  it('빈 배열이면 아무 기능도 쓰지 않은 것이다', () => {
    expect(assistantFeaturesUsed([], 'DISCUSS').size).toBe(0);
  });

  it('세 유형이 각각 summary·compare·refine으로 매겨진다', () => {
    const used = assistantFeaturesUsed(
      [log('OPINION_SUMMARY'), log('CONDITION_RECOMMEND_VIEW'), log('DRAFT_REFINE')],
      'DISCUSS',
    );
    expect([...used].sort()).toEqual(['compare', 'refine', 'summary']);
  });

  it('옛 CONDITION_COMPARE 기록도 compare로 센다', () => {
    expect([...assistantFeaturesUsed([log('CONDITION_COMPARE')], 'DISCUSS')]).toEqual(['compare']);
  });

  it('적용(applied)과 상관없이 정리한 초안을 본 기록(applied:false)도 refine으로 센다', () => {
    expect(
      assistantFeaturesUsed([log('DRAFT_REFINE', { applied: false })], 'DISCUSS').has('refine'),
    ).toBe(true);
  });

  it('실패·연결 지연 기록(failed:true)도 사용으로 센다', () => {
    const used = assistantFeaturesUsed(
      [
        log('OPINION_SUMMARY', { failed: true }),
        log('CONDITION_RECOMMEND_VIEW', { failed: true }),
        log('DRAFT_REFINE', { failed: true }),
      ],
      'DISCUSS',
    );
    expect(used.size).toBe(3);
  });

  it('추천 조건 적용 기록·평문 레이블은 어떤 기능으로도 세지 않는다', () => {
    const used = assistantFeaturesUsed(
      [log('CONDITION_RECOMMEND_APPLY'), 'SUMMARY_SHOWN'],
      'DISCUSS',
    );
    expect(used.size).toBe(0);
  });
});

describe('실패 기록(failed)은 결과 화면 "AI가 도운 일"에 나오지 않는다 (T97)', () => {
  it('failed:true 기록은 describeAdditionalHelp에서 줄을 만들지 않는다', () => {
    const labels = [
      encodeAssistantLogEntry(
        { type: 'OPINION_SUMMARY', mode: 'live', evidenceIds: [], failed: true },
        0,
      ),
      encodeAssistantLogEntry(
        { type: 'CONDITION_RECOMMEND_VIEW', mode: 'live', evidenceIds: [], failed: true },
        0,
      ),
      encodeAssistantLogEntry(
        { type: 'DRAFT_REFINE', mode: 'live', evidenceIds: [], failed: true },
        0,
      ),
    ];
    expect(describeAdditionalHelp(labels)).toEqual([]);
    expect(hasAdditionalHelp(labels)).toBe(false);
  });

  it('정리한 초안을 보기만 한 기록(applied:false)은 줄이 없고, 적용하면 한 줄이 생긴다', () => {
    const seen = encodeAssistantLogEntry(
      { type: 'DRAFT_REFINE', mode: 'scripted', evidenceIds: [] },
      0,
    );
    const applied = encodeAssistantLogEntry(
      { type: 'DRAFT_REFINE', mode: 'scripted', evidenceIds: [], applied: true },
      1,
    );
    expect(describeAdditionalHelp([seen])).toEqual([]);
    expect(describeAdditionalHelp([seen, applied])).toEqual([
      '내 발언 정리를 내 발언에 적용했습니다.',
    ]);
  });

  it('failed 필드는 왕복해도 유지되고, 없으면 붙지 않는다', () => {
    const failed = encodeAssistantLogEntry(
      { type: 'OPINION_SUMMARY', mode: 'live', evidenceIds: [], failed: true },
      0,
    );
    expect(decodeAssistantLogEntry(failed)?.failed).toBe(true);
    const ok = encodeAssistantLogEntry(
      { type: 'OPINION_SUMMARY', mode: 'live', evidenceIds: [] },
      0,
    );
    expect(decodeAssistantLogEntry(ok)).not.toHaveProperty('failed');
  });
});

describe('실패 뒤 재시도 성공 병합 (T97 검토)', () => {
  it('live 요약이 실패했다가 성공하면 확인 줄이 나온다', () => {
    const failed = encodeAssistantLogEntry(
      { type: 'OPINION_SUMMARY', mode: 'live', evidenceIds: [], failed: true },
      0,
    );
    const ok = encodeAssistantLogEntry(
      { type: 'OPINION_SUMMARY', mode: 'live', evidenceIds: ['E1'] },
      1,
    );
    expect(describeAdditionalHelp([failed, ok])).toEqual([
      '의견 한눈에 보기를 확인했습니다. (실제 AI 호출)',
    ]);
  });

  it('성공 뒤 실패가 와도 성공 줄이 유지된다', () => {
    const failed = encodeAssistantLogEntry(
      { type: 'OPINION_SUMMARY', mode: 'live', evidenceIds: [], failed: true },
      1,
    );
    const ok = encodeAssistantLogEntry(
      { type: 'OPINION_SUMMARY', mode: 'live', evidenceIds: ['E1'] },
      0,
    );
    expect(describeAdditionalHelp([ok, failed])).toEqual([
      '의견 한눈에 보기를 확인했습니다. (실제 AI 호출)',
    ]);
  });
});

describe('describeAdditionalHelp 최종안 교집합(Codex 33차 P2-3)', () => {
  it('추천 조건 기록이 2건이어도 최종안에 남은 조건만 "반영"으로 센다', () => {
    const labels = ['LIMIT', 'REVIEW'].map((id) =>
      encodeAssistantLogEntry({ type: 'CONDITION_RECOMMEND_APPLY', mode: 'scripted', evidenceIds: [id] }, 0),
    );
    expect(describeAdditionalHelp(labels)).toContain('추천 조건 2개 반영');
    expect(describeAdditionalHelp(labels, ['REVIEW', 'LOG'])).toEqual(['추천 조건 1개 반영']);
    expect(describeAdditionalHelp(labels, ['LOG'])).toEqual([]);
  });
});

describe('describeAdditionalHelp 조건 추천 한 줄(T101)', () => {
  const nameOf = (id: string) => ({ LIMIT: '결재 금액 한도', LOG: '승인 사유 기록', REVIEW: '사람 표본 재검토' })[id];
  const view = (ids: string[]) =>
    encodeAssistantLogEntry({ type: 'CONDITION_RECOMMEND_VIEW', mode: 'scripted', evidenceIds: ids }, 0);
  const apply = (id: string) =>
    encodeAssistantLogEntry({ type: 'CONDITION_RECOMMEND_APPLY', mode: 'scripted', evidenceIds: [id] }, 0);

  it('추천한 조건 이름과 최종안에 들어간 개수를 한 줄로 보여준다', () => {
    const labels = [view(['LIMIT', 'LOG']), apply('LIMIT'), apply('LOG')];
    expect(describeAdditionalHelp(labels, ['LIMIT', 'LOG'], nameOf)).toEqual([
      '조건 추천 1회 · 결재 금액 한도, 승인 사유 기록 → 2개 반영',
    ]);
  });

  it('최종안에서 빠진 조건은 반영으로 세지 않고, 반영이 없으면 화살표 없이 이름만 보인다', () => {
    const labels = [view(['LIMIT', 'LOG']), apply('LIMIT')];
    expect(describeAdditionalHelp(labels, ['LOG'], nameOf)).toEqual([
      '조건 추천 1회 · 결재 금액 한도, 승인 사유 기록',
    ]);
  });

  it('이름을 찾는 함수가 없으면 옛 형식("조건 추천 N회")을 지킨다', () => {
    expect(describeAdditionalHelp([view(['LIMIT'])])).toEqual(['조건 추천 1회']);
  });

  it('이름은 세 개까지만 보이고 나머지는 "외 N개"로 줄인다', () => {
    const many = (id: string) => id;
    expect(describeAdditionalHelp([view(['A', 'B', 'C', 'D', 'E'])], undefined, many)).toEqual([
      '조건 추천 1회 · A, B, C 외 2개',
    ]);
  });
});
