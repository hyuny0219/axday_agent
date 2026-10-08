// 핵심 말 강조(T99, 2026-10-08 사용자 — "중요 단어들이 눈에 확 들어오도록"): 문장 속에서
// highlightTerms와 같은 글자를 <mark class="key-term">로 감싼다. 붉은 박스는 쓰지 않고
// 진한 잉크 굵게 + 연한 종이색 바탕만 쓴다(briefing.css).
import { Fragment, type ReactNode } from 'react';

export interface TextPart {
  text: string;
  highlight: boolean;
}

/**
 * 문자열을 강조 조각으로 나눈다(순수 함수). 겹치면 긴 말이 먼저, 같은 길이면 앞에 있는
 * 말이 먼저 잡힌다. 대소문자·공백은 그대로 비교하고, 빈 말은 무시한다. 조각을 이어 붙이면
 * 항상 원문과 같다.
 */
export function splitByTerms(text: string, terms: readonly string[]): TextPart[] {
  const sorted = [...new Set(terms)].filter((t) => t.length > 0).sort((a, b) => b.length - a.length);
  if (sorted.length === 0 || text.length === 0) {
    return text.length === 0 ? [] : [{ text, highlight: false }];
  }
  const parts: TextPart[] = [];
  let plainStart = 0;
  let i = 0;
  while (i < text.length) {
    const hit = sorted.find((term) => text.startsWith(term, i));
    if (hit) {
      if (i > plainStart) parts.push({ text: text.slice(plainStart, i), highlight: false });
      parts.push({ text: hit, highlight: true });
      i += hit.length;
      plainStart = i;
    } else {
      i += 1;
    }
  }
  if (plainStart < text.length) parts.push({ text: text.slice(plainStart), highlight: false });
  return parts;
}

export interface HighlightTextProps {
  text: string;
  terms?: readonly string[];
}

export function HighlightText({ text, terms = [] }: HighlightTextProps): ReactNode {
  const parts = splitByTerms(text, terms);
  return (
    <>
      {parts.map((part, index) =>
        part.highlight ? (
          <mark key={index} className="key-term">
            {part.text}
          </mark>
        ) : (
          <Fragment key={index}>{part.text}</Fragment>
        ),
      )}
    </>
  );
}
