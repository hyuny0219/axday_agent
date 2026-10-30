// T126 보기 모드(App 수준): 지금 화면의 쓰던 글·고른 문구·조건 칩이 '◀ 이전'을 갔다 와도 남고,
// 지난 화면에서도 근거 자료 팝업은 열 수 있다.
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from '../../src/app/App';

beforeEach(() => {
  window.history.pushState({}, '', '/?mode=scripted&coach=off&auto=off');
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
});

afterEach(() => {
  cleanup();
});

async function toDiscuss() {
  render(<App />);
  const start = await screen.findByRole('button', { name: /체험 시작/ });
  await waitFor(() => expect(start).toBeEnabled());
  fireEvent.click(start);
  fireEvent.click(await screen.findByRole('button', { name: /^확인/ }));
  fireEvent.click(await screen.findByTestId('scenario-card-ai-approval'));
  fireEvent.click(await screen.findByTestId('open-evidence'));
  fireEvent.keyDown(document, { key: 'Escape' });
  fireEvent.click(await screen.findByRole('button', { name: /의견 듣기/ }));
  const toWrite = await screen.findByRole('button', { name: /내 의견 쓰러 가기/ });
  await waitFor(() => expect(toWrite).toBeEnabled(), { timeout: 8000 });
  fireEvent.click(toWrite);
  await screen.findByTestId('discuss-side-for');
}

describe('지난 화면 보기', () => {
  it('쓰던 글·고른 추천 문구·조건 칩은 이전을 눌렀다 돌아와도 그대로 남는다', async () => {
    await toDiscuss();
    fireEvent.click(screen.getByTestId('discuss-side-for'));
    fireEvent.click(screen.getByTestId('phrase-card-P1'));
    const textarea = screen.getByTestId('draft-editor-textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: `${textarea.value} 직접 덧붙인 문장입니다.` } });
    const written = textarea.value;
    expect(written).toContain('직접 덧붙인 문장입니다.');
    const chipBefore = screen.getAllByTestId(/^condition-chip-/).length;
    expect(chipBefore).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId('view-prev'));
    expect(screen.getByTestId('view-banner')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('view-exit'));

    expect(screen.queryByTestId('view-banner')).toBeNull();
    const again = screen.getByTestId('draft-editor-textarea') as HTMLTextAreaElement;
    expect(again.value).toBe(written);
    expect(screen.getByTestId('discuss-side-for')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByTestId(/^condition-chip-/)).toHaveLength(chipBefore);
  });

  it('지난 화면(브리핑)에서도 근거 자료 팝업을 열고 닫을 수 있고, 다른 입력은 막혀 있다', async () => {
    await toDiscuss();
    fireEvent.click(screen.getByTestId('view-prev')); // OPINIONS
    fireEvent.click(screen.getByTestId('view-prev')); // BRIEFING
    const past = document.querySelector('[data-past-screen]') as HTMLElement;
    const open = within(past).getByTestId('open-evidence');
    expect(open.closest('[inert]')).toBeNull();
    // 같은 화면의 나머지(다음 단계 버튼)는 막혀 있다.
    const next = within(past).getByRole('button', { name: /의견 듣기/ });
    expect(next.closest('[inert]')).not.toBeNull();

    fireEvent.click(open);
    expect(await screen.findByTestId('evidence-dialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('evidence-dialog')).toBeNull());
  });

  it('완료한 세션에서 앞 화면으로 갔다가 다음으로 넘어가면 다시 답하기 화면에 제출했던 답변이 보인다', async () => {
    await toDiscuss();
    fireEvent.click(screen.getByTestId('discuss-side-for'));
    fireEvent.click(screen.getByTestId('phrase-card-P1'));
    fireEvent.click(screen.getByTestId('assistant-toggle'));
    await waitFor(() => expect(screen.getByTestId('submit-opinion')).toBeEnabled(), { timeout: 8000 });
    fireEvent.click(screen.getByTestId('submit-opinion'));
    fireEvent.click(await screen.findByTestId('reactions-advance'));
    const answer = '진행 상황을 계속 공유해 주세요.';
    fireEvent.change(await screen.findByTestId('followup-textarea'), { target: { value: answer } });
    fireEvent.click(screen.getByTestId('submit-followup'));
    await screen.findByTestId('motion-card');

    fireEvent.click(screen.getByTestId('view-prev')); // 다시 답하기
    fireEvent.click(screen.getByTestId('view-prev')); // 반응 듣기
    fireEvent.click(screen.getByTestId('view-prev')); // DISCUSS
    fireEvent.click(screen.getByTestId('view-next')); // 반응 듣기
    fireEvent.click(screen.getByTestId('view-next')); // 다시 답하기
    expect((screen.getByTestId('followup-textarea') as HTMLTextAreaElement).value).toBe(answer);
  });
});
