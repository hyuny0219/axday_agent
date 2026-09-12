#!/usr/bin/env bash
# 오프라인 실행 검증(T17).
#
# 1) 프로덕션 빌드(npm run build)
# 2) 빌드 산출물을 `vite preview`로 로컬 기동
# 3) e2e/fixtures.ts의 외부 요청 차단 fixture가 자동 적용된 상태로 scripted 경로
#    핵심 spec을 스모크 실행한다. 각 테스트가 끝날 때 localhost 밖으로 나간 요청이
#    0건인지 fixture가 자동으로 단언하므로, 이 스크립트가 통과하면 인터넷 연결 없이
#    현장에서 완주할 수 있다는 근거가 된다.
#
# 사용법: bash scripts/offline-check.sh
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

PORT=4173
BASE_URL="http://localhost:${PORT}"

echo "[offline-check] 1/3 프로덕션 빌드"
npm run build

echo "[offline-check] 2/3 vite preview 기동 (포트 ${PORT})"
# `npm run preview`(sh 래퍼) 대신 vite 바이너리를 직접 실행해, 종료 시 자식 프로세스가
# 고아로 남지 않고 PREVIEW_PID로 바로 죽일 수 있게 한다.
node_modules/.bin/vite preview --port "${PORT}" --strictPort &
PREVIEW_PID=$!

cleanup() {
  if kill -0 "${PREVIEW_PID}" 2>/dev/null; then
    kill "${PREVIEW_PID}" 2>/dev/null || true
    wait "${PREVIEW_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT

READY=""
for _ in $(seq 1 30); do
  if curl -fsS "${BASE_URL}" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done

if [ -z "${READY}" ]; then
  echo "[offline-check] vite preview가 ${BASE_URL}에서 응답하지 않는다" >&2
  exit 1
fi

echo "[offline-check] 3/3 오프라인 scripted 스모크 E2E (외부 요청 차단 fixture)"
npx playwright test \
  e2e/smoke.spec.ts \
  e2e/flow-full.spec.ts \
  e2e/discuss.spec.ts \
  e2e/operations.spec.ts

echo "[offline-check] 통과: 빌드 산출물이 오프라인(외부 호스트 요청 0건)으로 scripted 완주를 마쳤다"
