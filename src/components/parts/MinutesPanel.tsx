// 회의록 패널: 왼쪽 열 무대·행동(CTA) 아래에 "누가 무엇을 말했는가"를 한 줄씩 쌓아
// 보여주는 창 고정 패널이다(DESIGN_SPEC.md v1.0 7절, T41). 페이지·패널 스크롤은 두지
// 않는다 — 최근 N건만 보이고 그보다 오래된 항목은 시각적으로만 숨긴다(sr-only, 전체
// 목록은 스크린리더에 남는다). 항목 계산은 순수 함수 buildMinutes(components/minutes.ts)가
// 전담하고, 이 컴포넌트는 표시와 창 크기(visibleCount) 계산만 담당한다.

import { useMatchMedia } from '../useMatchMedia';
import type { MinutesEntry } from '../minutes';
import { visibleWindow } from '../minutes';
import type { MemberId, SessionStage } from '../../domain/types';
import { MEMBER_LABELS } from '../memberLabels';
import { firstSentenceClipped } from '../stageText';
import { Avatar } from './Avatar';
import '../../styles/screens/minutes.css';

export interface MinutesPanelProps {
  entries: MinutesEntry[];
  /** VOTE 720에서는 더 좁은 창(3건)을 쓴다(v1.0 7절). 다른 단계는 1080=6/720=4로
   * 동일하다. */
  stage: SessionStage;
}

function speakerLabel(speaker: MemberId): string {
  return speaker === 'PARTICIPANT' ? '나 · 특별 이사' : MEMBER_LABELS[speaker];
}

/** 1080에서는 6건, 720(1280px 이하)에서는 4건, 단 VOTE는 3건만 보인다(v1.0 7절
 * "창 고정: 1080은 최근 6건, 720은 최근 4건(VOTE는 3건)만 보이고"). */
function visibleCountFor(isNarrowViewport: boolean, stage: SessionStage): number {
  if (!isNarrowViewport) {
    return 6;
  }
  return stage === 'VOTE' ? 3 : 4;
}

export function MinutesPanel({ entries, stage }: MinutesPanelProps) {
  const isNarrowViewport = useMatchMedia('(max-width: 1280px)');
  const visibleCount = visibleCountFor(isNarrowViewport, stage);
  const windowed = visibleWindow(entries, visibleCount);

  return (
    <section className="minutes" aria-label="회의록" data-testid="minutes-panel">
      <header className="minutes__head">
        <h2 className="minutes__title">회의록</h2>
        <span className="minutes__count" data-testid="minutes-count">
          {entries.length}건
        </span>
      </header>
      {/* 새 항목은 물론, live에서 "판단 중" 행이 응답으로 바뀔 때도(같은 key의 행 안에서
          점 표시가 문장으로 교체된다) 발화자와 첫 문장을 한 덩어리로 읽어야 한다(v1.0 7절).
          그래서 목록은 additions뿐 아니라 text 변경도 알리고, 각 행을 aria-atomic으로
          묶는다 — 기본값(false)이면 바뀐 노드만 읽어 발화자가 빠진다(PR #7 Codex 1차 검토). */}
      <ol className="minutes__list" aria-live="polite" aria-relevant="additions text">
        {windowed.map(({ hidden, ...entry }) => (
          <li
            key={entry.id}
            className={`minutes__entry minutes__entry--${entry.kind}${
              hidden ? ' minutes__entry--hidden' : ''
            }`}
            data-testid={`minutes-entry-${entry.id}`}
            aria-atomic="true"
          >
            <Avatar memberId={entry.speaker} size="sm" />
            <span className="minutes__speaker">{speakerLabel(entry.speaker)}</span>
            {entry.kind === 'pending' ? (
              <>
                <span className="minutes__dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
                {/* 점은 장식이므로 상태 문구를 스크린리더용으로 따로 둔다 — pending 행이
                    추가될 때 발화자와 함께 "판단 중"이 읽힌다(v1.0 7절, PR #7 Codex 2차). */}
                <span className="minutes__sr-only">판단 중…</span>
              </>
            ) : (
              <span className="minutes__text">{firstSentenceClipped(entry.text)}</span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
