// 소개 화면(INTRO, T95, 2026-10-08 사용자 — "첫 페이지 다음, 안건 선택 전에 게임의
// 목적과 어떻게 해야 성공하는지 소개 한 장"). ATTRACT("체험 시작")와 SELECT(안건
// 선택) 사이에 끼워 넣는 한 장이다. 아직 scenario가 없어(session.scenarioId===null)
// 조종석 배치(StageBand)를 쓸 수 없으므로 SelectScreen과 같은 1열 배경(무대 사진·
// 스캔라인·브래킷)을 그대로 재사용하고, 그 위에 가운데 종이 한 장을 올린다. 문구는
// 전부 쉬운 말(T93 규칙, server/prompts/plainLanguage.ts FORBIDDEN_WORDS 0건)로 쓴다.
import stageRender from '../../assets/stage-render-01.jpg';
import '../../styles/screens/select.css';
import '../../styles/screens/intro.css';

export interface IntroScreenProps {
  onNext: () => void;
}

const STEPS: readonly string[] = [
  '① 상황 파악',
  '② 임원 의견 듣기',
  '③ 내 의견 쓰기',
  '④ 반응에 답하기',
  '⑤ 표결',
];

const TIPS: readonly string[] = [
  '추천 문구를 골라도 되고 직접 써도 됩니다.',
  '조건을 붙여 임원을 움직여 보세요.',
];

export function IntroScreen({ onNext }: IntroScreenProps) {
  return (
    <section className="screen intro-screen">
      {/* 배경은 SelectScreen과 같은 "기밀 작전실" 장식(select.css 클래스 재사용,
          ReactionsScreen이 discuss.css 클래스를 재사용하는 것과 같은 방식) — 안건을
          고르기 전 화면이라는 같은 맥락이라 별도 장식을 새로 만들지 않는다. */}
      <div className="select-screen__stage" aria-hidden="true">
        <img src={stageRender} alt="" className="select-screen__bg" />
        <div className="select-screen__scanlines" />
        <div className="select-screen__vignette" />
        <div className="select-screen__bracket select-screen__bracket--tl" />
        <div className="select-screen__bracket select-screen__bracket--tr" />
        <div className="select-screen__bracket select-screen__bracket--bl" />
        <div className="select-screen__bracket select-screen__bracket--br" />
      </div>

      <div className="intro-screen__paper">
        <span className="intro-screen__stamp" aria-hidden="true">
          BRIEFING
        </span>
        <span className="intro-screen__eyebrow">체험 전 안내</span>
        <h2 className="intro-screen__title">오늘 이사님은 특별 이사입니다</h2>

        <div className="intro-screen__columns">
          <div className="intro-screen__col">
            <div className="intro-screen__block">
              <span className="intro-screen__label">목적</span>
              <p className="intro-screen__purpose">가상 임원 네 명과 안건을 두고 토론하고,</p>
              <p className="intro-screen__purpose">마지막에 한 표를 던집니다.</p>
            </div>
            <div className="intro-screen__block">
              <span className="intro-screen__label">성공 기준</span>
              <p className="intro-screen__success" data-testid="intro-success">
                임원을 설득해 이사님과 같은 표가 3석 이상이면 &lsquo;설득 도장&rsquo;을
                받습니다.
              </p>
            </div>
          </div>
          <div className="intro-screen__col">
            <div className="intro-screen__block">
              <span className="intro-screen__label">진행 5단계 · 약 4분</span>
              <ol className="intro-screen__steps" data-testid="intro-steps">
                {STEPS.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
            <div className="intro-screen__block">
              <span className="intro-screen__label">팁</span>
              <ul className="intro-screen__tips">
                {TIPS.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <button type="button" className="cta intro-screen__cta" onClick={onNext} data-testid="intro-next">
          안건 고르러 가기 ▶
        </button>
      </div>
    </section>
  );
}
