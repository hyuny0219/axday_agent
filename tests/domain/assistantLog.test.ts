// assistantLog.ts: encode/decode 왕복, describeAdditionalHelp의 mode·applied 구분
// (T31, T12 nit "evidenceIds·mode 기록이 아직 세션에 연결되지 않음" 해소).

import { describe, expect, it } from 'vitest';
import {
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
    const label = encodeAssistantLogEntry({ type: 'OPINION_SUMMARY', mode: 'scripted', evidenceIds: [] }, 0);
    expect(decodeAssistantLogEntry(label)?.applied).toBe(false);
  });

  it('JSON이 아닌 평문 레이블(과거 세션의 SUMMARY_SHOWN 등)은 null을 돌려준다', () => {
    expect(decodeAssistantLogEntry('SUMMARY_SHOWN')).toBeNull();
    expect(decodeAssistantLogEntry('')).toBeNull();
  });

  it('type·mode가 알려지지 않은 값이면 null을 돌려준다', () => {
    expect(decodeAssistantLogEntry(JSON.stringify({ type: 'UNKNOWN', mode: 'live', evidenceIds: [] }))).toBeNull();
    expect(
      decodeAssistantLogEntry(JSON.stringify({ type: 'OPINION_SUMMARY', mode: 'weird', evidenceIds: [] })),
    ).toBeNull();
  });
});

describe('describeAdditionalHelp', () => {
  it('scripted 결과는 "실제 AI 사용"을 언급하지 않는다', () => {
    const labels = [encodeAssistantLogEntry({ type: 'OPINION_SUMMARY', mode: 'scripted', evidenceIds: [] }, 0)];
    const lines = describeAdditionalHelp(labels);
    expect(lines).toEqual(['의견 한눈에 보기를 확인했습니다.']);
    expect(lines.join(' ')).not.toContain('실제 AI');
  });

  it('live 결과는 실제 호출임을 덧붙인다', () => {
    const labels = [encodeAssistantLogEntry({ type: 'CONDITION_COMPARE', mode: 'live', evidenceIds: ['E1'] }, 0)];
    expect(describeAdditionalHelp(labels)).toEqual(['조건 비교하기를 확인했습니다. (실제 AI 호출)']);
  });

  it('DRAFT_REFINE은 applied:true일 때만 한 줄을 만든다(미적용 요청은 조용히 무시)', () => {
    const requestedOnly = [
      encodeAssistantLogEntry({ type: 'DRAFT_REFINE', mode: 'live', evidenceIds: [], applied: false }, 0),
    ];
    expect(describeAdditionalHelp(requestedOnly)).toEqual([]);
    expect(hasAdditionalHelp(requestedOnly)).toBe(false);

    const applied = [
      encodeAssistantLogEntry({ type: 'DRAFT_REFINE', mode: 'live', evidenceIds: [], applied: false }, 0),
      encodeAssistantLogEntry({ type: 'DRAFT_REFINE', mode: 'live', evidenceIds: [], applied: true }, 100),
    ];
    expect(describeAdditionalHelp(applied)).toEqual(['내 발언 정리를 내 발언에 적용했습니다. (실제 AI 호출)']);
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
