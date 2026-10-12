// 엔딩 화면(T127): 결과 보고서 뒤에 한 장으로 "끝났다"를 찍는다. 무대(어두운 배경) 위 종이 카드에
// 성공/실패 큰 도장, 이유 한 줄, 자리 5개, 안건 결과·6개월 뒤 한 줄(성공이면 조건 칩)을 담는다.
// 60초 자동 복귀는 주입된 Clock으로 잰다. 화면 안 포인터·키 입력이 있으면 다시 60초로 시작한다.
// 팝업(role=dialog)이라 코치 말풍선·점선은 CoachHost·focusRing이 알아서 숨긴다.

import { useEffect, useRef, useState } from 'react';
import { systemClock, type Clock } from '../../domain/clock';
import {
  ENDING_AUTO_RETURN_SECONDS,
  ENDING_TICK_MS,
  endingDeadline,
  endingSecondsLeft,
} from '../../domain/endingReturn';
import type { EndingModel } from '../endingSummary';
import '../../styles/screens/ending.css';

export interface EndingCardProps {
  model: EndingModel;
  caseTag: string;
  onDetail: () => void;
  onHome: () => void;
  clock?: Clock;
}

export function EndingCard({ model, caseTag, onDetail, onHome, clock = systemClock }: EndingCardProps) {
  const deadlineRef = useRef(endingDeadline(clock.now()));
  const [secondsLeft, setSecondsLeft] = useState(ENDING_AUTO_RETURN_SECONDS);
  const homeRef = useRef(onHome);
  homeRef.current = onHome;
  const homeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    homeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    deadlineRef.current = endingDeadline(clock.now());
    setSecondsLeft(ENDING_AUTO_RETURN_SECONDS);
    let fired = false;
    function restart() {
      deadlineRef.current = endingDeadline(clock.now());
    }
    const timer = setInterval(() => {
      const left = endingSecondsLeft(deadlineRef.current, clock.now());
      setSecondsLeft(left);
      if (left <= 0 && !fired) {
        fired = true;
        homeRef.current();
      }
    }, ENDING_TICK_MS);
    window.addEventListener('pointerdown', restart);
    window.addEventListener('pointermove', restart);
    window.addEventListener('keydown', restart);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pointerdown', restart);
      window.removeEventListener('pointermove', restart);
      window.removeEventListener('keydown', restart);
    };
  }, [clock]);

  const variant = model.success ? 'win' : 'lose';
  return (
    <div className="ending-backdrop" data-testid="ending-backdrop">
      <div
        className={`ending ending--${variant}`}
        role="dialog"
        aria-modal="true"
        aria-label="이사회 종료"
        data-testid="ending"
      >
        <p className="ending__topline" aria-hidden="true">
          MISSION REPORT · {caseTag}
        </p>
        <div className="ending__card" data-testid="ending-card">
          <span className="ending__eyebrow">이사회 종료</span>
          <div className="ending__stamp" data-testid="ending-stamp">
            {model.stampText}
          </div>
          <p className="ending__why" data-testid="ending-reason">
            {model.reason}
          </p>
          <ul className="ending__seats" data-testid="ending-seats">
            {model.seats.map((seat) => (
              <li key={seat.id} className={`ending__seat ending__seat--${seat.kind}`} data-testid={`ending-seat-${seat.id}`}>
                <i aria-hidden="true">{seat.mark}</i>
                <span>
                  {seat.label}
                  <span className="ending__sr">{seat.kind === 'me' ? '' : seat.kind === 'same' ? ' 같은 표' : ' 다른 표'}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="ending__sub" data-testid="ending-outcome">
            {model.outcomeLine}
            {model.epilogueLine ? ` 6개월 뒤, ${model.epilogueLine}` : ''}
          </p>
          {model.clue && (
            <p className="ending__clue" data-testid="ending-clue">
              {model.clue}
            </p>
          )}
          {model.conditionLabels.length > 0 && (
            <ul className="ending__chips" data-testid="ending-chips">
              {model.conditionLabels.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          )}
          <div className="ending__actions">
            <button type="button" className="cta cta--secondary" onClick={onDetail} data-testid="ending-detail">
              자세한 결과 보기
            </button>
            <button type="button" className="cta" ref={homeButtonRef} onClick={onHome} data-testid="ending-home">
              처음 화면으로
            </button>
          </div>
        </div>
        <p className="ending__timer" data-testid="ending-timer" aria-live="off">
          {secondsLeft}초 뒤 처음 화면으로 돌아갑니다
        </p>
      </div>
    </div>
  );
}
