// OperatorMenu.tsx: 모델 연결 확인(성공/실패 결과 렌더)·scripted로 새 체험(주입한 이동
// 함수 호출) T49. fetch는 vi.stubGlobal로 대체해 실제 네트워크를 쓰지 않는다.

import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OperatorMenu, scriptedRestartUrl } from '../../src/components/parts/OperatorMenu';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubFetch(
  responses: Record<string, { status: number; body: unknown }>,
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (url: string) => {
    const path = url.toString();
    const match = Object.entries(responses).find(([key]) => path.includes(key));
    if (!match) {
      throw new Error(`no stub for ${path}`);
    }
    const [, { status, body }] = match;
    return {
      ok: status < 300,
      status,
      json: async () => body,
    } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function openMenu(): Promise<void> {
  await userEvent.click(screen.getByTestId('operator-menu-button'));
}

describe('OperatorMenu 모델 연결 확인', () => {
  it('성공 결과를 연결됨 · modelId · latencyMs로 보여준다', async () => {
    stubFetch({
      '/api/ops/probe': { status: 200, body: { ok: true, provider: 'mock', modelId: 'mock-model', latencyMs: 12 } },
      '/api/health': { status: 200, body: { mode: 'live', provider: 'mock', modelId: 'mock-model', promptVersion: 'v1' } },
    });
    render(<OperatorMenu onNewSession={vi.fn()} />);

    await openMenu();
    await userEvent.click(screen.getByTestId('operator-probe'));

    await waitFor(() => expect(screen.getByTestId('operator-probe-ok')).toBeInTheDocument());
    expect(screen.getByTestId('operator-probe-ok')).toHaveTextContent('연결됨 · mock-model · 12ms');
    expect(screen.getByTestId('operator-probe-info')).toHaveTextContent('provider mock');
  });

  it('실패 결과를 실패 · error로 보여준다', async () => {
    stubFetch({
      '/api/ops/probe': {
        status: 200,
        body: { ok: false, provider: 'anthropic', modelId: 'claude-sonnet-5', latencyMs: 5, error: 'anthropic_api_error 401: invalid x-api-key' },
      },
      '/api/health': { status: 200, body: { mode: 'live', provider: 'anthropic', modelId: 'claude-sonnet-5', promptVersion: 'v1' } },
    });
    render(<OperatorMenu onNewSession={vi.fn()} />);

    await openMenu();
    await userEvent.click(screen.getByTestId('operator-probe'));

    await waitFor(() => expect(screen.getByTestId('operator-probe-fail')).toBeInTheDocument());
    expect(screen.getByTestId('operator-probe-fail')).toHaveTextContent('401');
  });
});

describe('OperatorMenu scripted로 새 체험', () => {
  it('확인하면 주입한 onRestartScripted를 호출한다', async () => {
    const onRestartScripted = vi.fn();
    render(<OperatorMenu onNewSession={vi.fn()} onRestartScripted={onRestartScripted} />);

    await openMenu();
    await userEvent.click(screen.getByTestId('operator-restart-scripted'));

    expect(screen.getByTestId('operator-confirm-restart-scripted')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('operator-confirm-restart-scripted-yes'));

    expect(onRestartScripted).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('operator-confirm-restart-scripted')).not.toBeInTheDocument();
  });

  it('취소하면 onRestartScripted를 호출하지 않는다', async () => {
    const onRestartScripted = vi.fn();
    render(<OperatorMenu onNewSession={vi.fn()} onRestartScripted={onRestartScripted} />);

    await openMenu();
    await userEvent.click(screen.getByTestId('operator-restart-scripted'));
    await userEvent.click(screen.getByTestId('operator-confirm-restart-scripted-cancel'));

    expect(onRestartScripted).not.toHaveBeenCalled();
  });
});


// GitHub Pages는 `/<repo>/` 아래에 배포된다. 루트 절대 경로로 이동하면 앱을 벗어나 404가
// 된다(PR #10 Codex 9차 검토 P2). 현재 pathname을 유지하고 쿼리만 바꾼다.
describe('scriptedRestartUrl', () => {
  it('배포 base를 유지한 채 mode=scripted 쿼리만 붙인다', () => {
    expect(scriptedRestartUrl('/')).toBe('/?mode=scripted');
    expect(scriptedRestartUrl('/axday_agent/')).toBe('/axday_agent/?mode=scripted');
    expect(scriptedRestartUrl('/axday_agent/index.html')).toBe('/axday_agent/index.html?mode=scripted');
    expect(scriptedRestartUrl('')).toBe('/?mode=scripted');
  });
});
