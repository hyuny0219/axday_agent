// 소개 화면(INTRO, T95, 2026-10-08 사용자 — "첫 페이지 다음, 안건 선택 전에 게임의
// 목적과 어떻게 해야 성공하는지 소개 한 장"). ATTRACT("체험 시작")와 SELECT(안건
// 선택) 사이에 끼워 넣는 한 장이다. 아직 scenario가 없어(session.scenarioId===null)
// 조종석 배치(StageBand)를 쓸 수 없으므로 SelectScreen과 같은 1열 배경(무대 사진·
// 스캔라인·브래킷)을 그대로 재사용하고, 그 위에 가운데 종이 한 장을 올린다. 문구는
// 전부 쉬운 말(T93 규칙, server/prompts/plainLanguage.ts FORBIDDEN_WORDS 0건)로 쓴다.
import stageRender from '../../assets/stage-render-01.jpg';
import { introNextStep } from '../../domain/nextStep';
import { nextStepAttr, useFocusGate } from '../parts/focusRing';
import { HighlightText } from '../parts/HighlightText';
import '../../styles/screens/select.css';
import '../../styles/screens/intro.css';

export interface IntroScreenProps {
  /** "확인" 하나뿐(T104) — 안건 선택으로 간다. 진행 도우미(T103)는 기본으로 켜져
   * 있고, 끄는 길은 운영 메뉴 "안내 끄기"와 URL `?coach=off`다. */
  onStart: () => void;
}

/** 체험 전 안내에서 꼭 읽어야 할 말(T102, 2026-10-08 사용자 — "중요한 단어를 브리핑과
 * 마찬가지로 강조"). 문장 속 글자와 그대로 일치할 때만 표시된다. */
export const INTRO_HIGHLIGHT_TERMS: readonly string[] = [
  'AI 임원 네 명',
  '찬성·반대 중 하나',
  '한 표',
  '특별 이사의 의견',
  'AI 임원들을 설득',
  '같은 편',
  '같은 표가 3석 이상',
  '성공 도장',
];

/** 체험 전 안내의 '팁' 4단계 카드(T125, 2026-10-12 사용자 — "'팁'으로 써 주고 A안으로").
 * 함정 조건의 이름이나 임원별 정답은 밝히지 않고 흐름만 알려 준다. */
export const INTRO_TIPS_LABEL = '팁';
export interface IntroTip {
  tag: string;
  text: string;
  /** 카드마다 강조할 말(카드 문장 속 글자와 일치할 때만 표시). */
  terms: readonly string[];
  warn?: boolean;
}
export const INTRO_TIPS: readonly IntroTip[] = [
  { tag: '01 · 읽기', text: '근거 자료에서 임원마다 무엇을 걱정하는지 찾습니다.', terms: ['무엇을 걱정하는지'] },
  { tag: '02 · 담기', text: '그 걱정을 덜어 줄 조건을 의견에 담습니다. 현황판과 AI 비서실장이 도와줍니다.', terms: ['조건'] },
  { tag: '03 · 답하기', text: '임원의 추가 질문에 답해야 마음이 확정됩니다. 넘어가면 원래 입장으로 돌아갑니다.', terms: ['추가 질문에 답해야'] },
  { tag: '주의', text: '듣기 좋은 조건이 오히려 반대를 부를 수도 있습니다.', terms: ['오히려 반대'], warn: true },
];

// 2026-10-09 사용자 지시: "성공 기준은 특별 이사의 의견으로 AI 임원들을 설득시켜 같은 편으로 만드는 것".
const SUCCESS_TEXT =
  '특별 이사의 의견으로 AI 임원들을 설득해 같은 편으로 만드는 것입니다. 이사님을 포함해 같은 표가 3석 이상이면 ‘성공 도장’을, 아니면 ‘실패 도장’을 받습니다.';

export function IntroScreen({ onStart }: IntroScreenProps) {
  const gate = useFocusGate('intro');
  const nextStep = introNextStep();
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
                <HighlightText text="AI 임원 네 명과 안건을 두고 토론하고," terms={INTRO_HIGHLIGHT_TERMS} />
              </p>
              <p className="intro-screen__purpose">
                <HighlightText text="마지막에 찬성·반대 중 하나를 골라 한 표를 던집니다." terms={INTRO_HIGHLIGHT_TERMS} />
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

        <div className="intro-screen__block" data-testid="intro-tips">
          <span className="intro-screen__label">{INTRO_TIPS_LABEL}</span>
          <div className="intro-screen__tips">
            {INTRO_TIPS.map((tip) => (
              <div
                key={tip.tag}
                className={tip.warn ? 'intro-screen__tip intro-screen__tip--warn' : 'intro-screen__tip'}
                data-testid="intro-tip"
              >
                <b className="intro-screen__tip-tag">{tip.tag}</b>
                <p className="intro-screen__tip-text">
                  <HighlightText text={tip.text} terms={tip.terms} />
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="intro-screen__actions">
          <button
            type="button"
            className="cta cta--solid intro-screen__cta"
            onClick={onStart}
            data-testid="intro-start"
            {...nextStepAttr(gate.visible && nextStep === 'start')}
          >
            확인
          </button>
        </div>
      </div>
    </section>
  );
}
