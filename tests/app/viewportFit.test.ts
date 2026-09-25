// 화면 맞춤 축소 배율 계산(T51). 실측 사례(맥 availHeight 863px → Edge 창 모드
// 1272×698)와 검수 해상도(1920×1080·1280×720), 200% 확대(960×540) 경계를 함께 본다.

import { describe, expect, it } from 'vitest';
import { computeViewportFit } from '../../src/app/viewportFit';

describe('computeViewportFit', () => {
  it('설계 크기(1200×700)보다 크거나 같은 뷰포트는 natural이고 배율은 1이다', () => {
    expect(computeViewportFit(1920, 1080)).toEqual({ mode: 'natural', scale: 1 });
    expect(computeViewportFit(1280, 720)).toEqual({ mode: 'natural', scale: 1 });
    expect(computeViewportFit(1200, 700)).toEqual({ mode: 'natural', scale: 1 });
  });

  it('1을 넘겨 확대하지 않는다', () => {
    expect(computeViewportFit(3840, 2160).scale).toBe(1);
  });

  it('실측 사례(1272×698)는 scale 모드이고 배율이 1보다 살짝 작다', () => {
    const fit = computeViewportFit(1272, 698);
    expect(fit.mode).toBe('scale');
    expect(fit.scale).toBeLessThan(1);
    expect(fit.scale).toBeGreaterThanOrEqual(0.85);
  });

  it('scale은 너비·높이 중 더 작은 쪽 비율을 따른다', () => {
    // 너비가 더 좁다: 1080/1200=0.9, 700/700=1 → 0.9
    expect(computeViewportFit(1080, 700).scale).toBeCloseTo(0.9, 5);
    // 높이가 더 짧다: 1200/1200=1, 630/700=0.9 → 0.9
    expect(computeViewportFit(1200, 630).scale).toBeCloseTo(0.9, 5);
  });

  it('scale이 0.85 미만이면 reflow로 떨어진다(200% 확대 960×540 포함)', () => {
    expect(computeViewportFit(960, 540)).toEqual({ mode: 'reflow', scale: 1 });
    // 경계: 정확히 0.85 배율은 scale 모드를 유지한다.
    expect(computeViewportFit(1020, 595).mode).toBe('scale');
    // 살짝 아래: reflow.
    expect(computeViewportFit(1019, 594).mode).toBe('reflow');
  });
});
