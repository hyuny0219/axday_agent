// assistantLog.ts: encode/decode 왕복, describeAdditionalHelp의 mode·applied 구분,
// '발언 정리'를 써 봤는지 판정(T31·T97, T149에서 조건 추천 기록을 없앴다).

import { describe, expect, it } from 'vitest';
import {
  assistantFeaturesUsed,
  decodeAssistantLogEntry,
  describeAdditionalHelp,
  encodeAssistantLogEntry,
  hasAdditionalHelp,
} from '../../src/domain/assistantLog';

const refine = (extra: { applied?: boolean; failed?: boolean; mode?: 'live' | 'scripted' } = {}) =>
  encodeAssistantLogEntry(
    { type: 'DRAFT_REFINE', mode: extra.mode ?? 'scripted', evidenceIds: [], applied: extra.applied, failed: extra.failed },
    0,
  );

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
    expect(decodeAssistantLogEntry(refine())?.applied).toBe(false);
  });

  it('JSON이 아닌 평문 레이블과 없어진 조건 추천 기록은 null을 돌려준다', () => {
    expect(decodeAssistantLogEntry('SUMMARY_SHOWN')).toBeNull();
    expect(decodeAssistantLogEntry('')).toBeNull();
    for (const type of ['CONDITION_COMPARE', 'CONDITION_RECOMMEND_VIEW', 'CONDITION_RECOMMEND_APPLY', 'UNKNOWN']) {
      expect(decodeAssistantLogEntry(JSON.stringify({ type, mode: 'live', evidenceIds: [] }))).toBeNull();
    }
    expect(
      decodeAssistantLogEntry(JSON.stringify({ type: 'DRAFT_REFINE', mode: 'weird', evidenceIds: [] })),
    ).toBeNull();
  });

  it('failed 필드는 왕복해도 유지되고, 없으면 붙지 않는다', () => {
    expect(decodeAssistantLogEntry(refine({ failed: true }))?.failed).toBe(true);
    expect(decodeAssistantLogEntry(refine())).not.toHaveProperty('failed');
  });
});

describe('describeAdditionalHelp', () => {
  it('발언 정리는 applied:true일 때만 한 줄을 만들고 scripted는 "실제 AI"를 언급하지 않는다', () => {
    expect(describeAdditionalHelp([refine()])).toEqual([]);
    const lines = describeAdditionalHelp([refine({ applied: true })]);
    expect(lines).toEqual(['내 발언 정리를 내 발언에 적용했습니다.']);
    expect(lines.join(' ')).not.toContain('실제 AI');
  });

  it('live 결과는 실제 호출임을 덧붙인다', () => {
    expect(describeAdditionalHelp([refine({ applied: true, mode: 'live' })])).toEqual([
      '내 발언 정리를 내 발언에 적용했습니다. (실제 AI 호출)',
    ]);
  });

  it('같은 유형이 여러 번 있어도 한 줄만 보여준다(미적용 뒤 적용하면 적용 줄)', () => {
    expect(describeAdditionalHelp([refine(), refine({ applied: true }), refine()])).toHaveLength(1);
  });

  it('실패 기록은 줄을 만들지 않고, 실패 뒤 성공 적용은 줄이 나온다', () => {
    expect(describeAdditionalHelp([refine({ failed: true })])).toEqual([]);
    expect(describeAdditionalHelp([refine({ failed: true }), refine({ applied: true })])).toHaveLength(1);
    expect(describeAdditionalHelp([refine({ applied: true }), refine({ failed: true })])).toHaveLength(1);
  });

  it('평문·옛 조건 추천 기록은 도움 목록에 나타나지 않는다', () => {
    const old = JSON.stringify({ type: 'CONDITION_RECOMMEND_VIEW', mode: 'scripted', evidenceIds: ['LOG'] });
    expect(describeAdditionalHelp(['SUMMARY_SHOWN', old])).toEqual([]);
    expect(hasAdditionalHelp(['SUMMARY_SHOWN', old])).toBe(false);
    expect(hasAdditionalHelp([refine({ applied: true })])).toBe(true);
  });
});

describe('assistantFeaturesUsed (T149)', () => {
  it('빈 배열이면 발언 정리를 쓰지 않은 것이다', () => {
    expect(assistantFeaturesUsed([], 'DISCUSS').size).toBe(0);
  });

  it('정리한 초안을 본 기록(applied:false)도, 실패·연결 지연 기록(failed)도 사용으로 센다', () => {
    expect([...assistantFeaturesUsed([refine()], 'DISCUSS')]).toEqual(['refine']);
    expect([...assistantFeaturesUsed([refine({ failed: true })], 'DISCUSS')]).toEqual(['refine']);
  });

  it('평문 레이블과 옛 조건 추천 기록은 쓴 것으로 세지 않는다', () => {
    const old = JSON.stringify({ type: 'CONDITION_RECOMMEND_VIEW', mode: 'scripted', evidenceIds: [] });
    expect(assistantFeaturesUsed(['SUMMARY_SHOWN', old], 'DISCUSS').size).toBe(0);
  });
});
