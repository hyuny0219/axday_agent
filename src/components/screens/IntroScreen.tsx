// 소개 화면(INTRO, T95, 2026-10-08 사용자 — "첫 페이지 다음, 안건 선택 전에 게임의
// 목적과 어떻게 해야 성공하는지 소개 한 장"). ATTRACT("체험 시작")와 SELECT(안건
// 선택) 사이에 끼워 넣는 한 장이다. 아직 scenario가 없어(session.scenarioId===null)
// 조종석 배치(StageBand)를 쓸 수 없으므로 SelectScreen과 같은 1열 배경(무대 사진·
// 스캔라인·브래킷)을 그대로 재사용하고, 그 위에 가운데 종이 한 장을 올린다. 문구는
// 전부 쉬운 말(T93 규칙, server/prompts/plainLanguage.ts FORBIDDEN_WORDS 0건)로 쓴다.
import stageRender from '../../assets/stage-render-01.jpg';
import { HighlightText } from '../parts/HighlightText';
import '../../styles/screens/select.css';
import '../../styles/screens/intro.css';

export interface IntroScreenProps {
  /** "안내 받으며 시작 ▶" 하나뿐(T104) — 안건 선택으로 간다. 진행 도우미(T103)는 기본으로 켜져
   * 있고, 끄는 길은 운영 메뉴 "안내 끄기"와 URL `?coach=off`다. */
  onStart: () => void;
}

/** 체험 전 안내에서 꼭 읽어야 할 말(T102, 2026-10-08 사용자 — "중요한 단어를 브리핑과
 * 마찬가지로 강조"). 문장 속 글자와 그대로 일치할 때만 표시된다. */
export const INTRO_HIGHLIGHT_TERMS: readonly string[] = [
  '가상 임원 네 명',
  '한 표',
  '같은 표가 3석 이상',
  '설득 도장',
  '처음부터 같은 편인 임원도 한 석',
];

const SUCCESS_TEXT =
  '임원을 설득해, 이사님을 포함해 같은 표가 3석 이상이면 ‘설득 도장’을 받습니다. 처음부터 같은 편인 임원도 한 석으로 셉니다.';

export function IntroScreen({ onStart }: IntroScreenProps) {
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
              <p className="intro-screen__purpose">
                <HighlightText text="가상 임원 네 명과 안건을 두고 토론하고," terms={INTRO_HIGHLIGHT_TERMS} />
              </p>
              <p className="intro-screen__purpose">
                <HighlightText text="마지막에 한 표를 던집니다." terms={INTRO_HIGHLIGHT_TERMS} />
              </p>
            </div>
          </div>
          <div className="intro-screen__col">
            <div className="intro-screen__block">
              <span className="intro-screen__label">성공 기준</span>
              <p className="intro-screen__success" data-testid="intro-success">
                <HighlightText text={SUCCESS_TEXT} terms={INTRO_HIGHLIGHT_TERMS} />
              </p>
            </div>
          </div>
        </div>

        <div className="intro-screen__actions">
          <button
            type="button"
            className="cta intro-screen__cta"
            onClick={onStart}
            data-testid="intro-start-coach"
          >
            안내 받으며 시작 ▶
          </button>
        </div>
      </div>
    </section>
  );
}
