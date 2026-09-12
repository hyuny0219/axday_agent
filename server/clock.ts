// 서버 전용 주입형 시계. 라운드·표 핸들러는 latencyMs를 항상 now()의 전후 차이로만
// 계산하고, 호출 횟수나 setTimeout 틱 수로 셈하지 않는다(DEV_PLAN.md 공통 규칙).

export interface Clock {
  now(): number;
}

export const systemClock: Clock = {
  now: () => Date.now(),
};
