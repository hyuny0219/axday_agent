// 소리 신호를 DOM에서 읽는 순수 함수(T128): 어떤 클릭이 어떤 효과음인지, 새로 붙은 노드에 도착 카드가 몇 장인지.

export const MAJOR_BUTTON_SELECTOR = 'button.cta:not(.cta--secondary):not(.cta--outline), button[data-sound]';
export const ARRIVAL_CARD_PATTERN = /^(statement|reaction)-card-(CEO|CFO|CAIO|CISO)$/;

/** 클릭된 요소에서 낼 효과음을 정한다. 낼 소리가 없으면 null. */
export function clickCueFor(target: EventTarget | null): 'clickA' | 'sendA' | null {
  if (!(target instanceof Element)) return null;
  const button = target.closest('button');
  if (!button) return null;
  if (button.disabled || button.getAttribute('aria-disabled') === 'true') return null;
  const mark = button.getAttribute('data-sound');
  if (mark === 'none') return null;
  if (mark === 'send') return 'sendA';
  return button.matches(MAJOR_BUTTON_SELECTOR) ? 'clickA' : null;
}

/** 새로 붙은 노드 안의 도착 카드 수(지난 화면 보기 안은 제외). */
export function countArrivals(node: Node): number {
  if (!(node instanceof Element)) return 0;
  // 지난 화면 보기(T126) 중에는 지금 화면이 display:none으로 마운트만 유지된다. 그 안에서 늦게 도착하는
  // 카드도 소리를 내지 않는다(돌아와도 놓친 도착음은 다시 내지 않는다).
  const inPast = (el: Element) => {
    if (el.closest('[data-past-screen]') !== null) return true;
    const live = el.closest<HTMLElement>('[data-live-screen]');
    return live !== null && live.style.display === 'none';
  };
  let count = 0;
  const candidates = [node, ...Array.from(node.querySelectorAll('[data-testid]'))];
  for (const el of candidates) {
    const id = el.getAttribute('data-testid');
    if (id && ARRIVAL_CARD_PATTERN.test(id) && !inPast(el)) count += 1;
  }
  return count;
}

