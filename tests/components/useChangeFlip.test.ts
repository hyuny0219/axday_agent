import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useChangeFlip } from '../../src/components/useChangeFlip';

describe('useChangeFlip', () => {
  it('처음에는 0, 값이 바뀔 때마다 1씩 오른다', () => {
    const { result, rerender } = renderHook(({ v }) => useChangeFlip(v), { initialProps: { v: '반대' } });
    expect(result.current).toBe(0);
    rerender({ v: '찬성' });
    expect(result.current).toBe(1);
    rerender({ v: '찬성' });
    expect(result.current).toBe(1);
  });

  it('지난 화면 보기(disabled) 중에는 뒤집지 않고, 돌아올 때 값이 달라져도 뒤집지 않는다(PR #21 Codex P3)', () => {
    const { result, rerender } = renderHook(({ v, d }) => useChangeFlip(v, d), {
      initialProps: { v: '찬성 쪽?', d: false },
    });
    rerender({ v: '반대', d: true }); // 지난 OPINIONS 화면을 보는 중
    expect(result.current).toBe(0);
    rerender({ v: '찬성 쪽?', d: false }); // 지금 화면으로 돌아옴
    expect(result.current).toBe(0);
    rerender({ v: '찬성', d: false }); // 그 뒤 실제 입장 변화는 뒤집는다
    expect(result.current).toBe(1);
  });
});
