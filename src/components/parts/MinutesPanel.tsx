// 회의록 패널: 왼쪽 열 무대·행동(CTA) 아래에 "누가 무엇을 말했는가"를 한 줄씩 쌓아
// 보여주는 창 고정 패널이다(DESIGN_SPEC.md v1.0 7절, T41). 페이지·패널 스크롤은 두지
// 않는다 — 최근 N건만 보이고 그보다 오래된 항목은 시각적으로만 숨긴다(sr-only, 전체
// 목록은 스크린리더에 남는다). 항목 계산은 순수 함수 buildMinutes(components/minutes.ts)가
// 전담하고, 이 컴포넌트는 표시와 창 크기(visibleCount) 계산만 담당한다.

import { useEffect, useRef, useState } from 'react';
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

/** 1080에서는 6건, 720(1280px 이하)에서는 4건, 단 VOTE는 3건이 상한이다(v1.0 7절).
 * 실제로 몇 건을 보여줄지는 아래 useFittingCount가 남은 높이로 다시 줄인다. */
function maxCountFor(isNarrowViewport: boolean, stage: SessionStage): number {
  if (!isNarrowViewport) {
    return 6;
  }
  return stage === 'VOTE' ? 3 : 4;
}

/**
 * 패널에 실제로 들어가는 항목 수를 남은 높이로 계산한다(T56). 폭만 보고 고정 건수를
 * 쓰면 세로 예산이 빠듯한 창에서 목록이 아래로 넘쳐 **가장 최근 항목이 잘린다** —
 * 참가자가 방금 한 말이 사라지는 셈이라 가장 나쁜 방향의 잘림이었다.
 * 목록 높이와 한 항목 높이를 재서 max 이하로 줄이고, 창 크기가 바뀌면 다시 잰다.
 */
function useFittingCount(
  listRef: React.RefObject<HTMLOListElement | null>,
  max: number,
  entryCount: number,
): number {
  const [fitting, setFitting] = useState(max);

  useEffect(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }
    const measure = () => {
      const visible = list.querySelectorAll<HTMLElement>(
        '.minutes__entry:not(.minutes__entry--hidden)',
      );
      const first = visible[0];
      if (!first) {
        setFitting(max);
        return;
      }
      const gap = Number.parseFloat(getComputedStyle(list).rowGap) || 0;
      const entryHeight = first.getBoundingClientRect().height;
      if (entryHeight <= 0) {
        return;
      }
      // list.clientHeight는 아직 줄어들기 전 값일 수 있다(항목을 줄여야 비로소 줄어든다).
      // 그래서 패널이 실제로 쓸 수 있는 높이에서 머리글을 빼 직접 계산한다.
      const panel = list.parentElement;
      const head = panel?.querySelector<HTMLElement>('.minutes__head');
      const panelStyle = panel ? getComputedStyle(panel) : null;
      const padding = panelStyle
        ? Number.parseFloat(panelStyle.paddingTop) + Number.parseFloat(panelStyle.paddingBottom)
        : 0;
      const panelGap = panelStyle ? Number.parseFloat(panelStyle.rowGap) || 0 : 0;
      const outer = panel?.parentElement?.getBoundingClientRect().height ?? list.clientHeight;
      const available = Math.max(
        0,
        outer - (head?.getBoundingClientRect().height ?? 0) - padding - panelGap,
      );
      const room = Math.floor((available + gap) / (entryHeight + gap));
      // 한 건도 못 들어가면 0이다. 이때는 패널을 시각적으로 감춘다 — 억지로 한 건을
      // 그리면 머리글부터 잘려 읽을 수 없는 글자만 남는다(T56: VOTE에서 회의록 행이
      // 14.8px까지 줄어든다). 목록 전체는 스크린리더에 그대로 남는다.
      const next = Math.max(0, Math.min(max, room));
      // 계산은 항목 높이를 평균으로 보기 때문에 한 건을 과대평가할 수 있다(실측: 777px
      // 뷰포트에서 10px 초과). 렌더 결과가 실제로 넘치면 한 건씩 줄인다 — 단조 감소라
      // 반복은 0에서 멈춘다.
      const panelEl = list.parentElement;
      if (panelEl && panelEl.scrollHeight > panelEl.clientHeight + 1) {
        setFitting((current) => Math.max(0, Math.min(next, current - 1)));
        return;
      }
      setFitting(next);
    };
    measure();
    // jsdom 등 ResizeObserver가 없는 환경에서는 1회 측정으로 끝낸다(테스트 환경).
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [listRef, max, entryCount, fitting]);

  return fitting;
}

export function MinutesPanel({ entries, stage }: MinutesPanelProps) {
  const isNarrowViewport = useMatchMedia('(max-width: 1280px)');
  const listRef = useRef<HTMLOListElement>(null);
  const maxCount = maxCountFor(isNarrowViewport, stage);
  const visibleCount = useFittingCount(listRef, maxCount, entries.length);
  const windowed = visibleWindow(entries, visibleCount);

  return (
    <section
      className={`minutes${visibleCount === 0 ? ' minutes--collapsed' : ''}`}
      aria-label="회의록"
      data-testid="minutes-panel"
    >
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
      <ol ref={listRef} className="minutes__list" aria-live="polite" aria-relevant="additions text">
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
