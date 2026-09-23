// 튜닝 항목 (4) "존댓말 종결" 판정기(scripts/eval-set-run.ts findStyleViolations). PR #10 Codex
// 검토 세 라운드(2차: 인용 괄호·문장 경계, 6차: 해요체·합니까)가 모두 이 판정기를 겨냥했으므로
// 규칙을 코드로 고정한다. 기존 기록 재집계(v1 187 · v2 1 · v3 0)는 이 규칙으로 변하지 않는다.

import { describe, expect, it } from 'vitest';
import { findStyleViolations, type EvalRow } from '../../scripts/eval-set-run';

function row(message: string, reason?: string): EvalRow {
  return {
    caseId: 'c',
    pathId: 'conflict',
    pathLabel: '상충',
    variant: 't',
    stage: 'REACTIONS',
    roleId: 'CFO',
    status: 'answered',
    message,
    reason,
    latencyMs: 0,
    modelId: 'mock',
    promptVersion: 'test',
  };
}

function violations(message: string): string[] {
  return findStyleViolations([row(message)]).map((v) => v.sentence);
}

describe('findStyleViolations — 존댓말 종결', () => {
  it('합쇼체 종결은 통과한다', () => {
    expect(violations('담당자 지정이 필요합니다. 로그 보관 기간을 먼저 정하십시오.')).toEqual([]);
    expect(violations('처리 공수를 가늠할 수 있을까요?')).toEqual([]);
  });

  it('해요체·합니까 같은 정상 존댓말도 통과한다(Codex 6차 검토)', () => {
    expect(violations('이 조건이면 괜찮아요.')).toEqual([]);
    expect(violations('담당자가 필요합니까?')).toEqual([]);
    expect(violations('그건 별개 문제예요. 검수 인력이 관건이에요.')).toEqual([]);
    expect(violations('먼저 정해야죠.')).toEqual([]);
  });

  it('합쇼체 의문형은 통과하고, 반말 연결형 "-니까."는 위반이다(Codex 7차 검토)', () => {
    expect(violations('그렇습니까? 담당자가 있습니까?')).toEqual([]);
    expect(violations('추적 권한이 없으니까.')).toEqual(['추적 권한이 없으니까.']);
    expect(violations('먼저 정하니까.')).toEqual(['먼저 정하니까.']);
  });

  it('"-인데요/-은데요/-는데요" 같은 완성형 활용도 해요체로 통과한다(Codex 7차 검토)', () => {
    expect(violations('핵심은 추적 권한인데요.')).toEqual([]);
    expect(violations('검수 인력이 관건은 아닌데요.')).toEqual([]);
    expect(violations('지금은 담당자가 없는데요.')).toEqual([]);
  });

  it('반말체·명사형 종결은 위반이다 — "요"로 끝나는 명사도 해요체로 보지 않는다', () => {
    expect(violations('담당자 지정 필요.')).toEqual(['담당자 지정 필요.']);
    expect(violations('권한합의는 아님(E4).')).toEqual(['권한합의는 아님(E4).']);
    expect(violations('먼저 시작하자.')).toEqual(['먼저 시작하자.']);
  });

  it('말미 인용 괄호만 제거하고 설명성 괄호는 남긴다(Codex 2차 검토)', () => {
    expect(violations('권한 확인이 필요합니다(E3, E4 참조).')).toEqual([]);
    expect(violations('동의합니다(st-2-conflict-op-0,2,3).')).toEqual([]);
    expect(violations('검토합니다(권한 확인 필요).')).toEqual(['검토합니다(권한 확인 필요).']);
  });

  it('공백 없이 이어진 문장도 나누고, 소수점은 나누지 않는다(Codex 2차 검토)', () => {
    expect(violations('권한 확인 필요.검토하겠습니다.')).toEqual(['권한 확인 필요.']);
    expect(violations('절감률은 1.5% 수준으로 추정됩니다.')).toEqual([]);
  });

  it('message와 reason 두 필드를 모두 본다', () => {
    const found = findStyleViolations([row('검토합니다.', '조건 없음')]);
    expect(found).toHaveLength(1);
    expect(found[0]?.field).toBe('reason');
  });
});
