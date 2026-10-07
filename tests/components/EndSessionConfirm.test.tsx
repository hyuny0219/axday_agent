// PR #20 Codex 15차 검토 P2: 확인 UI를 취소하면 포커스가 문서 본문으로 떨어지지 않고 열었던
// 버튼("처음 화면으로")으로 돌아가야 한다.
import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EndSessionConfirm } from '../../src/components/parts/EndSessionConfirm';

afterEach(cleanup);

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" data-testid="opener" onClick={() => setOpen(true)}>
        처음 화면으로
      </button>
      {open && <EndSessionConfirm onConfirm={() => setOpen(false)} onCancel={() => setOpen(false)} />}
    </div>
  );
}

describe('EndSessionConfirm', () => {
  it('열리면 안전한 선택에 포커스를 두고, 취소하면 열었던 버튼으로 포커스를 되돌린다', () => {
    render(<Harness />);
    const opener = screen.getByTestId('opener');
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByTestId('end-session-confirm-cancel')).toHaveFocus();

    fireEvent.click(screen.getByTestId('end-session-confirm-cancel'));
    expect(screen.queryByTestId('end-session-confirm')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('Esc로 취소해도 포커스가 돌아온다', () => {
    render(<Harness />);
    const opener = screen.getByTestId('opener');
    opener.focus();
    fireEvent.click(opener);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('end-session-confirm')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
