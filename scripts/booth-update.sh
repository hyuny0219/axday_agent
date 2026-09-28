#!/usr/bin/env bash
# 부스 PC 갱신·기동(T60). main에 새 PR이 병합될 때마다 부스 PC에서 손으로 반복하던
# git pull → npm ci → npm run build → npm start → 모델 연결 확인을 한 번에 묶는다.
# 서버(server/config.ts)는 .env를 읽지 않으므로 키를 셸에 export하는 것도 이 스크립트가
# 맡는다.
#
# 사용법: npm run booth [-- --skip-pull]
#   --skip-pull  부스 회선이 없을 때, 이미 받아 둔 코드로 git pull 없이 기동한다.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

SKIP_PULL=""
for arg in "$@"; do
  case "${arg}" in
    --skip-pull)
      SKIP_PULL=1
      ;;
    *)
      echo "[booth] 알 수 없는 옵션: ${arg}" >&2
      exit 1
      ;;
  esac
done

PORT="${PORT:-8787}"
BASE_URL="http://localhost:${PORT}"

echo "[booth] 1/6 작업 트리 검사"
DIRTY="$(git status --porcelain)"
if [ -n "${DIRTY}" ]; then
  echo "[booth] 작업 트리에 손댄 파일이 있어 중단한다(자동으로 되돌리거나 stash하지 않는다):" >&2
  echo "${DIRTY}" >&2
  exit 1
fi

echo "[booth] 2/6 갱신"
LOCKFILE_CHANGED=""
if [ -n "${SKIP_PULL}" ]; then
  echo "[booth] --skip-pull: git pull 생략"
else
  BEFORE_HEAD="$(git rev-parse HEAD)"
  git pull --ff-only origin main
  AFTER_HEAD="$(git rev-parse HEAD)"
  if [ "${BEFORE_HEAD}" != "${AFTER_HEAD}" ] \
    && git diff --name-only "${BEFORE_HEAD}" "${AFTER_HEAD}" | grep -qx "package-lock.json"; then
    LOCKFILE_CHANGED=1
  fi
fi

echo "[booth] 3/6 의존성"
if [ -n "${LOCKFILE_CHANGED}" ]; then
  echo "[booth] package-lock.json이 이번 pull에서 바뀜 → npm ci"
  npm ci
elif [ ! -d node_modules ]; then
  echo "[booth] node_modules 없음 → npm ci"
  npm ci
else
  echo "[booth] package-lock.json 변경 없음, node_modules 있음 → npm ci 생략"
fi

echo "[booth] 4/6 빌드"
npm run build

echo "[booth] 5/6 키 로드"
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi
if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "[booth] 경고: 키 없음 → 서버는 켜지지만 화면은 scripted로 시작한다"
else
  echo "[booth] ANTHROPIC_API_KEY 있음(앞 4자: ${ANTHROPIC_API_KEY:0:4}****)"
fi

echo "[booth] 6/6 기동·확인"
# npm이 실제 서버 프로세스(tsx server/index.ts)를 자식으로 fork하므로, 종료 시 npm의
# PID만 죽이면 서버가 고아로 남는다. `set -m`으로 백그라운드 잡을 별도 프로세스 그룹으로
# 두고, 그룹 전체(음수 PID)에 신호를 보내 정리한다(offline-check.sh와 같은 원칙 — 종료 시
# 자식 프로세스를 남기지 않는다).
set -m
SERVER_PID=""
cleanup() {
  if [ -n "${SERVER_PID}" ] && kill -0 "${SERVER_PID}" 2>/dev/null; then
    kill -TERM "-${SERVER_PID}" 2>/dev/null || kill "${SERVER_PID}" 2>/dev/null || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT

MODEL_PROVIDER="${MODEL_PROVIDER:-anthropic}" npm start &
SERVER_PID=$!

READY=""
HEALTH_BODY=""
for _ in $(seq 1 20); do
  if HEALTH_BODY="$(curl -fsS "${BASE_URL}/api/health" 2>/dev/null)"; then
    READY=1
    break
  fi
  sleep 1
done

if [ -z "${READY}" ]; then
  echo "[booth] ${BASE_URL}/api/health가 20초 안에 응답하지 않는다" >&2
  exit 1
fi

MODE="$(printf '%s' "${HEALTH_BODY}" | node -e "
let d='';
process.stdin.on('data',(c)=>{d+=c;});
process.stdin.on('end',()=>{
  try { process.stdout.write(String(JSON.parse(d).mode ?? '')); }
  catch { process.stdout.write(''); }
});
")"
MODEL_ID="$(printf '%s' "${HEALTH_BODY}" | node -e "
let d='';
process.stdin.on('data',(c)=>{d+=c;});
process.stdin.on('end',()=>{
  try { process.stdout.write(String(JSON.parse(d).modelId ?? '')); }
  catch { process.stdout.write(''); }
});
")"

if [ "${MODE}" = "live" ]; then
  echo "[booth] LIVE · ${MODEL_ID}"
else
  echo "[booth] SCRIPTED(키 없음 또는 인증 실패)"
fi

echo "[booth] 참가자 화면: ${BASE_URL}/"
echo "[booth] 개장 전 운영 메뉴 → 모델 연결 확인을 한 번 누른다"

wait "${SERVER_PID}"
