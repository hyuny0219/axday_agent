// EvidenceDialog(T68): 열기 직전 포커스 요소로 복귀, 닫기 버튼·딤 클릭·Esc 세 경로
// 모두 onClose를 부르는지, Tab이 팝업 밖으로 포커스를 빼돌리지 않는지 확인한다.
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EvidenceDialog } from '../../src/components/parts/EvidenceDialog';
import { anonBoardScenario } from '../../src/content/scenarios';

afterEach(() => {
  cleanup();
});

const evidence = anonBoardScenario.evidence;

describe('EvidenceDialog', () => {
  it('열리면 닫기 버튼에 포커스가 가고, 닫히면 열기 전 포커스 요소로 되돌아간다', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    expect(trigger).toHaveFocus();

    const { unmount } = render(<EvidenceDialog evidence={evidence} caseTag="사건 02" statements={[]} onClose={vi.fn()} />);
    expect(screen.getByTestId('evidence-dialog-close')).toHaveFocus();

    unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it('닫기 버튼 클릭이 onClose를 부른다', () => {
    const onClose = vi.fn();
    render(<EvidenceDialog evidence={evidence} caseTag="사건 02" statements={[]} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('evidence-dialog-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('딤(배경) 클릭이 onClose를 부르지만, 팝업 안쪽 클릭은 부르지 않는다', () => {
    const onClose = vi.fn();
    render(<EvidenceDialog evidence={evidence} caseTag="사건 02" statements={[]} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('evidence-dialog'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('evidence-dialog-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Esc 키가 onClose를 부른다', () => {
    const onClose = vi.fn();
    render(<EvidenceDialog evidence={evidence} caseTag="사건 02" statements={[]} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('role="dialog" aria-modal="true" aria-labelledby로 제목을 가리킨다', () => {
    render(<EvidenceDialog evidence={evidence} caseTag="사건 02" statements={[]} onClose={vi.fn()} />);
    const dialog = screen.getByTestId('evidence-dialog');
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const titleId = dialog.getAttribute('aria-labelledby');
    expect(titleId).toBe('evidence-dialog-title');
    expect(document.getElementById(titleId!)).toHaveTextContent('근거 자료');
  });

  it('자료 카드 4장을 클릭 없이 자료명·해석·원문과 함께 보여준다', () => {
    render(<EvidenceDialog evidence={evidence} caseTag="사건 02" statements={[]} onClose={vi.fn()} />);
    for (const card of evidence) {
      expect(screen.getByTestId(`evidence-card-${card.id}`)).toBeInTheDocument();
    }
  });

  it('Tab을 눌러도 포커스가 팝업 밖(document.body)으로 빠져나가지 않는다', () => {
    const outsideButton = document.createElement('button');
    outsideButton.textContent = '바깥 버튼';
    document.body.appendChild(outsideButton);

    render(<EvidenceDialog evidence={evidence} caseTag="사건 02" statements={[]} onClose={vi.fn()} />);
    const closeButton = screen.getByTestId('evidence-dialog-close');
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(closeButton).toHaveFocus();
    expect(outsideButton).not.toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(closeButton).toHaveFocus();
    expect(outsideButton).not.toHaveFocus();

    outsideButton.remove();
  });

  it('열려 있는 동안 문서 스크롤을 잠그고 닫히면 원래 값으로 되돌린다(PR #11 Codex 29차)', () => {
    document.documentElement.style.overflow = 'auto';
    const { unmount } = render(<EvidenceDialog evidence={evidence} caseTag="사건 02" statements={[]} onClose={vi.fn()} />);
    expect(document.documentElement.style.overflow).toBe('hidden');
    unmount();
    expect(document.documentElement.style.overflow).toBe('auto');
    document.documentElement.style.overflow = '';
  });
});
