// 결과 화면: 오른쪽 열은 종이 보고서 한 장이다(T66, docs/design/mockups/C_Result.html·
// C_Result_Reject.html). 위쪽(result-report__top)은 왼쪽 결론·조건·원문 카드와 오른쪽
// 200px 도장 칸으로 나뉘고, 아래는 VERDICTS 패널(임원별 판단 5행 + 남은 과제·AI가 도운
// 일 한 줄씩 + "+6 MONTHS")이 전체 폭을 채운다. T64가 남겼던 동일 크기 5석 카드는
// 무대 명패(StageBand VoteBadge)가 이미 표 배지를 보여줘 중복이라 이 카드에서 뺐다 —
// DESIGN_SPEC.md 3장의 그 규칙은 v1.1에서 폐기다(9절 참고). '체험 종료'는 운영자 새
// 체험(OPERATOR_RESET, 확인 절차 포함) 없이 바로 세션을 초기화하고 ATTRACT로 돌아간다.
// 'AI가 도운 일'은 session.assistantActions(AssistantPanel이 남긴 레이블)이 있을
// 때만 항목을 이어붙이고 없으면 미사용 문구만 보여준다(T12). live 모드 VERDICTS 행은
// 판단 근거(ballot.reason, ≤160자)를 그대로 보여주고, UNCAST 행은 unavailableReason을
// 함께 보여준다(T30). 응답 장애로 판단이 제한됐으면(tally().limitedByUnavailable) 공통
// 안내를 띄운다. live 호출 여부는 describeAdditionalHelp가 "(실제 AI 호출)" 접미어로
// 구분한다(T31).

import { useEffect, useMemo, useState } from 'react';
import type { Scenario } from '../../content/types';
import type { Ballot, MemberId, Session } from '../../domain/types';
import { EXEC_MEMBER_ORDER, tally } from '../../domain/voting';
import { describeAdditionalHelp } from '../../domain/assistantLog';
import { MEMBER_LABELS } from '../memberLabels';
import { collectConfirmedConditionIds, collectParticipantStance } from '../opinionConditions';
import { buildRemainingTaskLabels } from '../motionDisplay';
import { buildResultSummary } from '../resultSummary';
import { buildMinutes, type RoundLogEntry } from '../minutes';
import { MinutesPanel } from '../parts/MinutesPanel';
import {
  PERSUASION_STAMP_DELAY_SECONDS,
  STAMP_DELAY_SECONDS,
  computePersuasion,
  computeResultStamp,
} from '../resultStamp';
import { epilogueText } from '../resultEpilogue';
import { EndSessionConfirm } from '../parts/EndSessionConfirm';
// 결론·설득 도장(result-stamp)은 T44에서 무대 열 우하단에 그렸으나, T64("기밀 작전실"
// 스킨)에서 오른쪽 종이 보고서의 전용 칸(200px)으로 옮겼다(docs/design/mockups/README.md
// "도장은 결과 화면 오른쪽 종이 보고서 우상단에 — 무대에는 표 배지만"). 이 화면이
// components/resultStamp.ts의 순수 함수를 직접 불러 도장 문구·타이밍을 계산한다.
import '../../styles/screens/result.css';
import '../../styles/screens/live.css';

export interface ResultScreenProps {
  scenario: Scenario;
  session: Session;
  /** 회의록 전문 패널(T58, T64 item 7 "회의록 전문 보기")이 buildMinutes에 넘길
   * 라운드별 임원 응답 기록. App.tsx가 SET_ROLE_STATUS dispatch를 가로채 쌓아 둔다. */
  roundLog: RoundLogEntry[];
  onReset: () => void;
}

const SEAT_ORDER: readonly MemberId[] = [...EXEC_MEMBER_ORDER, 'PARTICIPANT'];

const VOTE_TEXT: Record<Ballot['vote'], string> = {
  YES: '찬성',
  NO: '반대',
  UNCAST: '미표결',
};

// 반대·미표결은 색만으로 구분하지 않고 아이콘을 더한다(DESIGN_SPEC.md 4장
// "반대·미표결은 색+텍스트+아이콘"). 찬성은 색+텍스트만으로도 구분에 문제가
// 없어 아이콘을 더하지 않는다. 장식이므로 스크린리더에는 노출하지 않는다
// (텍스트 라벨이 이미 접근 가능한 이름을 제공한다).
const VOTE_ICON: Partial<Record<Ballot['vote'], string>> = {
  NO: '✕',
  UNCAST: '–',
};

export function ResultScreen({ scenario, session, roundLog, onReset }: ResultScreenProps) {
  const finalMotion = session.finalMotion;

  const additionalHelp = useMemo(
    () => describeAdditionalHelp(session.assistantActions),
    [session.assistantActions],
  );

  const tallyResult = useMemo(() => tally(session.ballots), [session.ballots]);

  // 결론 도장(T44/T64): PASS·REJECT일 때만 문구가 있다(finalMotion 없으면 null이지만
  // RESULT는 항상 finalMotion이 있다, 아래 이른 반환 참고).
  const resultStamp = useMemo(() => computeResultStamp(session), [session]);

  // "설득 도장" 근거 한 줄(T63, v1.0 9절). 참가자 좌석이 UNCAST면(가능한 경우) 계산하지
  // 않는다(computePersuasion이 null을 돌려준다).
  const persuasion = useMemo(() => computePersuasion(session), [session]);

  const allConfirmedIds = useMemo(() => collectConfirmedConditionIds(session.opinions), [session.opinions]);
  const includedIds = useMemo(
    () => allConfirmedIds.filter((id) => finalMotion?.effectiveConditionIds.includes(id) ?? false),
    [allConfirmedIds, finalMotion],
  );

  // "이사회 한 장 요약"(v1.0 9절, T48) → VERDICTS 패널(T66): finalMotion이 있을 때만
  // 계산한다(buildResultSummary는 없으면 던진다). RESULT는 항상 finalMotion이 있으므로
  // 안전하다(아래 이른 반환 참고).
  const resultSummary = useMemo(
    () => (finalMotion ? buildResultSummary(scenario, session) : null),
    [scenario, session, finalMotion],
  );

  // 회의록 전문 패널(T58, T64 item 7 "회의록 전문 보기"): 화면 로컬 상태로 오른쪽
  // 열의 기록 영역(VERDICTS 패널)만 "이사회 한 장 요약" ↔ 전문으로 바꾼다. 세션
  // 상태는 건드리지 않는다. 전문 항목은 다른 화면의 "발언 흐름" 패널과 같은 순수
  // 함수(buildMinutes)로 계산해 항목 수·순서가 어긋나지 않는다.
  const [showTranscript, setShowTranscript] = useState(false);
  // "처음 화면으로" 확인 단계(T84, Opus UX 검토 #5 — "'체험 종료'가 확인 없이 즉시
  // 초기화"). 세션 초기화(onReset)는 되돌릴 수 없으므로 한 번 더 확인한다.
  const [endSessionConfirmOpen, setEndSessionConfirmOpen] = useState(false);
  const transcriptEntries = useMemo(
    () => buildMinutes(session, scenario, roundLog),
    [session, scenario, roundLog],
  );

  // 클릭·키 입력으로 도장 연출을 즉시 건너뛴다(DESIGN_SPEC.md v1.0 3절). 건너뛴
  // 뒤에는 리스너를 더 둘 이유가 없어 정리한다.
  const [skip, setSkip] = useState(false);
  useEffect(() => {
    if (skip) {
      return;
    }
    function handleSkip() {
      setSkip(true);
    }
    window.addEventListener('click', handleSkip);
    window.addEventListener('keydown', handleSkip);
    return () => {
      window.removeEventListener('click', handleSkip);
      window.removeEventListener('keydown', handleSkip);
    };
  }, [skip]);

  if (!finalMotion) {
    return null;
  }

  const conclusion =
    session.outcome === 'PASS' ? scenario.resultCopy.pass : scenario.resultCopy.reject;

  // 도장 칸 케이스 태그(장식, T64 "CASE 02", T83에서 한국어화). 안건 사건 번호
  // (incident.caseLabel)가 이미 "사건 02" 형식이라 그대로 쓴다.
  const caseTag = scenario.incident.caseLabel;

  // 가결은 도장과 같은 기준(반영 조건 유무)으로 pass/passOriginal을 가른다
  // (components/resultEpilogue.ts, PR #8 Codex 2차 검토).
  const isConditionalPass = session.outcome === 'PASS' && includedIds.length > 0;

  // 도장 글자 줄바꿈 방지(T66 목표 "'조건부 가결' 글자가 원 안에서 줄바꿈돼 깨진다").
  // resultStamp.text("가결"·"조건부 가결"·"부결", stampText()가 정한 같은 문구)를
  // 새로 판정하지 않고 표기만 나눈다 — 큰 글자는 "가결"/"부결" 두 글자만, "조건부"는
  // 위 작은 케이스 줄에 "· 조건부"로 옮긴다.
  const stampBigText = session.outcome === 'REJECT' ? '부결' : '가결';
  const stampCaseTag = isConditionalPass ? `${caseTag} · 조건부` : caseTag;

  const epilogue = epilogueText(
    session.outcome,
    includedIds.length > 0,
    scenario.resultCopy.sixMonthsLater,
  );

  // "남은 과제"·"AI가 도운 일" 한 줄(T66 item 2 "라벨 + 항목을 '·'로 이어서"). T84:
  // 확정 조건에 대응하는 과제(remainingTasks[].resolvedBy)는 빼고 남은 것만 보여준다
  // (MotionScreen·VoteScreen과 같은 로직 — Opus UX 검토 #3+my#2). 과제가 모두
  // 해소됐거나(조건부 가결) 원래 없으면(준비 중 안건) 줄 자체를 그리지 않는다.
  // 부결이면 과제를 하나도 빼지 않는다(PR #20 Codex 1차 검토 P2, buildRemainingTaskLabels 참고).
  const remainingTaskLabels = buildRemainingTaskLabels(scenario, includedIds, session.outcome);
  const remainingTasksLine = remainingTaskLabels.length > 0 ? remainingTaskLabels.join(' · ') : null;

  // 참가자 행 안내(T85 #15): 내 표가 결정적이지 않았을 때, "결과는 임원 표만으로
  // 정해졌습니다"(참가자를 배제한 듯 들리는 문구) 대신 내 표가 다수 의견과 같은
  // 방향이었는지로 가른다. 가결/부결이 아니라 **실제 득표수**로 본다 — live에서 임원
  // 3명이 미표결이고 찬성 1·반대 1이면 부결이지만 다수 의견은 없으므로 "다수 의견과
  // 같은 판단"이라고 하면 모순이다(PR #20 Codex 2차 검토 P2). 동률이면 별도 문구.
  // T92: 참가자가 반대 입장으로 반대표를 던졌고 그 표가 다수였으며 안건이 부결됐으면
  // (가결·반대 조합은 어색하므로 REJECT로 한정) "다수 의견과 같은 판단"보다 반대 입장을
  // 직접 가리키는 문구로.
  const participantStance = collectParticipantStance(session.opinions);
  const participantRowNote = (() => {
    const vote = resultSummary?.participant.vote;
    if (!vote) return '';
    const mine = tallyResult.counts[vote];
    const other = tallyResult.counts[vote === 'YES' ? 'NO' : 'YES'];
    if (mine > other) {
      if (participantStance === 'AGAINST' && vote === 'NO' && session.outcome === 'REJECT') {
        return '이사님의 반대가 이사회 결론이 되었습니다';
      }
      return '다수 의견과 같은 판단을 내렸습니다';
    }
    if (mine < other) return '소수 의견으로 회의록에 남았습니다';
    return '표가 갈려 어느 쪽도 다수가 아니었습니다';
  })();

  return (
    <>
      <div className="app-body__actions screen result-screen__actions">
        {/* TALLY 패널(T64 item 7, Main.html C_Result.html 왼쪽 열 "TALLY · 5석 과반").
            5칸 막대 + 집계·설득 문구는 오른쪽 종이 보고서(VERDICTS 패널)와 같은
            계산값을 다시 그린 것이라 aria-hidden으로 중복 낭독을 막는다(무대 띠와
            같은 규칙, 같은 정보가 오른쪽 열 본문에 접근 가능하게 그대로 있다). */}
        <section className="result-tally" data-testid="result-tally" aria-hidden="true">
          <div className="result-tally__head">
            <span>집계 · 5석 과반</span>
            <span>찬성 {tallyResult.counts.YES} / 반대 {tallyResult.counts.NO}</span>
          </div>
          <div className="result-tally__bars">
            {SEAT_ORDER.map((memberId) => {
              const vote = session.ballots.find((b) => b.memberId === memberId)?.vote ?? 'UNCAST';
              return (
                <span
                  key={memberId}
                  className={`result-tally__bar result-tally__bar--${vote.toLowerCase()}`}
                />
              );
            })}
          </div>
          {persuasion && (
            // T85 #16: 게임 용어("→ 추가 도장 획득")를 걷어내고 자연문으로 바꾼다.
            // 같은 내용을 되풀이하던 VERDICTS 쪽 문단(아래 result-summary__persuasion)은
            // 빼고 이 한 곳에만 남긴다(설득 도장 자체·"BONUS" 연출은 오른쪽 도장 칸에
            // 그대로 있다).
            <p className="result-tally__caption" data-testid="result-tally-caption">
              이사님 표 {VOTE_TEXT[persuasion.participantVote]} · 같은 표 {persuasion.sameVoteSeats}석
              {persuasion.earned ? ' — 설득 도장을 받았습니다' : ' · 3석부터 설득 도장을 받습니다'}
              {resultSummary?.participant.decisive ? '. 이사님의 한 표가 결과를 정했습니다' : ''}
            </p>
          )}
        </section>
        {/* 버튼 두 개는 확인 UI가 열려 있어도 마운트를 유지한다(비활성만) — 확인 UI로
            교체하면 "처음 화면으로" 버튼이 사라져 취소 뒤 포커스를 되돌릴 곳이 없다
            (PR #20 Codex 16차 검토 P2). */}
        {/* "회의록 전문 보기"가 이제 주 CTA다(T84 #5) — 결과 화면에 머무는 동안
            가장 자주 쓰는 동작이고, 세션 상태는 바꾸지 않고 오른쪽 열 기록
            영역만 화면 로컬 상태로 전문 ↔ 요약을 오간다. */}
        <button
          type="button"
          className="cta"
          onClick={() => setShowTranscript((previous) => !previous)}
          aria-pressed={showTranscript}
          disabled={endSessionConfirmOpen}
          data-testid="result-transcript-toggle"
        >
          {showTranscript ? '이사회 한 장 요약 보기' : '회의록 전문 보기'}
        </button>
        {/* "처음 화면으로"(옛 "체험 종료")는 세션을 초기화하는 되돌릴 수 없는
            동작이라 보조 CTA로 낮추고, 누르면 바로 초기화하지 않고 확인 단계를
            먼저 연다(아래 EndSessionConfirm). */}
        <button
          type="button"
          className="cta cta--secondary"
          onClick={() => setEndSessionConfirmOpen(true)}
          disabled={endSessionConfirmOpen}
          data-testid="end-session"
        >
          처음 화면으로
        </button>
        {endSessionConfirmOpen && (
          <EndSessionConfirm
            onConfirm={onReset}
            onCancel={() => setEndSessionConfirmOpen(false)}
          />
        )}
      </div>
      <div className="app-body__content screen result-screen" data-skip={skip}>
        {/* 종이 보고서 머리글(T64→T66, C_Result.html "DEBRIEF 02 · 이사회 한 장 요약").
            왼쪽은 결론 제목 + YOUR CONDITIONS·YOUR WORDS 두 카드, 오른쪽은 200px
            도장 칸이다(item 1). */}
        <div className="result-report__top">
          <div className="result-report__main">
            <p className="result-report__eyebrow" aria-hidden="true">
              {/* T85 #20: 안건 번호는 선택한 안건(incident.caseLabel, "사건 02")에서 — T83이
                  태그를 한국어로 바꿨으므로 "결과 보고 · 사건 02" 꼴로 잇는다. */}
              <span className="result-report__eyebrow-tag">결과 보고 · {caseTag}</span>
              <span>이사회 한 장 요약</span>
            </p>
            <h2 className="result-screen__title" data-testid="result-conclusion">
              {conclusion}
            </h2>
            {session.expiredWithoutMotion && (
              <p className="result-screen__expired-notice" data-testid="expired-without-motion-notice">
                시간 종료로 원안을 집계합니다. 미확정 수정 조건은 반영되지 않았습니다.
              </p>
            )}
            {/* T86(2026-10-07 사용자 — "실시간 표시는 제거해줘", 이어서 "사전 구성
                시뮬레이션 표시도 빼줘"): 모드 안내 줄은 live·scripted 가리지 않고
                완전히 없앴다 — 모드 확인은 운영 메뉴에서만 한다. */}
            {tallyResult.limitedByUnavailable && (
              <p className="result-screen__limited-notice" data-testid="result-limited-notice">
                일부 임원 미표결로 판단이 제한되었습니다.
              </p>
            )}
            {resultSummary && (
              <div className="result-your-columns">
                <div className="result-your-card">
                  <span className="result-your-card__label">반영 조건</span>
                  <p className="result-your-card__value" data-testid="result-summary-conditions">
                    {resultSummary.conditionLabels.length > 0
                      ? resultSummary.conditionLabels.join(', ')
                      : '조건 없이 원안 그대로 상정'}
                  </p>
                </div>
                <div className="result-your-card">
                  <span className="result-your-card__label">내 원문</span>
                  <div className="result-mine" data-testid="result-mine">
                    {resultSummary.quote.map((text, index) => (
                      <p key={index} className="result-mine__quote">
                        {text}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* 도장 칸(200px, item 1): 결론 도장은 잉크(붉은 원, multiply) — PASS/REJECT
              색은 아래 result.css가 --stamp-red 한 색으로 통일한다(4장 규칙: 도장 종류를
              늘리지 않는다). 설득 도장은 0.4초 뒤 왼쪽 아래에 겹친다. 클릭·키 입력으로
              건너뛰면(위 skip) 두 도장 모두 지연 없이 바로 보인다. */}
          {resultStamp && (
            <div className="result-stamp-box">
              <div
                className="result-stamp"
                data-testid="result-stamp"
                style={{ animationDelay: `${skip ? 0 : STAMP_DELAY_SECONDS}s` }}
              >
                <span className="result-stamp__case" aria-hidden="true">
                  {stampCaseTag}
                </span>
                <span className="result-stamp__text">{stampBigText}</span>
                <span className="result-stamp__meta" aria-hidden="true">
                  {resultStamp.outcome === 'PASS' ? '가결' : '부결'} · {tallyResult.counts.YES}:
                  {tallyResult.counts.NO}
                </span>
              </div>
              {persuasion &&
                (persuasion.earned ? (
                  <div
                    className="result-stamp result-stamp--persuasion"
                    data-testid="persuasion-stamp"
                    style={{
                      animationDelay: `${skip ? 0 : PERSUASION_STAMP_DELAY_SECONDS}s`,
                    }}
                  >
                    <span className="result-stamp__case" aria-hidden="true">
                      보너스
                    </span>
                    <span className="result-stamp__text">설득 성공</span>
                    <span className="result-stamp__meta" aria-hidden="true">
                      같은 표 {persuasion.sameVoteSeats}석
                    </span>
                  </div>
                ) : (
                  <p className="result-bonus-missed" data-testid="persuasion-stamp-missed">
                    보너스 미획득
                    <br />
                    같은 표 {persuasion.sameVoteSeats}석 · 3석부터
                  </p>
                ))}
            </div>
          )}
        </div>
        {/* 회의록 전문 패널(T58 흡수, T64 item 7): 토글이 켜지면 아래 VERDICTS 패널
            전체를 "발언 흐름"과 같은 순수 함수(buildMinutes)로 계산한 전문으로
            바꾼다. 무대 아래 "발언 흐름" 패널은 RESULT에서 렌더되지 않으므로
            전문은 여기서만 읽을 수 있다(원 카드 T58 목표). 다시 누르면 요약으로
            돌아온다 — 세션 상태는 그대로다. */}
        {showTranscript ? (
          <section className="result-transcript" data-testid="result-transcript">
            <MinutesPanel entries={transcriptEntries} />
          </section>
        ) : (
          resultSummary && (
            /* VERDICTS · 임원별 판단(T66 item 2, 전체 폭 종이-2 패널): 5행(임원 4+나) +
               남은 과제·AI가 도운 일 한 줄씩 + "+6 MONTHS". T64의 동일 크기 5석 카드와
               2/3+1/3 기록 패널을 이 한 패널로 합쳤다 — 표 배지는 무대 명패가 이미
               보여주고 이 패널이 표를 글자로 다시 적으므로 카드는 중복이었다. */
            <section className="result-verdicts" data-testid="result-summary">
              <div className="result-verdicts__head">
                <h3 className="result-screen__section-label">임원별 판단</h3>
                <p className="result-summary__tally" data-testid="result-summary-tally">
                  찬성 {resultSummary.tally.counts.YES} · 반대 {resultSummary.tally.counts.NO}
                  {resultSummary.tally.counts.UNCAST > 0 &&
                    ` · 미표결 ${resultSummary.tally.counts.UNCAST}`}
                </p>
              </div>
              <ul className="result-verdicts__rows">
                {resultSummary.execRows.map((row) => {
                  const isUncast = row.vote === 'UNCAST';
                  return (
                    <li
                      key={row.memberId}
                      className={`result-seat result-seat--${row.vote.toLowerCase()}`}
                      data-testid={`result-seat-${row.memberId}`}
                    >
                      <span className="result-seat__title">{MEMBER_LABELS[row.memberId]}</span>
                      <span className="result-seat__vote">
                        {VOTE_ICON[row.vote] && (
                          <span className="result-seat__vote-icon" aria-hidden="true">
                            {VOTE_ICON[row.vote]}
                          </span>
                        )}
                        {VOTE_TEXT[row.vote]}
                      </span>
                      {/* live의 UNCAST 행은 "미표결 · 사유"(item 2) — 판단 이유 자리에
                          unavailableReason을 그대로 보여준다(별도 testid 유지). */}
                      <span className="result-seat__reason" data-testid={`result-seat-reason-${row.memberId}`}>
                        {isUncast ? (
                          <span data-testid={`result-seat-unavailable-${row.memberId}`}>{row.reason}</span>
                        ) : (
                          row.reason
                        )}
                      </span>
                      {row.changed && (
                        <span
                          className="result-summary__changed"
                          data-testid="result-summary-changed"
                        >
                          이사님 조건으로 바뀜
                        </span>
                      )}
                    </li>
                  );
                })}
                <li
                  className={`result-seat result-seat--${resultSummary.participant.vote.toLowerCase()}`}
                  data-testid="result-seat-PARTICIPANT"
                >
                  <span className="result-seat__title">나 · 특별 이사</span>
                  <span className="result-seat__vote">
                    {VOTE_ICON[resultSummary.participant.vote] && (
                      <span className="result-seat__vote-icon" aria-hidden="true">
                        {VOTE_ICON[resultSummary.participant.vote]}
                      </span>
                    )}
                    {VOTE_TEXT[resultSummary.participant.vote]}
                  </span>
                  <span className="result-seat__reason" data-testid="result-summary-decisive">
                    {resultSummary.participant.decisive
                      ? '이사님의 한 표가 결과를 정했습니다'
                      : participantRowNote}
                  </span>
                </li>
              </ul>
              <div className="result-verdicts__footer">
                {remainingTasksLine && (
                  <p className="result-verdicts__line" data-testid="result-tasks">
                    남은 과제 · {remainingTasksLine}
                  </p>
                )}
                <p className="result-verdicts__line" data-testid="result-ai-help">
                  AI가 도운 일 ·{' '}
                  {additionalHelp.length > 0 ? (
                    additionalHelp.join(' · ')
                  ) : (
                    <span data-testid="result-ai-help-none">AI 비서실장 도움은 사용하지 않았습니다.</span>
                  )}
                </p>
              </div>
            </section>
          )
        )}
        {/* "6개월 뒤" 카드(T84, Opus UX 검토 #8 — "가장 기억에 남을 문장이 12px
            회색 1줄 클램프라 가장 작다"). VERDICTS 패널 바로 아래 별도 카드로
            승격하고, VERDICTS 아래 남는 빈 공간을 이 카드 + "이사님이 붙인 조건"
            큰 칩으로 채운다. 회의록 전문을 보는 동안(showTranscript)은 그리지
            않는다 — 전문 보기도 VERDICTS와 자리를 바꿔 쓰는 요약 전용 카드다. */}
        {!showTranscript && resultSummary && epilogue !== null && (
          <section className="result-epilogue-card" data-testid="result-epilogue">
            <div className="result-epilogue-card__head">
              <h3 className="result-screen__section-label">6개월 뒤, 이사님의 결정은</h3>
              <span className="result-epilogue__badge">체험용 가상 전망</span>
            </div>
            <p className="result-epilogue-card__text">{epilogue}</p>
            <div className="result-epilogue-card__conditions">
              <span className="result-epilogue-card__conditions-label">이사님이 붙인 조건</span>
              {resultSummary.conditionLabels.length > 0 ? (
                <ul className="result-epilogue-card__chips">
                  {resultSummary.conditionLabels.map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
              ) : (
                <span className="result-epilogue-card__no-conditions">조건 없이 원안 그대로 상정</span>
              )}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
