// "발언 흐름" 패널(옛 이름 회의록): 왼쪽 열 무대·행동(CTA) 아래에 "누가 무엇을 말했는가"를
// 시간순으로 쌓아 보여준다(DESIGN_SPEC.md v1.0 7절, T41). 2026-09-28 사용자 결정으로 창
// 고정(최근 N건)과 한 줄 말줄임을 없앴다 — 모든 항목을 전문 그대로 줄바꿈해 보여주고,
// 넘치면 **이 패널의 목록만** 세로 스크롤한다(페이지 스크롤 금지 규칙은 그대로다). 새 항목이
// 오면 목록을 맨 아래(최신)로 내린다. 항목 계산은 순수 함수 buildMinutes(components/
// minutes.ts)가 전담하고, 이 컴포넌트는 표시만 담당한다.

import { useEffect, useRef, useState } from 'react';
import { TIME_UNKNOWN, type MinutesEntry } from '../minutes';
import type { MemberId } from '../../domain/types';
import { MEMBER_LABELS } from '../memberLabels';
import '../../styles/screens/minutes.css';

export interface MinutesPanelProps {
  entries: MinutesEntry[];
}

function speakerLabel(speaker: MemberId): string {
  return speaker === 'PARTICIPANT' ? '나 · 특별 이사' : MEMBER_LABELS[speaker];
}

/** 행 앞 역할 코드(시안 TRANSCRIPT "[mm:ss] CEO" 중 코드 부분, T77). 아바타를 쓰지
 * 않으므로(시안에 없음) 짧은 코드만 타임스탬프 뒤에 붙인다. */
function speakerTag(speaker: MemberId): string {
  return speaker === 'PARTICIPANT' ? '나' : speaker;
}

/** 머리글 오른쪽 건수 배지(시안 TRANSCRIPT "N ENTRIES · 스크롤", 1건은 "1 ENTRY"). */
function entryCountLabel(count: number): string {
  if (count <= 1) {
    return `${count} ENTRY`;
  }
  return `${count} ENTRIES · 스크롤`;
}

export function MinutesPanel({ entries }: MinutesPanelProps) {
  const listRef = useRef<HTMLOListElement>(null);
  // "최신을 따라가는 중"인지. 참가자가 위로 올려 앞선 발언을 읽는 동안에는 false가 되어
  // 새 렌더·크기 변화가 목록을 끌어내리지 않는다. 새 항목이 오면 다시 true로 돌아간다.
  const followRef = useRef(true);

  // 항목이 늘거나 "판단 중" 행이 문장으로 바뀌면 최신 항목이 보이도록 맨 아래로 내린다.
  // entries 배열은 매 렌더 새로 만들어지므로 id·kind로 만든 키로만 반응한다.
  const scrollKey = entries.map((entry) => `${entry.id}:${entry.kind}`).join('|');
  useEffect(() => {
    followRef.current = true;
    const list = listRef.current;
    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }, [scrollKey]);

  // 목록 높이는 화면 전환 직후 그리드가 다시 잡히며 늦게 줄어들 수 있다(VOTE에서 CTA·표결
  // 블록이 자리를 잡은 뒤). 그때 scrollTop을 한 번만 맞춰 두면 바닥에서 밀려난다 — 크기가
  // 바뀔 때마다, 따라가는 중이면 다시 바닥으로 붙인다(ResizeObserver 없는 jsdom은 건너뜀).
  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof ResizeObserver === 'undefined') {
      return;
    }
    const pin = () => {
      if (followRef.current) {
        list.scrollTop = list.scrollHeight;
      }
    };
    const observer = new ResizeObserver(pin);
    observer.observe(list);
    for (const child of Array.from(list.children)) {
      observer.observe(child);
    }
    return () => observer.disconnect();
  }, [scrollKey]);

  // 세로가 너무 빠듯해 목록에 한 줄도 못 담는 경우(1568×777 VOTE에서 칸이 32px, T56과 같은
  // 상황)에는 머리글만 남은 빈 패널을 그리지 않고 시각적으로 접는다(sr-only — 목록 전체는
  // 스크린리더에 남는다). 접힘 판단은 목록이 아니라 **그리드 칸**(.app-body__minutes) 높이로
  // 한다: 칸은 align-self:stretch라 패널이 접혀도 크기가 그대로여서 "접힘 → 0px → 다시 폄"
  // 진동이 없다(PR #10 Codex 3차 검토가 지적한 T56의 깜빡임 원인을 구조적으로 피한다).
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const list = listRef.current;
    const cell = list?.parentElement?.parentElement ?? null;
    if (!list || !cell || typeof ResizeObserver === 'undefined') {
      return;
    }
    const MIN_LIST_HEIGHT = 44; // 13px 글자 두 줄 남짓 — 이보다 작으면 읽을 수 없다.
    const decide = () => {
      // 칸 높이에서 목록이 실제로 쓸 수 없는 것(머리글, 패널 padding·border, 패널 gap)을
      // 모두 뺀 값으로 판단한다. 머리글만 빼면 여백만큼 과대평가돼 두 줄도 못 담는데 펼쳐진
      // 채 잘린 한 줄이 남는다(PR #11 Codex 8차).
      const panel = list.parentElement;
      const head = panel?.querySelector<HTMLElement>('.minutes__head');
      const headHeight = head?.getBoundingClientRect().height ?? 0;
      const ps = panel ? getComputedStyle(panel) : null;
      const px = (v: string | undefined) => Number.parseFloat(v ?? '') || 0;
      const overhead = ps
        ? px(ps.paddingTop) + px(ps.paddingBottom) + px(ps.borderTopWidth) + px(ps.borderBottomWidth) + px(ps.rowGap)
        : 0;
      const cellHeight = cell.getBoundingClientRect().height;
      setCollapsed(cellHeight - headHeight - overhead < MIN_LIST_HEIGHT);
    };
    decide();
    const observer = new ResizeObserver(decide);
    observer.observe(cell);
    return () => observer.disconnect();
  }, []);

  // 참가자가 직접 스크롤하면 바닥에 있을 때만 따라가기를 유지한다.
  const handleScroll = () => {
    const list = listRef.current;
    if (!list) {
      return;
    }
    followRef.current = list.scrollTop + list.clientHeight >= list.scrollHeight - 2;
  };

  return (
    <section
      className={`minutes${collapsed ? ' minutes--collapsed' : ''}`}
      aria-label="발언 흐름"
      data-testid="minutes-panel"
    >
      <header className="minutes__head">
        <h2 className="minutes__title">TRANSCRIPT · 발언 흐름</h2>
        <span className="minutes__count" data-testid="minutes-count">
          {entryCountLabel(entries.length)}
        </span>
      </header>
      {/* 새 항목은 물론, live에서 "판단 중" 행이 응답으로 바뀔 때도(같은 key의 행 안에서
          점 표시가 문장으로 교체된다) 발화자와 첫 문장을 한 덩어리로 읽어야 한다(v1.0 7절).
          그래서 목록은 additions뿐 아니라 text 변경도 알리고, 각 행을 aria-atomic으로
          묶는다 — 기본값(false)이면 바뀐 노드만 읽어 발화자가 빠진다(PR #7 Codex 1차 검토).
          목록이 스크롤 영역이므로 tabIndex=0으로 키보드 포커스를 받아 방향키로 움직인다. */}
      <ol
        ref={listRef}
        className="minutes__list"
        aria-live="polite"
        aria-relevant="additions text"
        // 접힌 동안(1px sr-only)에는 보이지 않는 스크롤 영역에 포커스가 가지 않게 탭 순서에서
        // 뺀다. 스크린리더는 포커스 없이도 목록을 탐색한다(PR #11 Codex 8차).
        tabIndex={collapsed ? -1 : 0}
        data-testid="minutes-list"
        onScroll={handleScroll}
      >
        {entries.map((entry) => (
          <li
            key={entry.id}
            className={`minutes__entry minutes__entry--${entry.kind}`}
            data-testid={`minutes-entry-${entry.id}`}
            aria-atomic="true"
          >
            {/* 발화자 전체 직함은 스크린리더용으로만 남긴다(시안에 아바타·배지가 없어
                화면에는 역할 코드만 보인다, T77). */}
            <span className="minutes__speaker">{speakerLabel(entry.speaker)}</span>
            {/* 시안 TRANSCRIPT 행 머리(타자기 앰버 "[mm:ss] 역할", T77). 위
                minutes__speaker(sr-only)가 전체 직함을 이미 전하므로 장식으로 숨긴다.
                시각을 모르는 행(scripted 각본 문구 등)은 "[--:--]"를 지어내 보이지
                않고 역할 코드만 보여준다(T85 #12). */}
            <span className="minutes__tag" aria-hidden="true">
              {entry.timeLabel !== TIME_UNKNOWN && entry.timeLabel !== undefined
                ? `[${entry.timeLabel}] `
                : ''}
              {speakerTag(entry.speaker)}
            </span>
            {/* 전문을 그대로 넣고 줄바꿈한다(2026-09-28 사용자: 잘리는 문장 없이 모두 보이게).
                판단 중인 행은 시안 그대로 "▌ 대기 중"을 보여준다(T77, Main.html 예시). */}
            <span className="minutes__text">{entry.kind === 'pending' ? '▌ 대기 중' : entry.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
