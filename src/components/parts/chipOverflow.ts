// 조건 칩 줄(가로 스크롤)에서 오른쪽에 가려진 칩 수(T117). 칩의 offsetLeft는 상위 요소 기준이라
// 목록 왼쪽 오프셋만큼 부풀려지므로, 화면 좌표(getBoundingClientRect)의 차이로 잰다.
// 보이는 영역은 목록 상자의 오른쪽 끝이다(스크롤 위치는 칩 좌표에 이미 반영돼 있다).

export interface RectLike {
  left: number;
  right: number;
}

/** 오른쪽 끝이 목록 오른쪽 끝을 1px 넘게 벗어난 칩의 수. */
export function countHiddenChips(list: RectLike, chips: RectLike[]): number {
  return chips.filter((chip) => chip.right > list.right + 1).length;
}
