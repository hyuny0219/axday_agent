// 진행 가이드 한 줄(T95, 2026-10-08 사용자 — "참석자가 진행할 때 어떤 걸 먼저 보고
// 진행해야 하는지 가이드/하이라이트"). 각 화면이 지금 참가자가 먼저 봐야 할 요소를
// 이 한 줄로 알려주고, 그 요소 자체에는 `data-guide="next"`를 붙여 맥동 테두리로
// 강조한다(강조 스타일은 shell.css의 전역 규칙 — prefers-reduced-motion이면 애니메이션
// 없이 정적 테두리만 남는다). 문구는 docs/FACILITATOR_GUIDE.md의 요원 안내 문구와
// 맞춘다(요원이 화면과 같은 말을 하도록).
import '../../styles/screens/shell.css';

export interface GuideHintProps {
  text: string;
  testId?: string;
}

export function GuideHint({ text, testId = 'guide-hint' }: GuideHintProps) {
  return (
    <p className="guide-hint" data-testid={testId}>
      {text}
    </p>
  );
}
