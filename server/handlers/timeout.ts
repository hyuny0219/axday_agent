// 제공자 호출에 하드 타임아웃을 강제하는 헬퍼. AbortSignal을 존중하지 않는 제공자(예:
// mock의 'late' 장애)라도 handler는 min(8000, budgetMs)를 넘겨 기다리지 않는다.
// 원래 promise가 나중에 resolve/reject 되어도 이미 처리했으므로 unhandled rejection은
// 남기지 않는다.

/** promise가 ms 안에 끝나지 않으면 'handler_timeout' 오류로 대신 reject한다. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('handler_timeout'));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
