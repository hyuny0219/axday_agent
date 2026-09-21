// 우측 상단 작은 '운영' 버튼: 새 체험(확인 후 초기화)·전체화면 진입/종료·닫기
// (CLAUDE_IMPLEMENTATION.md 3장 "현장 운영"). 참가자용 보안 기능이 아니라 현장 운영
// 편의 메뉴다. 관람 창 열기(P1)는 이 카드 범위 밖이라 추가하지 않는다.

import { useState } from 'react';
import { fetchHealth, probeModel, type HealthInfo, type ProbeResult } from '../../services/transport/probe';

export interface OperatorMenuProps {
  onNewSession: () => void;
  /** scripted로 새 체험 확인 뒤 실행할 이동 함수. 기본값은 location.assign('/?mode=scripted')이며,
   * 테스트에서 가로채려면 이 prop을 주입한다. */
  onRestartScripted?: () => void;
}

type PanelState =
  | 'closed'
  | 'menu'
  | 'confirmNewSession'
  | 'fullscreenError'
  | 'probe'
  | 'confirmRestartScripted';

type ProbeStatus = 'pending' | 'ok' | 'fail';

function isFullscreenSupported(): boolean {
  return typeof document !== 'undefined' && document.fullscreenEnabled === true;
}

function defaultRestartScripted(): void {
  if (typeof window !== 'undefined') {
    window.location.assign('/?mode=scripted');
  }
}

const FULLSCREEN_UNSUPPORTED_MESSAGE =
  '이 브라우저에서는 전체화면을 지원하지 않습니다. 브라우저 또는 키오스크 모드 설정에서 전체화면을 사용해 주세요.';
const FULLSCREEN_REJECTED_MESSAGE =
  '전체화면 요청이 거부되었습니다. 브라우저 또는 키오스크 모드 설정에서 전체화면을 사용해 주세요.';
const PROBE_FAIL_GUIDANCE = '키·MODEL_PROVIDER를 확인하거나 scripted로 새 체험을 시작하세요';

export function OperatorMenu({ onNewSession, onRestartScripted }: OperatorMenuProps) {
  const [panel, setPanel] = useState<PanelState>('closed');
  const [fullscreenMessage, setFullscreenMessage] = useState('');
  const [probeStatus, setProbeStatus] = useState<ProbeStatus>('pending');
  const [probeResult, setProbeResult] = useState<ProbeResult | null>(null);
  const [healthInfo, setHealthInfo] = useState<HealthInfo | null>(null);

  function close(): void {
    setPanel('closed');
  }

  function toggleMenu(): void {
    setPanel((current) => (current === 'closed' ? 'menu' : 'closed'));
  }

  async function handleFullscreenEnter(): Promise<void> {
    if (!isFullscreenSupported()) {
      setFullscreenMessage(FULLSCREEN_UNSUPPORTED_MESSAGE);
      setPanel('fullscreenError');
      return;
    }
    try {
      await document.documentElement.requestFullscreen();
      close();
    } catch {
      setFullscreenMessage(FULLSCREEN_REJECTED_MESSAGE);
      setPanel('fullscreenError');
    }
  }

  async function handleFullscreenExit(): Promise<void> {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } finally {
      close();
    }
  }

  function handleConfirmNewSession(): void {
    onNewSession();
    close();
  }

  async function handleProbeClick(): Promise<void> {
    setPanel('probe');
    setProbeStatus('pending');
    setProbeResult(null);
    setHealthInfo(null);
    const [probe, health] = await Promise.all([probeModel(), fetchHealth()]);
    setProbeResult(probe);
    setProbeStatus(probe.ok ? 'ok' : 'fail');
    setHealthInfo(health);
  }

  function handleConfirmRestartScripted(): void {
    close();
    (onRestartScripted ?? defaultRestartScripted)();
  }

  return (
    <div className="operator-menu">
      <button
        type="button"
        className="operator-menu__trigger"
        onClick={toggleMenu}
        aria-haspopup="menu"
        aria-expanded={panel === 'menu'}
        data-testid="operator-menu-button"
      >
        운영
      </button>
      {panel === 'menu' && (
        <div className="operator-menu__panel" role="menu" data-testid="operator-menu-panel">
          <button
            type="button"
            role="menuitem"
            className="operator-menu__item"
            onClick={() => setPanel('confirmNewSession')}
            data-testid="operator-new-session"
          >
            새 체험
          </button>
          <button
            type="button"
            role="menuitem"
            className="operator-menu__item"
            onClick={handleProbeClick}
            data-testid="operator-probe"
          >
            모델 연결 확인
          </button>
          <button
            type="button"
            role="menuitem"
            className="operator-menu__item"
            onClick={() => setPanel('confirmRestartScripted')}
            data-testid="operator-restart-scripted"
          >
            scripted로 새 체험
          </button>
          <button
            type="button"
            role="menuitem"
            className="operator-menu__item"
            onClick={handleFullscreenEnter}
            data-testid="operator-fullscreen-enter"
          >
            전체화면 진입
          </button>
          <button
            type="button"
            role="menuitem"
            className="operator-menu__item"
            onClick={handleFullscreenExit}
            data-testid="operator-fullscreen-exit"
          >
            전체화면 종료
          </button>
          <button
            type="button"
            role="menuitem"
            className="operator-menu__item"
            onClick={close}
            data-testid="operator-menu-close"
          >
            닫기
          </button>
        </div>
      )}
      {panel === 'confirmNewSession' && (
        <div
          className="operator-menu__panel"
          role="alertdialog"
          aria-label="새 체험 확인"
          data-testid="operator-confirm-new-session"
        >
          <p>진행 중인 체험을 초기화하고 새로 시작할까요?</p>
          <div className="operator-menu__actions">
            <button
              type="button"
              className="cta"
              onClick={handleConfirmNewSession}
              data-testid="operator-confirm-new-session-yes"
            >
              새 체험 시작
            </button>
            <button type="button" onClick={close} data-testid="operator-confirm-new-session-cancel">
              취소
            </button>
          </div>
        </div>
      )}
      {panel === 'fullscreenError' && (
        <div
          className="operator-menu__panel"
          role="alertdialog"
          aria-label="전체화면 안내"
          data-testid="operator-fullscreen-error"
        >
          <p>{fullscreenMessage}</p>
          <button type="button" onClick={close} data-testid="operator-fullscreen-error-close">
            닫기
          </button>
        </div>
      )}
      {panel === 'probe' && (
        <div
          className="operator-menu__panel"
          role="alertdialog"
          aria-label="모델 연결 확인"
          data-testid="operator-probe-panel"
        >
          {probeStatus === 'pending' && <p data-testid="operator-probe-pending">확인 중…</p>}
          {probeStatus === 'ok' && (
            <p className="operator-probe__result operator-probe__result--ok" data-testid="operator-probe-ok">
              연결됨 · {probeResult?.modelId} · {probeResult?.latencyMs}ms
            </p>
          )}
          {probeStatus === 'fail' && (
            <>
              <p className="operator-probe__result operator-probe__result--fail" data-testid="operator-probe-fail">
                실패 · {probeResult?.error}
              </p>
              <p>{PROBE_FAIL_GUIDANCE}</p>
            </>
          )}
          {healthInfo && (
            <p className="operator-probe__info" data-testid="operator-probe-info">
              provider {healthInfo.provider} · 모드 {healthInfo.mode} · 프롬프트 {healthInfo.promptVersion}
            </p>
          )}
          <div className="operator-menu__actions">
            <button
              type="button"
              onClick={close}
              disabled={probeStatus === 'pending'}
              data-testid="operator-probe-close"
            >
              닫기
            </button>
          </div>
        </div>
      )}
      {panel === 'confirmRestartScripted' && (
        <div
          className="operator-menu__panel"
          role="alertdialog"
          aria-label="scripted로 새 체험 확인"
          data-testid="operator-confirm-restart-scripted"
        >
          <p>scripted 모드로 세션을 초기화하고 새로 시작할까요?</p>
          <div className="operator-menu__actions">
            <button
              type="button"
              className="cta"
              onClick={handleConfirmRestartScripted}
              data-testid="operator-confirm-restart-scripted-yes"
            >
              예
            </button>
            <button
              type="button"
              onClick={close}
              data-testid="operator-confirm-restart-scripted-cancel"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
