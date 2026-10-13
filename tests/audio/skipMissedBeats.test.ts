import { describe, expect, it } from 'vitest';
import { skipMissedBeats } from '../../src/audio/synth';

// PR #21 Codex P2: 탭이 가려졌다 돌아와도 밀린 BGM 박자를 한꺼번에 재생하지 않는다.
describe('skipMissedBeats', () => {
  const dt = 0.25;
  it('예약 시계가 현재보다 앞서 있으면 그대로 둔다', () => {
    expect(skipMissedBeats(10.1, 40, 10, dt)).toEqual({ next: 10.1, step: 40 });
    expect(skipMissedBeats(10, 40, 10, dt)).toEqual({ next: 10, step: 40 });
  });
  it('긴 멈춤 뒤에는 밀린 박자를 건너뛰어 다음 박자를 현재 이후로 옮긴다', () => {
    const r = skipMissedBeats(10, 40, 70, dt); // 60초 멈춤 = 240박자
    expect(r.step).toBe(280);
    expect(r.next).toBeCloseTo(70, 9);
    expect(r.next).toBeGreaterThanOrEqual(70 - 1e-9);
  });
  it('박자 사이에서 깨어나면 다음 박자로 올림한다', () => {
    const r = skipMissedBeats(10, 0, 10.6, dt);
    expect(r.step).toBe(3);
    expect(r.next).toBeCloseTo(10.75, 9);
  });
});
